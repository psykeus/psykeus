import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ slug: string }>;
}

/**
 * GET /api/designs/[slug]/preview
 * Get a signed URL to the primary file's original image for high-quality preview
 * Returns the original file URL instead of the pre-generated thumbnail
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { slug } = await params;
  const supabase = await createClient();

  // Get design with primary file info
  const { data: design, error: designError } = await supabase
    .from("designs")
    .select("id, primary_file_id, preview_path")
    .eq("slug", slug)
    .eq("is_public", true)
    .single();

  if (designError || !design) {
    return NextResponse.json({ error: "Design not found" }, { status: 404 });
  }

  // If no primary file, return the pre-generated preview path
  if (!design.primary_file_id) {
    return NextResponse.json({
      url: design.preview_path,
      fileType: null,
      isOriginal: false,
    });
  }

  // Get the primary file
  const { data: file, error: fileError } = await supabase
    .from("design_files")
    .select("id, storage_path, file_type, original_filename")
    .eq("id", design.primary_file_id)
    .eq("design_id", design.id)
    .eq("is_active", true)
    .single();

  if (fileError || !file) {
    // Fall back to pre-generated preview
    return NextResponse.json({
      url: design.preview_path,
      fileType: null,
      isOriginal: false,
    });
  }

  const fileType = file.file_type?.toLowerCase() || "";

  // For file types that can't be displayed directly, return pre-generated preview
  const NEEDS_GENERATED_PREVIEW = ["dxf", "dwg", "ai", "eps", "stl", "obj", "gltf", "glb", "3mf"];
  if (NEEDS_GENERATED_PREVIEW.includes(fileType)) {
    return NextResponse.json({
      url: design.preview_path,
      fileType: file.file_type,
      isOriginal: false,
    });
  }

  // For directly viewable files (images, SVG, PDF), return signed URL to original
  const serviceSupabase = createServiceClient();
  const { data: signedUrl, error: urlError } = await serviceSupabase.storage
    .from("designs")
    .createSignedUrl(file.storage_path, 3600);

  if (urlError || !signedUrl) {
    console.error("Failed to generate preview URL:", {
      slug,
      fileId: file.id,
      storagePath: file.storage_path,
      error: urlError?.message,
    });
    // Fall back to pre-generated preview
    return NextResponse.json({
      url: design.preview_path,
      fileType: file.file_type,
      isOriginal: false,
    });
  }

  return NextResponse.json({
    url: signedUrl.signedUrl,
    fileType: file.file_type,
    isOriginal: true,
  });
}
