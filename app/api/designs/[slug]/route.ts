import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { SlugRouteParams } from "@/lib/types";
import { notFoundResponse } from "@/lib/api/helpers";

export async function GET(request: NextRequest, { params }: SlugRouteParams) {
  const { slug } = await params;
  const supabase = await createClient();

  // Fetch design with current version and tags
  // Only select fields needed by the detail page to reduce payload size
  const { data: design, error } = await supabase
    .from("designs")
    .select(
      `
      id,
      slug,
      title,
      description,
      preview_path,
      project_type,
      difficulty,
      categories,
      style,
      approx_dimensions,
      metadata_json,
      current_version_id,
      primary_file_id,
      created_at,
      updated_at,
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
    return notFoundResponse("Design");
  }

  // Flatten tags - design_tags is an array of { tags: Tag | Tag[] }
  // Supabase returns single relations as objects, but TypeScript infers arrays
  const tags = design.design_tags?.map((dt: { tags: { id: string; name: string } | { id: string; name: string }[] }) =>
    Array.isArray(dt.tags) ? dt.tags[0] : dt.tags
  ).filter(Boolean) ?? [];

  // Fetch similar designs (same category or tags)
  let similarDesigns: Array<{
    id: string;
    slug: string;
    title: string;
    preview_path: string;
  }> = [];

  if (design.categories && design.categories.length > 0) {
    const { data: similar } = await supabase
      .from("designs")
      .select("id, slug, title, preview_path")
      .eq("is_public", true)
      .neq("id", design.id)
      .overlaps("categories", design.categories)
      .limit(4);

    similarDesigns = similar ?? [];
  }

  return NextResponse.json(
    {
      design: {
        ...design,
        tags,
        design_tags: undefined,
      },
      similarDesigns,
    },
    {
      headers: {
        // Cache design details for 5 min, allow stale-while-revalidate for 1 hour
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
      },
    }
  );
}
