import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import { isCollectionsEnabled } from "@/lib/feature-flags";
import { formatDate, capitalize } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FolderHeart, ArrowLeft, Edit, Trash2, Globe, Lock } from "lucide-react";
import { CollectionActions } from "./CollectionActions";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CollectionDetailPage({ params }: PageProps) {
  const { id } = await params;

  // Check if feature is enabled
  const collectionsEnabled = await isCollectionsEnabled();
  if (!collectionsEnabled) {
    redirect("/account");
  }

  const user = await getUser();
  const supabase = await createClient();

  // Fetch collection
  const { data: collection, error } = await supabase
    .from("collections")
    .select(
      `
      id,
      user_id,
      name,
      description,
      is_public,
      cover_image_url,
      created_at,
      updated_at
    `
    )
    .eq("id", id)
    .single();

  if (error || !collection) {
    notFound();
  }

  // Check access permissions
  const isOwner = user?.id === collection.user_id;
  if (!collection.is_public && !isOwner) {
    notFound();
  }

  // Fetch collection items with design details
  const { data: items } = await supabase
    .from("collection_items")
    .select(
      `
      id,
      added_at,
      sort_order,
      notes,
      designs (
        id,
        slug,
        title,
        preview_path,
        difficulty,
        style,
        is_public
      )
    `
    )
    .eq("collection_id", id)
    .order("sort_order", { ascending: true });

  type DesignData = {
    id: string;
    slug: string;
    title: string;
    preview_path: string | null;
    difficulty: string | null;
    style: string | null;
    is_public: boolean;
  };

  // Filter to only show public designs (or all if owner)
  const filteredItems =
    items
      ?.map((item) => {
        const design = item.designs as unknown as DesignData | null;
        if (!design) return null;
        if (!design.is_public && !isOwner) return null;
        return {
          id: item.id,
          added_at: item.added_at,
          sort_order: item.sort_order,
          notes: item.notes,
          design,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null) || [];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-start gap-4">
          <Link href="/account/collections">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold">{collection.name}</h1>
              {collection.is_public ? (
                <span title="Public collection">
                  <Globe className="h-5 w-5 text-muted-foreground" />
                </span>
              ) : (
                <span title="Private collection">
                  <Lock className="h-5 w-5 text-muted-foreground" />
                </span>
              )}
            </div>
            {collection.description && (
              <p className="text-muted-foreground mt-2 max-w-2xl">
                {collection.description}
              </p>
            )}
            <p className="text-sm text-muted-foreground mt-2">
              {filteredItems.length} design{filteredItems.length !== 1 ? "s" : ""} · Created{" "}
              {formatDate(collection.created_at)}
            </p>
          </div>
        </div>

        {isOwner && (
          <CollectionActions
            collectionId={collection.id}
            collectionName={collection.name}
            collectionDescription={collection.description}
            isPublic={collection.is_public}
          />
        )}
      </div>

      {filteredItems.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredItems.map((item) => (
            <Card
              key={item.id}
              className="overflow-hidden transition-all duration-300 hover:shadow-warm-lg hover:-translate-y-1 border-border/50 group"
            >
              <Link href={`/designs/${item.design.slug}`}>
                {/* Image container */}
                <div className="relative aspect-square bg-muted overflow-hidden">
                  {item.design.preview_path ? (
                    <Image
                      src={item.design.preview_path}
                      alt={item.design.title}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      No preview
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </div>
              </Link>

              <CardContent className="p-4">
                <Link href={`/designs/${item.design.slug}`}>
                  <h3 className="font-heading font-medium truncate group-hover:text-primary transition-colors duration-200">
                    {item.design.title}
                  </h3>
                </Link>

                <div className="flex flex-wrap gap-1.5 mt-3">
                  {item.design.difficulty && (
                    <Badge variant="secondary" className="text-xs">
                      {capitalize(item.design.difficulty)}
                    </Badge>
                  )}
                  {item.design.style && (
                    <Badge variant="outline" className="text-xs">
                      {capitalize(item.design.style)}
                    </Badge>
                  )}
                </div>

                {item.notes && (
                  <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                    {item.notes}
                  </p>
                )}

                <p className="text-xs text-muted-foreground mt-2">
                  Added {formatDate(item.added_at)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <FolderHeart className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
          <h2 className="text-xl font-semibold mb-2">No designs in this collection</h2>
          <p className="text-muted-foreground mb-6">
            Add designs from the design pages using the "Add to Collection" button.
          </p>
          <Button asChild>
            <Link href="/designs">Browse Designs</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
