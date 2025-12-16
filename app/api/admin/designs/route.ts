import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUser, isAdmin } from "@/lib/auth";
import { slugify } from "@/lib/utils";
import { escapeIlikePattern } from "@/lib/validations";
import {
  validateRateLimit,
  parsePaginationParams,
  parseJsonBody,
  forbiddenResponse,
  handleDbError,
} from "@/lib/api/helpers";

// GET - List all designs for admin (includes non-public)
export async function GET(request: NextRequest) {
  const user = await getUser();

  if (!user || !isAdmin(user)) {
    return forbiddenResponse("Admin access required");
  }

  const rateLimit = validateRateLimit(request, user.id, "admin");
  if (!rateLimit.success) return rateLimit.response!;

  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const { page, pageSize, from, to } = parsePaginationParams(searchParams, { defaultPageSize: 50 });
  const q = searchParams.get("q") ?? "";

  let query = supabase
    .from("designs")
    .select("*", { count: "exact" })
    .order("updated_at", { ascending: false });

  if (q) {
    const escapedQ = escapeIlikePattern(q);
    query = query.or(`title.ilike.%${escapedQ}%,description.ilike.%${escapedQ}%`);
  }

  const { data, error, count } = await query.range(from, to);

  if (error) {
    return handleDbError(error, "fetch designs", rateLimit.headers);
  }

  return NextResponse.json(
    { data, page, pageSize, total: count ?? 0 },
    { headers: rateLimit.headers }
  );
}

// POST - Create a new design
export async function POST(request: NextRequest) {
  const user = await getUser();

  if (!user || !isAdmin(user)) {
    return forbiddenResponse("Admin access required");
  }

  const bodyResult = await parseJsonBody<{
    title?: string;
    description?: string;
    preview_path?: string;
    project_type?: string;
    difficulty?: string;
    categories?: string[];
    style?: string;
    approx_dimensions?: string;
    is_public?: boolean;
  }>(request);
  if (!bodyResult.success) return bodyResult.response!;

  const {
    title,
    description,
    preview_path,
    project_type,
    difficulty,
    categories,
    style,
    approx_dimensions,
    is_public,
  } = bodyResult.data!;

  if (!title || !preview_path) {
    return NextResponse.json(
      { error: "Title and preview_path are required" },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  // Generate unique slug
  let slug = slugify(title);
  const { data: existingSlug } = await supabase
    .from("designs")
    .select("id")
    .eq("slug", slug)
    .single();

  if (existingSlug) {
    slug = `${slug}-${Date.now()}`;
  }

  const { data: design, error } = await supabase
    .from("designs")
    .insert({
      slug,
      title,
      description,
      preview_path,
      project_type,
      difficulty,
      categories,
      style,
      approx_dimensions,
      is_public: is_public ?? true,
    })
    .select()
    .single();

  if (error) {
    return handleDbError(error, "create design");
  }

  return NextResponse.json({ design }, { status: 201 });
}
