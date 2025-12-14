import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { isFavoritesEnabled } from "@/lib/feature-flags";
import { formatDate, capitalize } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Heart, ArrowLeft, Search } from "lucide-react";
import { FavoriteButton } from "@/components/FavoriteButton";

export default async function FavoritesPage() {
  // Check if feature is enabled
  const favoritesEnabled = await isFavoritesEnabled();
  if (!favoritesEnabled) {
    redirect("/account");
  }

  const user = await requireUser();
  const supabase = await createClient();

  // Fetch user's favorites with design details
  const { data: favorites, error } = await supabase
    .from("user_favorites")
    .select(
      `
      id,
      created_at,
      designs (
        id,
        slug,
        title,
        description,
        preview_path,
        categories,
        difficulty,
        is_public,
        style
      )
    `
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching favorites:", error.message, error.code, error.details, error.hint);
  }

  type DesignData = {
    id: string;
    slug: string;
    title: string;
    description: string | null;
    preview_path: string | null;
    categories: string[] | null;
    difficulty: string | null;
    is_public: boolean;
    style: string | null;
  };

  const favoriteDesigns =
    favorites
      ?.map((fav) => {
        const design = fav.designs as unknown as DesignData | null;

        if (!design) return null;

        return {
          ...design,
          favorited_at: fav.created_at,
          favorite_id: fav.id,
        };
      })
      .filter((d): d is NonNullable<typeof d> => d !== null) || [];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link href="/account">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Heart className="h-8 w-8 text-red-500 fill-red-500" />
              My Favorites
            </h1>
            <p className="text-muted-foreground mt-1">
              {favoriteDesigns.length} design{favoriteDesigns.length !== 1 ? "s" : ""} saved
            </p>
          </div>
        </div>
      </div>

      {favoriteDesigns.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {favoriteDesigns.map((design) => (
            <Card
              key={design.id}
              className="overflow-hidden transition-all duration-300 hover:shadow-warm-lg hover:-translate-y-1 border-border/50 group"
            >
              <Link href={`/designs/${design.slug}`} className="block">
                {/* Image container */}
                <div className="relative aspect-square bg-muted overflow-hidden">
                  {design.preview_path ? (
                    <Image
                      src={design.preview_path}
                      alt={design.title}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      No preview
                    </div>
                  )}
                  {/* Subtle gradient overlay on hover */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                  {/* Favorite button overlay */}
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <FavoriteButton
                      designId={design.id}
                      initialFavorited={true}
                      variant="outline"
                      className="bg-background/80 backdrop-blur-sm"
                    />
                  </div>
                </div>
              </Link>

              <CardContent className="p-4">
                <Link href={`/designs/${design.slug}`}>
                  <h3 className="font-heading font-medium truncate group-hover:text-primary transition-colors duration-200">
                    {design.title}
                  </h3>
                </Link>

                <div className="flex flex-wrap gap-1.5 mt-3">
                  {design.difficulty && (
                    <Badge variant="secondary" className="text-xs">
                      {capitalize(design.difficulty)}
                    </Badge>
                  )}
                  {design.style && (
                    <Badge variant="outline" className="text-xs">
                      {capitalize(design.style)}
                    </Badge>
                  )}
                </div>

                <p className="text-xs text-muted-foreground mt-3">
                  Saved {formatDate(design.favorited_at)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <Heart className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
          <h2 className="text-xl font-semibold mb-2">No favorites yet</h2>
          <p className="text-muted-foreground mb-6">
            Start exploring designs and save your favorites by clicking the heart icon.
          </p>
          <Button asChild>
            <Link href="/designs">
              <Search className="h-4 w-4 mr-2" />
              Browse Designs
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
