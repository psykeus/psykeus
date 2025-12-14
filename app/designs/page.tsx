import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { DesignCard } from "@/components/DesignCard";
import { FilterBar } from "@/components/FilterBar";
import { Pagination } from "@/components/Pagination";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getUser } from "@/lib/auth";
import { isFavoritesEnabled } from "@/lib/feature-flags";
import type { DesignListItem } from "@/lib/types";

interface SearchParams {
  q?: string;
  tag?: string;
  difficulty?: string;
  category?: string;
  style?: string;
  fileType?: string;
  page?: string;
}

interface Props {
  searchParams: Promise<SearchParams>;
}

// Using DesignListItem from @/lib/types

async function DesignGrid({ searchParams }: { searchParams: SearchParams }) {
  const supabase = await createClient();

  const page = Number(searchParams.page ?? "1");
  const pageSize = 24;

  // Build select clause - include design_files if filtering by file type
  const selectClause = searchParams.fileType
    ? `id, slug, title, preview_path, difficulty, categories, style, access_level,
       design_files!inner(file_type, is_active)`
    : "id, slug, title, preview_path, difficulty, categories, style, access_level";

  let query = supabase
    .from("designs")
    .select(selectClause, { count: "exact" })
    .eq("is_public", true)
    .order("created_at", { ascending: false });

  if (searchParams.q) {
    query = query.or(
      `title.ilike.%${searchParams.q}%,description.ilike.%${searchParams.q}%`
    );
  }

  if (searchParams.difficulty) {
    query = query.eq("difficulty", searchParams.difficulty);
  }

  if (searchParams.category) {
    query = query.contains("categories", [searchParams.category]);
  }

  if (searchParams.style) {
    query = query.eq("style", searchParams.style);
  }

  if (searchParams.fileType) {
    query = query
      .eq("design_files.is_active", true)
      .eq("design_files.file_type", searchParams.fileType);
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data: designs, count } = await query.range(from, to);

  const totalPages = Math.ceil((count ?? 0) / pageSize);

  // Cast to expected type (Supabase type inference doesn't handle dynamic select well)
  const typedDesigns = designs as DesignListItem[] | null;

  // Fetch user favorites in a single query (avoids N API calls from FavoriteButton)
  const user = await getUser();
  const favoritesEnabled = await isFavoritesEnabled();
  let userFavorites = new Set<string>();

  if (user && favoritesEnabled && typedDesigns?.length) {
    const designIds = typedDesigns.map((d) => d.id);
    const { data: favorites } = await supabase
      .from("user_favorites")
      .select("design_id")
      .eq("user_id", user.id)
      .in("design_id", designIds);

    userFavorites = new Set(favorites?.map((f) => f.design_id) || []);
  }

  return (
    <>
      {typedDesigns && typedDesigns.length > 0 ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {typedDesigns.map((design, index) => (
              <DesignCard
                key={design.id}
                design={design}
                isFavorited={userFavorites.has(design.id)}
                priority={index < 4} // First 4 cards are above the fold
              />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="mt-8">
              <Pagination currentPage={page} totalPages={totalPages} />
            </div>
          )}
        </>
      ) : (
        <Card className="text-center py-12">
          <CardContent className="pt-6">
            <p className="text-muted-foreground">No designs found matching your criteria.</p>
            <p className="text-sm text-muted-foreground mt-2">
              Try adjusting your filters or search terms.
            </p>
          </CardContent>
        </Card>
      )}
    </>
  );
}

export default async function DesignsPage({ searchParams }: Props) {
  const params = await searchParams;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="font-heading text-3xl font-bold mb-8">Browse Designs</h1>

      <FilterBar />

      <Suspense
        fallback={
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <Skeleton className="aspect-square w-full" />
                <CardContent className="p-4">
                  <Skeleton className="h-5 w-3/4 mb-3" />
                  <div className="flex gap-2">
                    <Skeleton className="h-5 w-16" />
                    <Skeleton className="h-5 w-20" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        }
      >
        <DesignGrid searchParams={params} />
      </Suspense>
    </div>
  );
}
