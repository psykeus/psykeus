import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getUser, isAdmin } from "@/lib/auth";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// PUT - Replace all tags for a design
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { id: designId } = await params;
  const supabase = createServiceClient();
  const user = await getUser();

  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { tags } = await request.json();

  if (!Array.isArray(tags)) {
    return NextResponse.json({ error: "Tags must be an array" }, { status: 400 });
  }

  // Delete existing tags for this design
  await supabase
    .from("design_tags")
    .delete()
    .eq("design_id", designId);

  // Add new tags
  const addedTags: string[] = [];
  for (const tagName of tags) {
    if (typeof tagName !== "string") continue;

    const normalizedTag = tagName.toLowerCase().trim();
    if (!normalizedTag) continue;

    // Get or create tag
    let tagId: string;
    const { data: existingTag } = await supabase
      .from("tags")
      .select("id")
      .eq("name", normalizedTag)
      .single();

    if (existingTag) {
      tagId = existingTag.id;
    } else {
      const { data: newTag, error: tagError } = await supabase
        .from("tags")
        .insert({ name: normalizedTag })
        .select("id")
        .single();

      if (tagError || !newTag) {
        console.error("Failed to create tag:", normalizedTag, tagError);
        continue;
      }
      tagId = newTag.id;
    }

    // Link tag to design
    const { error: linkError } = await supabase
      .from("design_tags")
      .insert({ design_id: designId, tag_id: tagId });

    if (!linkError) {
      addedTags.push(normalizedTag);
    }
  }

  // Get updated design with tags
  const { data: design } = await supabase
    .from("designs")
    .select(`
      id,
      design_tags (
        tags (id, name)
      )
    `)
    .eq("id", designId)
    .single();

  const designTags = design?.design_tags?.flatMap((dt: { tags: { id: string; name: string }[] | { id: string; name: string } }) =>
    Array.isArray(dt.tags) ? dt.tags : [dt.tags]
  ) || [];

  return NextResponse.json({
    message: `Updated tags for design`,
    tags: designTags,
  });
}
