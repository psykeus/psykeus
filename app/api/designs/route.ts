import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from "@/lib/rate-limit";
import { browseDesignsSchema, parseSearchParams, formatZodError } from "@/lib/validations";
import { z } from "zod";

export async function GET(request: NextRequest) {
  // Rate limiting
  const identifier = getClientIdentifier(request);
  const rateLimit = checkRateLimit(identifier, RATE_LIMITS.browse);

  if (!rateLimit.success) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429, headers: rateLimit.headers }
    );
  }

  // Validate and sanitize input
  const { searchParams } = new URL(request.url);
  let params: z.infer<typeof browseDesignsSchema>;

  try {
    params = parseSearchParams(searchParams, browseDesignsSchema);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: `Invalid parameters: ${formatZodError(error)}` },
        { status: 400, headers: rateLimit.headers }
      );
    }
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400, headers: rateLimit.headers }
    );
  }

  const { q, tag, difficulty, category, page, pageSize } = params;

  const supabase = await createClient();

  let query = supabase
    .from("designs")
    .select(
      `
      id,
      slug,
      title,
      preview_path,
      difficulty,
      categories,
      style,
      project_type,
      access_level
    `,
      { count: "exact" }
    )
    .eq("is_public", true)
    .order("created_at", { ascending: false });

  // Use full-text search on the generated fts_vector column
  // This searches both title and description efficiently using the GIN index
  if (q) {
    query = query.textSearch("fts_vector", q, {
      type: "websearch",
      config: "english",
    });
  }

  if (difficulty) {
    query = query.eq("difficulty", difficulty);
  }

  if (category) {
    query = query.contains("categories", [category]);
  }

  // Tag filtering - optimized to use single join query
  if (tag) {
    // Use a single query with inner join through design_tags
    const { data: designIds } = await supabase
      .from("design_tags")
      .select("design_id, tags!inner(name)")
      .eq("tags.name", tag);

    if (designIds && designIds.length > 0) {
      query = query.in(
        "id",
        designIds.map((d) => d.design_id)
      );
    } else {
      return NextResponse.json(
        { data: [], page, pageSize, total: 0 },
        { headers: rateLimit.headers }
      );
    }
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await query.range(from, to);

  if (error) {
    console.error("Error fetching designs:", error);
    return NextResponse.json(
      { error: "Failed to load designs" },
      { status: 500, headers: rateLimit.headers }
    );
  }

  return NextResponse.json(
    {
      data,
      page,
      pageSize,
      total: count ?? 0,
    },
    {
      headers: {
        ...rateLimit.headers,
        // Cache public design listings for 60s, allow stale-while-revalidate for 5 min
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    }
  );
}
