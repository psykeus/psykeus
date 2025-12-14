import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import { isFavoritesEnabled } from "@/lib/feature-flags";

/**
 * GET /api/me/favorites
 * List all of the current user's favorited designs
 */
export async function GET(request: NextRequest) {
  // Check if feature is enabled
  if (!(await isFavoritesEnabled())) {
    return NextResponse.json(
      { error: "Favorites feature is disabled" },
      { status: 403 }
    );
  }

  const user = await getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  const supabase = await createClient();

  // Get pagination params
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = Math.min(parseInt(searchParams.get("limit") || "24"), 100);
  const offset = (page - 1) * limit;

  // Fetch user's favorites with design details
  const { data: favorites, error, count } = await supabase
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
        category,
        difficulty,
        is_public,
        created_at,
        tags,
        design_files (count)
      )
    `,
      { count: "exact" }
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("Error fetching favorites:", error);
    return NextResponse.json(
      { error: "Failed to load favorites" },
      { status: 500 }
    );
  }

  // Transform the data to a cleaner format
  type DesignData = {
    id: string;
    slug: string;
    title: string;
    description: string | null;
    preview_path: string | null;
    category: string | null;
    difficulty: string | null;
    is_public: boolean;
    created_at: string;
    tags: string[] | null;
    design_files: { count: number }[];
  };

  const designs = favorites
    ?.map((fav) => {
      const design = fav.designs as unknown as DesignData | null;

      if (!design) return null;

      return {
        ...design,
        favorited_at: fav.created_at,
        favorite_id: fav.id,
        file_count: design.design_files?.[0]?.count || 0,
      };
    })
    .filter((d): d is NonNullable<typeof d> => d !== null);

  return NextResponse.json({
    designs,
    pagination: {
      page,
      limit,
      total: count || 0,
      totalPages: Math.ceil((count || 0) / limit),
    },
  });
}
