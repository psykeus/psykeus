import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { getUserWithTier, checkUserDownloadLimit } from "@/lib/services/user-service";
import { isFavoritesEnabled, isCollectionsEnabled } from "@/lib/feature-flags";
import { formatDate } from "@/lib/utils";
import { LogoutButton } from "@/components/LogoutButton";
import { BillingSection } from "@/components/BillingSection";
import {
  Heart,
  FolderHeart,
  Download,
  Crown,
  Shield,
  Calendar,
  Clock,
  Hash,
  Mail,
  Globe,
  Settings,
  Camera,
} from "lucide-react";

export default async function AccountPage() {
  const user = await requireUser();
  const supabase = await createClient();

  // Fetch user with tier info
  const userWithTier = await getUserWithTier(user.id);

  // Check enabled features
  const [favoritesEnabled, collectionsEnabled] = await Promise.all([
    isFavoritesEnabled(),
    isCollectionsEnabled(),
  ]);

  // Fetch download limit status
  const downloadStatus = await checkUserDownloadLimit(user.id);

  // Fetch user stats for enabled features
  let favoriteCount = 0;
  let collectionCount = 0;

  if (favoritesEnabled) {
    const { count } = await supabase
      .from("user_favorites")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);
    favoriteCount = count || 0;
  }

  if (collectionsEnabled) {
    const { count } = await supabase
      .from("collections")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);
    collectionCount = count || 0;
  }

  // Fetch total downloads
  const { count: totalDownloads } = await supabase
    .from("downloads")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  // Fetch recent downloads
  const { data: downloads } = await supabase
    .from("downloads")
    .select(
      `
      id,
      downloaded_at,
      designs (
        id,
        slug,
        title,
        preview_path
      )
    `
    )
    .eq("user_id", user.id)
    .order("downloaded_at", { ascending: false })
    .limit(6);

  // Fetch design views count
  const { count: totalViews } = await supabase
    .from("design_views")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  const tier = userWithTier?.access_tier;
  const hasLimits = tier?.daily_download_limit || tier?.monthly_download_limit;

  // Calculate days as member
  const memberSince = new Date(user.created_at);
  const daysMember = Math.floor((Date.now() - memberSince.getTime()) / (1000 * 60 * 60 * 24));

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Profile Header Card */}
      <div className="bg-card border rounded-xl p-6 mb-6">
        <div className="flex flex-col sm:flex-row gap-6">
          {/* Profile Photo */}
          <div className="flex-shrink-0">
            <div className="relative">
              {userWithTier?.profile_image_url ? (
                <Image
                  src={userWithTier.profile_image_url}
                  alt={user.name || "Profile"}
                  width={100}
                  height={100}
                  className="rounded-full object-cover"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-3xl font-semibold text-primary">
                  {(user.name || user.email || "U").charAt(0).toUpperCase()}
                </div>
              )}
              <Link
                href="/account/settings"
                className="absolute -bottom-1 -right-1 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center hover:bg-primary/90 transition-colors shadow-sm"
                title="Edit profile"
              >
                <Camera className="h-4 w-4" />
              </Link>
            </div>
          </div>

          {/* Profile Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-xl font-bold truncate">
                  {user.name || "Anonymous User"}
                </h1>
                <p className="text-sm text-muted-foreground truncate">{user.email}</p>

                {/* Tier Badge */}
                <div className="mt-2">
                  {tier?.slug === "pro" && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-full text-xs font-medium">
                      <Crown className="h-3 w-3" />
                      Pro Member
                    </span>
                  )}
                  {tier?.slug === "premium" && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full text-xs font-medium">
                      <Shield className="h-3 w-3" />
                      Premium Member
                    </span>
                  )}
                  {(!tier || tier?.slug === "free") && (
                    <span className="px-2.5 py-1 bg-secondary rounded-full text-xs font-medium">
                      Free Account
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <Link
                  href="/account/settings"
                  className="p-2 rounded-lg hover:bg-muted transition-colors"
                  title="Settings"
                >
                  <Settings className="h-5 w-5 text-muted-foreground" />
                </Link>
                <LogoutButton />
              </div>
            </div>

            {/* Bio */}
            {userWithTier?.bio ? (
              <p className="mt-3 text-sm text-muted-foreground line-clamp-2">
                {userWithTier.bio}
              </p>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground/60 italic">
                <Link href="/account/settings" className="hover:text-primary transition-colors">
                  Add a bio to tell others about yourself
                </Link>
              </p>
            )}

            {/* Website */}
            {userWithTier?.website && (
              <a
                href={userWithTier.website}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                <Globe className="h-3.5 w-3.5" />
                {userWithTier.website.replace(/^https?:\/\//, "")}
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Horizontal Library Stats */}
      <div className="bg-card border rounded-xl p-4 mb-6">
        <div className="flex items-center justify-around divide-x">
          {favoritesEnabled && (
            <Link
              href="/account/favorites"
              className="flex-1 flex flex-col items-center py-2 hover:bg-muted/50 rounded-lg transition-colors group"
            >
              <Heart className="h-5 w-5 text-red-500 mb-1 group-hover:scale-110 transition-transform" />
              <span className="text-xl font-bold">{favoriteCount}</span>
              <span className="text-xs text-muted-foreground">Favorites</span>
            </Link>
          )}

          {collectionsEnabled && (
            <Link
              href="/account/collections"
              className="flex-1 flex flex-col items-center py-2 hover:bg-muted/50 rounded-lg transition-colors group"
            >
              <FolderHeart className="h-5 w-5 text-purple-500 mb-1 group-hover:scale-110 transition-transform" />
              <span className="text-xl font-bold">{collectionCount}</span>
              <span className="text-xs text-muted-foreground">Collections</span>
            </Link>
          )}

          <Link
            href="/account/downloads"
            className="flex-1 flex flex-col items-center py-2 hover:bg-muted/50 rounded-lg transition-colors group"
          >
            <Download className="h-5 w-5 text-blue-500 mb-1 group-hover:scale-110 transition-transform" />
            <span className="text-xl font-bold">{totalDownloads || 0}</span>
            <span className="text-xs text-muted-foreground">Downloads</span>
          </Link>
        </div>
      </div>

      {/* Billing Section - Full Width */}
      <div className="mb-6">
        <BillingSection tierName={tier?.name} tierSlug={tier?.slug} />
      </div>

      {/* Main Content Grid */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Download Usage Card */}
        {hasLimits && (
          <div className="bg-card border rounded-xl p-6">
            <h2 className="font-semibold mb-4">Download Usage</h2>

            <div className="space-y-3">
              {tier?.daily_download_limit && (
                <div>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-muted-foreground">Today</span>
                    <span className="font-medium">
                      {downloadStatus.downloads_today} / {tier.daily_download_limit}
                    </span>
                  </div>
                  <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{
                        width: `${Math.min((downloadStatus.downloads_today / tier.daily_download_limit) * 100, 100)}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {tier?.monthly_download_limit && (
                <div>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-muted-foreground">This month</span>
                    <span className="font-medium">
                      {downloadStatus.downloads_this_month} / {tier.monthly_download_limit}
                    </span>
                  </div>
                  <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{
                        width: `${Math.min((downloadStatus.downloads_this_month / tier.monthly_download_limit) * 100, 100)}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Tier benefits */}
            <div className="mt-4 pt-4 border-t text-xs text-muted-foreground space-y-1">
              {tier?.can_access_premium && <p>Access to premium designs</p>}
              {tier?.can_access_exclusive && <p>Access to exclusive designs</p>}
              {tier?.can_create_collections && (
                <p>Create up to {tier.max_collections || "unlimited"} collections</p>
              )}
            </div>
          </div>
        )}

        {/* Account Details Card */}
        <div className="bg-card border rounded-xl p-6">
          <h2 className="font-semibold mb-4">Account Details</h2>

          <dl className="space-y-3 text-sm">
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <dt className="sr-only">Email</dt>
              <dd className="truncate">{user.email}</dd>
            </div>

            <div className="flex items-center gap-3">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <dt className="sr-only">Member since</dt>
              <dd>
                Member since {formatDate(user.created_at)}
                <span className="text-muted-foreground ml-1">({daysMember} days)</span>
              </dd>
            </div>

            {userWithTier?.last_login_at && (
              <div className="flex items-center gap-3">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <dt className="sr-only">Last login</dt>
                <dd>Last active {formatDate(userWithTier.last_login_at)}</dd>
              </div>
            )}

            <div className="flex items-center gap-3">
              <Hash className="h-4 w-4 text-muted-foreground" />
              <dt className="sr-only">Login count</dt>
              <dd>{userWithTier?.login_count || 1} total logins</dd>
            </div>

            {totalViews !== null && totalViews > 0 && (
              <div className="flex items-center gap-3">
                <svg className="h-4 w-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                <dt className="sr-only">Designs viewed</dt>
                <dd>{totalViews} designs viewed</dd>
              </div>
            )}
          </dl>

          <div className="mt-4 pt-4 border-t">
            <Link
              href="/account/settings"
              className="text-sm text-primary hover:underline inline-flex items-center gap-1"
            >
              <Settings className="h-3.5 w-3.5" />
              Edit profile settings
            </Link>
          </div>
        </div>

        {/* Recent Downloads - Full Width */}
        <div className="bg-card border rounded-xl p-6 md:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Recent Downloads</h2>
            {totalDownloads && totalDownloads > 0 && (
              <Link href="/account/downloads" className="text-sm text-primary hover:underline">
                View all
              </Link>
            )}
          </div>

          {downloads && downloads.length > 0 ? (
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {downloads.slice(0, 6).map((download) => {
                const design = download.designs as unknown as {
                  id: string;
                  slug: string;
                  title: string;
                  preview_path: string;
                } | null;

                if (!design) return null;

                return (
                  <Link
                    key={download.id}
                    href={`/designs/${design.slug}`}
                    className="group relative aspect-square rounded-lg overflow-hidden bg-muted"
                    title={design.title}
                  >
                    <Image
                      src={design.preview_path}
                      alt={design.title}
                      fill
                      sizes="(max-width: 640px) 33vw, 100px"
                      className="object-cover transition-transform group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <Download className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-muted-foreground mb-2">No downloads yet</p>
              <Link
                href="/designs"
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                Browse designs to get started
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
