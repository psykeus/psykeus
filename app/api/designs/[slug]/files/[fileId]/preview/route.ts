import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { generatePreview } from "@/lib/preview-generator";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ slug: string; fileId: string }>;
}

// File types that need generated previews (can't be displayed directly in browser)
const NEEDS_GENERATED_PREVIEW = ["dxf", "dwg", "ai", "eps"];

/**
 * GET /api/designs/[slug]/files/[fileId]/preview
 * Get a signed URL to preview a specific file in a design
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { slug, fileId } = await params;
  const supabase = await createClient();

  // Verify design exists and is public
  const { data: design, error: designError } = await supabase
    .from("designs")
    .select("id, preview_path")
    .eq("slug", slug)
    .eq("is_public", true)
    .single();

  if (designError || !design) {
    return NextResponse.json({ error: "Design not found" }, { status: 404 });
  }

  // Get the file
  const { data: file, error: fileError } = await supabase
    .from("design_files")
    .select("id, storage_path, file_type, original_filename, file_role")
    .eq("id", fileId)
    .eq("design_id", design.id)
    .eq("is_active", true)
    .single();

  if (fileError || !file) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const fileType = file.file_type?.toLowerCase() || "";

  // For file types that need generated previews (DXF, DWG, AI, EPS)
  if (NEEDS_GENERATED_PREVIEW.includes(fileType)) {
    // Check if a preview already exists for this specific file
    const previewPath = `previews/${design.id}/${file.id}.png`;
    const serviceSupabase = createServiceClient();

    // Try to get existing preview
    const { data: existingPreview } = await serviceSupabase.storage
      .from("designs")
      .createSignedUrl(previewPath, 3600);

    if (existingPreview?.signedUrl) {
      return NextResponse.json({
        url: existingPreview.signedUrl,
        fileType: file.file_type,
        filename: file.original_filename,
        isGenerated: true,
      });
    }

    // Generate preview on-demand if it doesn't exist
    try {
      const { data: fileData, error: downloadError } = await serviceSupabase.storage
        .from("designs")
        .download(file.storage_path);

      if (downloadError || !fileData) {
        // Fall back to design's main preview if available
        if (design.preview_path) {
          return NextResponse.json({
            url: design.preview_path,
            fileType: file.file_type,
            filename: file.original_filename,
            isGenerated: true,
          });
        }
        return NextResponse.json({ error: "Failed to download file for preview" }, { status: 500 });
      }

      const buffer = Buffer.from(await fileData.arrayBuffer());
      const previewResult = await generatePreview(buffer, fileType, file.original_filename || "file");

      if (previewResult.success && previewResult.buffer) {
        // Upload the generated preview
        await serviceSupabase.storage
          .from("designs")
          .upload(previewPath, previewResult.buffer, {
            contentType: "image/png",
            upsert: true,
          });

        // Get signed URL for the new preview
        const { data: newPreview } = await serviceSupabase.storage
          .from("designs")
          .createSignedUrl(previewPath, 3600);

        if (newPreview?.signedUrl) {
          return NextResponse.json({
            url: newPreview.signedUrl,
            fileType: file.file_type,
            filename: file.original_filename,
            isGenerated: true,
          });
        }
      }

      // Fall back to design's main preview
      if (design.preview_path) {
        return NextResponse.json({
          url: design.preview_path,
          fileType: file.file_type,
          filename: file.original_filename,
          isGenerated: true,
        });
      }

      return NextResponse.json({ error: "Failed to generate preview" }, { status: 500 });
    } catch (error) {
      console.error("Preview generation error:", error);
      // Fall back to design's main preview
      if (design.preview_path) {
        return NextResponse.json({
          url: design.preview_path,
          fileType: file.file_type,
          filename: file.original_filename,
          isGenerated: true,
        });
      }
      return NextResponse.json({ error: "Preview generation failed" }, { status: 500 });
    }
  }

  // For directly viewable files (images, SVG, PDF, 3D models), return signed URL
  // Use service client to bypass storage RLS since we've already verified the design is public
  const serviceSupabase = createServiceClient();
  const { data: signedUrl, error: urlError } = await serviceSupabase.storage
    .from("designs")
    .createSignedUrl(file.storage_path, 3600);

  if (urlError || !signedUrl) {
    console.error("Failed to generate preview URL:", {
      fileId,
      storagePath: file.storage_path,
      error: urlError?.message,
    });
    return NextResponse.json(
      { error: "Failed to generate preview URL" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    url: signedUrl.signedUrl,
    fileType: file.file_type,
    filename: file.original_filename,
  });
}
