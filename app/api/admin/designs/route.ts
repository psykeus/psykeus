import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUser, isAdmin } from "@/lib/auth";
import { slugify } from "@/lib/utils";
import { escapeIlikePattern } from "@/lib/validations";
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from "@/lib/rate-limit";

// GET - List all designs for admin (includes non-public)
export async function GET(request: NextRequest) {
  const user = await getUser();

  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  // Rate limiting
  const identifier = getClientIdentifier(request, user.id);
  const rateLimit = checkRateLimit(identifier, RATE_LIMITS.admin);

  if (!rateLimit.success) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: rateLimit.headers }
    );
  }

  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get("page") ?? "1");
  const pageSize = Number(searchParams.get("pageSize") ?? "50");
  const q = searchParams.get("q") ?? "";

  let query = supabase
    .from("designs")
    .select("*", { count: "exact" })
    .order("updated_at", { ascending: false });

  if (q) {
    // Escape special ILIKE pattern characters to prevent SQL injection
    const escapedQ = escapeIlikePattern(q);
    query = query.or(`title.ilike.%${escapedQ}%,description.ilike.%${escapedQ}%`);
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
    { data, page, pageSize, total: count ?? 0 },
    { headers: rateLimit.headers }
  );
}

// POST - Create a new design
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const user = await getUser();

  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();
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
  } = body;

  if (!title || !preview_path) {
    return NextResponse.json(
      { error: "Title and preview_path are required" },
      { status: 400 }
    );
  }

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
    console.error("Error creating design:", error);
    return NextResponse.json(
      { error: "Failed to create design" },
      { status: 500 }
    );
  }

  return NextResponse.json({ design }, { status: 201 });
}
