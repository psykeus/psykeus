import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getUser, isAdmin } from "@/lib/auth";

// GET - Get all tags with usage count
export async function GET() {
  const supabase = createServiceClient();
  const user = await getUser();

  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { data: tags, error } = await supabase
    .from("tags")
    .select(`
      id,
      name,
      design_tags (count)
    `)
    .order("name");

  if (error) {
    console.error("Error fetching tags:", error);
    return NextResponse.json({ error: "Failed to fetch tags" }, { status: 500 });
  }

  // Transform to include count
  const tagsWithCount = tags?.map((tag) => ({
    id: tag.id,
    name: tag.name,
    count: tag.design_tags?.[0]?.count || 0,
  }));

  return NextResponse.json(
    { tags: tagsWithCount },
    {
      headers: {
        // Private cache for admin users, 60s max age
        "Cache-Control": "private, max-age=60",
      },
    }
  );
}

// POST - Create a new tag or get existing
export async function POST(request: NextRequest) {
  const supabase = createServiceClient();
  const user = await getUser();

  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { name } = await request.json();

  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "Tag name is required" }, { status: 400 });
  }

  // Normalize tag name (lowercase, trim)
  const normalizedName = name.toLowerCase().trim();

  if (normalizedName.length === 0) {
    return NextResponse.json({ error: "Tag name cannot be empty" }, { status: 400 });
  }

  // Try to find existing tag first
  const { data: existing } = await supabase
    .from("tags")
    .select("id, name")
    .eq("name", normalizedName)
    .single();

  if (existing) {
    return NextResponse.json({ tag: existing, created: false });
  }

  // Create new tag
  const { data: newTag, error } = await supabase
    .from("tags")
    .insert({ name: normalizedName })
    .select()
    .single();

  if (error) {
    console.error("Error creating tag:", error);
    return NextResponse.json({ error: "Failed to create tag" }, { status: 500 });
  }

  return NextResponse.json({ tag: newTag, created: true });
}
