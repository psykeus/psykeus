import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isSocialCardsEnabled } from "@/lib/feature-flags";

// ISR: Revalidate pages every hour
export const revalidate = 3600;

// Pre-generate pages for the most popular designs
export async function generateStaticParams() {
  const supabase = createServiceClient();

  // Pre-render the 50 most recently updated public designs
  const { data: designs } = await supabase
    .from("designs")
    .select("slug")
    .eq("is_public", true)
    .order("updated_at", { ascending: false })
    .limit(50);

  return designs?.map((d) => ({ slug: d.slug })) || [];
}

// Generate dynamic metadata for SEO and social cards
interface MetadataProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: MetadataProps): Promise<Metadata> {
  const { slug } = await params;
  const supabase = createServiceClient();

  const { data: design } = await supabase
    .from("designs")
    .select("title, description, preview_path, categories")
    .eq("slug", slug)
    .eq("is_public", true)
    .single();

  if (!design) {
    return {
      title: "Design Not Found",
    };
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const socialCardsEnabled = await isSocialCardsEnabled();

  // Use dynamic OG image if feature enabled, otherwise use preview_path
  const ogImage = socialCardsEnabled
    ? `${baseUrl}/api/og/${slug}`
    : design.preview_path || `${baseUrl}/og-default.png`;

  return {
    title: design.title,
    description: design.description || `Download ${design.title} - CNC and laser cutting design file`,
    keywords: design.categories || [],
    openGraph: {
      title: design.title,
      description: design.description || `Download ${design.title} - CNC and laser cutting design`,
      type: "article",
      url: `${baseUrl}/designs/${slug}`,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: design.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: design.title,
      description: design.description || `Download ${design.title}`,
      images: [ogImage],
    },
  };
}

import { getUser } from "@/lib/auth";
import { loadAIConfig } from "@/lib/ai-config";
import { isFavoritesEnabled, isCollectionsEnabled, isRelatedDesignsEnabled } from "@/lib/feature-flags";
import { canUserAccessDesign, getUserWithTier } from "@/lib/services/user-service";
import { DownloadButton } from "@/components/DownloadButton";
import { DesignFileList } from "@/components/DesignFileList";
import { DesignCard } from "@/components/DesignCard";
import { DesignPreview } from "@/components/DesignPreview";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { FavoriteButton } from "@/components/FavoriteButton";
import { AddToCollectionModal } from "@/components/AddToCollectionModal";
import { RelatedDesigns } from "@/components/RelatedDesigns";
import { formatBytes, formatDate, capitalize } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { DesignFile, DesignAccessLevel, DesignLicenseType } from "@/lib/types";
import { is3DModelType } from "@/lib/preview-config";
import { Crown, Lock, Shield } from "lucide-react";
import { LicenseBadge, LicenseInfo } from "@/components/LicenseBadge";

interface Props {
  params: Promise<{ slug: string }>;
}

// Helper function to get access level badge
function AccessLevelBadge({ level }: { level: DesignAccessLevel }) {
  if (level === "free") return null;

  if (level === "premium") {
    return (
      <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 gap-1">
        <Shield className="h-3 w-3" />
        Premium
      </Badge>
    );
  }

  if (level === "exclusive") {
    return (
      <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 gap-1">
        <Crown className="h-3 w-3" />
        Exclusive
      </Badge>
    );
  }

  return null;
}

export default async function DesignDetailPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();
  const user = await getUser();

  // Load display settings and feature flags in parallel
  const [config, favoritesEnabled, collectionsEnabled, relatedEnabled] = await Promise.all([
    loadAIConfig(),
    isFavoritesEnabled(),
    isCollectionsEnabled(),
    isRelatedDesignsEnabled(),
  ]);
  const displaySettings = config.displaySettings;

  // Fetch design with current version and tags
  const { data: design, error } = await supabase
    .from("designs")
    .select(
      `
      *,
      design_files!designs_current_version_id_fkey (
        id,
        file_type,
        size_bytes,
        version_number,
        created_at
      ),
      design_tags (
        tags (
          id,
          name
        )
      )
    `
    )
    .eq("slug", slug)
    .eq("is_public", true)
    .single();

  if (error || !design) {
    notFound();
  }

  // Check if user can access this design based on their tier
  const accessLevel = (design.access_level || "free") as DesignAccessLevel;
  let canAccess = accessLevel === "free"; // Free designs are always accessible

  if (user && accessLevel !== "free") {
    canAccess = await canUserAccessDesign(user.id, design.id);
  }

  // Flatten tags
  const tags = design.design_tags?.map((dt: { tags: { id: string; name: string } }) => dt.tags) ?? [];
  const currentFile = design.design_files;

  // Fetch all active files for this design (for multi-file support)
  const { data: allFiles } = await supabase
    .from("design_files")
    .select("*")
    .eq("design_id", design.id)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  const designFiles = (allFiles || []) as DesignFile[];
  const hasMultipleFiles = designFiles.length > 1;

  // Find first 3D model file if any (for showing 3D viewer toggle)
  const threeDFile = designFiles.find((f) => f.file_type && is3DModelType(f.file_type));
  const effectiveFileType = threeDFile?.file_type || currentFile?.file_type || null;

  // Only fetch similar designs if relatedDesigns feature is disabled (fallback)
  let similarDesigns: Array<{
    id: string;
    slug: string;
    title: string;
    preview_path: string;
    difficulty: string | null;
    categories: string[] | null;
    style: string | null;
  }> = [];

  // Fallback to category-based similar designs when feature flag is off
  if (!relatedEnabled && design.categories && design.categories.length > 0) {
    const { data: similar } = await supabase
      .from("designs")
      .select("id, slug, title, preview_path, difficulty, categories, style")
      .eq("is_public", true)
      .neq("id", design.id)
      .overlaps("categories", design.categories)
      .limit(4);

    similarDesigns = similar ?? [];
  }

  return (
    <div className="container mx-auto px-4 py-8 animate-fade-in">
      {/* Breadcrumb */}
      <Breadcrumbs
        items={[
          { label: "Designs", href: "/designs" },
          { label: design.title },
        ]}
      />

      <div className="grid lg:grid-cols-2 gap-8 items-start">
        {/* Preview - Static image or 3D viewer for STL */}
        <Card className="overflow-hidden">
          <DesignPreview
            designId={design.id}
            designSlug={slug}
            previewPath={design.preview_path}
            title={design.title}
            fileType={effectiveFileType}
          />
        </Card>

        {/* Details Panel */}
        <div>
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <h1 className="font-heading text-3xl font-bold">{design.title}</h1>
              <AccessLevelBadge level={accessLevel} />
            </div>
            {(favoritesEnabled || collectionsEnabled) && (
              <div className="flex gap-2 flex-shrink-0">
                {favoritesEnabled && (
                  <FavoriteButton
                    designId={design.id}
                    size="default"
                    variant="outline"
                    showCount
                  />
                )}
                {collectionsEnabled && user && (
                  <AddToCollectionModal designId={design.id} />
                )}
              </div>
            )}
          </div>

          {/* Tags */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-6">
              {tags.map((tag: { id: string; name: string }) => (
                <Link key={tag.id} href={`/designs?tag=${tag.name}`}>
                  <Badge variant="secondary" className="hover:bg-secondary/80 cursor-pointer">
                    {tag.name}
                  </Badge>
                </Link>
              ))}
            </div>
          )}

          {/* Metadata Card */}
          <Card className="mb-6">
            <CardContent className="p-6">
              <dl className="grid grid-cols-2 gap-4">
                {displaySettings.showDifficulty && design.difficulty && (
                  <div>
                    <dt className="text-sm text-muted-foreground">Difficulty</dt>
                    <dd className="font-medium">{capitalize(design.difficulty)}</dd>
                  </div>
                )}
                {design.project_type && (
                  <div>
                    <dt className="text-sm text-muted-foreground">Type</dt>
                    <dd className="font-medium">{capitalize(design.project_type)}</dd>
                  </div>
                )}
                {design.style && (
                  <div>
                    <dt className="text-sm text-muted-foreground">Style</dt>
                    <dd className="font-medium">{capitalize(design.style)}</dd>
                  </div>
                )}
                {displaySettings.showDimensions && design.approx_dimensions && (
                  <div>
                    <dt className="text-sm text-muted-foreground">Dimensions</dt>
                    <dd className="font-medium">{design.approx_dimensions}</dd>
                  </div>
                )}
                {currentFile && (
                  <>
                    <div>
                      <dt className="text-sm text-muted-foreground">File Type</dt>
                      <dd className="font-medium">
                        <Badge variant="outline" className="uppercase">
                          {currentFile.file_type || "Unknown"}
                        </Badge>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm text-muted-foreground">File Size</dt>
                      <dd className="font-medium">
                        {currentFile.size_bytes ? formatBytes(currentFile.size_bytes) : "Unknown"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm text-muted-foreground">Version</dt>
                      <dd className="font-medium">v{currentFile.version_number}</dd>
                    </div>
                  </>
                )}
                <div>
                  <dt className="text-sm text-muted-foreground">Added</dt>
                  <dd className="font-medium">{formatDate(design.created_at)}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          {/* Download Section */}
          {canAccess ? (
            hasMultipleFiles ? (
              <DesignFileList
                designId={design.id}
                designSlug={slug}
                files={designFiles}
                isAuthenticated={!!user}
              />
            ) : (
              <DownloadButton
                designId={design.id}
                isAuthenticated={!!user}
              />
            )
          ) : (
            <Card className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="p-2 bg-amber-100 dark:bg-amber-900/50 rounded-lg">
                    <Lock className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg mb-1">
                      {accessLevel === "exclusive" ? "Exclusive Design" : "Premium Design"}
                    </h3>
                    <p className="text-muted-foreground mb-4">
                      {user
                        ? `This design requires a ${accessLevel === "exclusive" ? "Pro" : "Premium or Pro"} subscription to download.`
                        : "Sign in and upgrade your plan to access this design."}
                    </p>
                    <Link
                      href={user ? "/pricing" : "/login?redirect=" + encodeURIComponent(`/designs/${slug}`)}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
                    >
                      {user ? (
                        <>
                          <Crown className="h-4 w-4" />
                          Upgrade Plan
                        </>
                      ) : (
                        <>
                          <Lock className="h-4 w-4" />
                          Sign In to Upgrade
                        </>
                      )}
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Description */}
          {design.description && (
            <div className="mt-8">
              <Separator className="mb-6" />
              <h2 className="font-heading text-lg font-semibold mb-3">Description</h2>
              <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">
                {design.description}
              </p>
            </div>
          )}

          {/* License Info */}
          <div className="mt-8">
            <Separator className="mb-6" />
            <h2 className="font-heading text-lg font-semibold mb-3">License</h2>
            <LicenseInfo
              licenseType={(design.license_type as DesignLicenseType) || "unknown"}
              licenseNotes={design.license_notes}
              licenseUrl={design.license_url}
              attributionRequired={design.attribution_required}
              commercialUseAllowed={design.commercial_use_allowed}
              modificationAllowed={design.modification_allowed ?? true}
            />
          </div>
        </div>
      </div>

      {/* Related Designs - Feature flag enabled */}
      {relatedEnabled && (
        <section className="mt-16">
          <Separator className="mb-8" />
          <RelatedDesigns designSlug={slug} />
        </section>
      )}

      {/* Fallback Similar Designs - When feature flag is off */}
      {!relatedEnabled && similarDesigns.length > 0 && (
        <section className="mt-16">
          <Separator className="mb-8" />
          <h2 className="font-heading text-2xl font-semibold mb-6">Similar Designs</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
            {similarDesigns.map((similar) => (
              <DesignCard key={similar.id} design={similar} showFavorite={favoritesEnabled} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
