import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isRelatedDesignsEnabled, getRelatedDesignsConfig } from "@/lib/feature-flags";

interface RouteParams {
  params: Promise<{ slug: string }>;
}

/**
 * GET /api/designs/[slug]/related
 * Get designs similar to the specified design using category and tag matching
 * Uses database-level scoring for optimal performance
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { slug } = await params;

  // Check if feature is enabled
  if (!(await isRelatedDesignsEnabled())) {
    return NextResponse.json(
      { error: "Related designs feature is disabled" },
      { status: 403 }
    );
  }

  const config = await getRelatedDesignsConfig();
  const supabase = await createClient();

  // Get the current design with its tag IDs (must be public)
  const { data: design, error: designError } = await supabase
    .from("designs")
    .select(`
      id,
      categories,
      design_tags (
        tag_id
      )
    `)
    .eq("slug", slug)
    .eq("is_public", true)
    .single();

  if (designError || !design) {
    return NextResponse.json({ error: "Design not found" }, { status: 404 });
  }

  // Extract tag IDs for the database function
  const tagIds = design.design_tags?.map((dt: { tag_id: string }) => dt.tag_id) || [];

  // Use the optimized database function for related designs
  const { data: related, error: relatedError } = await supabase
    .rpc("get_related_designs", {
      p_design_id: design.id,
      p_categories: design.categories || [],
      p_tag_ids: tagIds,
      p_limit: config.maxSuggestions,
    });

  if (relatedError) {
    console.error("Error fetching related designs:", relatedError);
    // Fallback to simple query if RPC fails (e.g., function not yet deployed)
    return await fallbackRelatedQuery(supabase, design, config.maxSuggestions);
  }

  return NextResponse.json({
    related: related || []
  }, {
    headers: {
      // Cache related designs for 5 minutes
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
}

/**
 * Fallback query if the RPC function is not available
 */
async function fallbackRelatedQuery(
  supabase: Awaited<ReturnType<typeof createClient>>,
  design: { id: string; categories: string[] | null },
  limit: number
) {
  let query = supabase
    .from("designs")
    .select("id, slug, title, preview_path, categories, difficulty, style")
    .eq("is_public", true)
    .neq("id", design.id);

  if (design.categories && design.categories.length > 0) {
    query = query.overlaps("categories", design.categories);
  }

  const { data, error } = await query.limit(limit);

  if (error) {
    return NextResponse.json({ related: [] });
  }

  const related = (data || []).map(d => ({
    ...d,
    similarity: 50, // Base score for fallback
  }));

  return NextResponse.json({ related });
}
