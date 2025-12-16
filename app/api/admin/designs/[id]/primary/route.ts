import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getUser, isAdmin } from "@/lib/auth";
import { z } from "zod";
import { generatePreview, supportsPreview } from "@/lib/preview-generator";
import { isImageFile, getFileExtension } from "@/lib/file-types";
import crypto from "crypto";
import {
  validateParams,
  parseJsonBody,
  forbiddenResponse,
  notFoundResponse,
  handleDbError,
} from "@/lib/api/helpers";

const paramsSchema = z.object({
  id: z.string().uuid(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

const bodySchema = z.object({
  fileId: z.string().uuid(),
  regeneratePreview: z.boolean().optional().default(true),
});

/**
 * PUT /api/admin/designs/[id]/primary
 * Set the primary file for a design (used for preview generation and AI metadata)
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const user = await getUser();
  if (!user || !isAdmin(user)) {
    return forbiddenResponse("Admin access required");
  }

  const paramsResult = await validateParams(params, paramsSchema);
  if (!paramsResult.success) return paramsResult.response!;

  const { id: designId } = paramsResult.data!;
  const supabase = createServiceClient();

  // Parse body
  const bodyResult = await parseJsonBody(request);
  if (!bodyResult.success) return bodyResult.response!;

  const bodyValidation = bodySchema.safeParse(bodyResult.data);
  if (!bodyValidation.success) {
    return NextResponse.json({ error: "Invalid file ID" }, { status: 400 });
  }

  const { fileId } = bodyValidation.data;

  // Verify design exists
  const { data: design, error: designError } = await supabase
    .from("designs")
    .select("id, primary_file_id")
    .eq("id", designId)
    .single();

  if (designError || !design) {
    return notFoundResponse("Design");
  }

  const { regeneratePreview } = bodyValidation.data;

  // Verify file exists and belongs to this design - get full file info
  const { data: file, error: fileError } = await supabase
    .from("design_files")
    .select("id, file_role, file_type, storage_path, original_filename")
    .eq("id", fileId)
    .eq("design_id", designId)
    .eq("is_active", true)
    .single();

  if (fileError || !file) {
    return notFoundResponse("File");
  }

  // Update the previous primary file to variant (if different)
  if (design.primary_file_id && design.primary_file_id !== fileId) {
    await supabase
      .from("design_files")
      .update({ file_role: "variant" })
      .eq("id", design.primary_file_id);
  }

  // Set the new file as primary
  await supabase
    .from("design_files")
    .update({ file_role: "primary" })
    .eq("id", fileId);

  // Regenerate preview from the new primary file
  let newPreviewPath: string | null = null;

  if (regeneratePreview) {
    try {
      // Download the file from storage
      const { data: fileData, error: downloadError } = await supabase.storage
        .from("designs")
        .download(file.storage_path);

      if (!downloadError && fileData) {
        const fileBuffer = Buffer.from(await fileData.arrayBuffer());
        const ext = `.${file.file_type}`.toLowerCase();

        // For image files, use them directly as preview
        if (isImageFile(file.original_filename || `file${ext}`)) {
          try {
            const sharp = (await import("sharp")).default;
            const previewBuffer = await sharp(fileBuffer)
              .resize(800, 800, { fit: "inside", withoutEnlargement: true })
              .png()
              .toBuffer();

            // Upload new preview
            const contentHash = crypto.createHash("sha256").update(fileBuffer).digest("hex");
            const timestamp = Date.now().toString(36);
            const previewFilename = `preview-${designId.slice(0, 8)}-${contentHash.slice(0, 8)}-${timestamp}.png`;

            const { error: previewUploadError } = await supabase.storage
              .from("previews")
              .upload(previewFilename, previewBuffer, {
                contentType: "image/png",
                upsert: true,
              });

            if (!previewUploadError) {
              const { data: publicUrl } = supabase.storage
                .from("previews")
                .getPublicUrl(previewFilename);
              newPreviewPath = publicUrl.publicUrl;
            }
          } catch (imgError) {
            console.error("Image preview processing error:", imgError);
          }
        } else if (supportsPreview(ext)) {
          // Generate preview from design file
          const previewResult = await generatePreview(
            fileBuffer,
            ext,
            file.original_filename || `file${ext}`
          );

          if (previewResult.success && previewResult.buffer) {
            const contentHash = crypto.createHash("sha256").update(fileBuffer).digest("hex");
            const timestamp = Date.now().toString(36);
            const previewFilename = `preview-${designId.slice(0, 8)}-${contentHash.slice(0, 8)}-${timestamp}.png`;

            const { error: previewUploadError } = await supabase.storage
              .from("previews")
              .upload(previewFilename, previewResult.buffer, {
                contentType: "image/png",
                upsert: true,
              });

            if (!previewUploadError) {
              const { data: publicUrl } = supabase.storage
                .from("previews")
                .getPublicUrl(previewFilename);
              newPreviewPath = publicUrl.publicUrl;
            }
          }
        }
      }
    } catch (previewError) {
      console.error("Preview regeneration error:", previewError);
    }
  }

  // Update design's primary_file_id, current_version_id, and optionally preview_path
  const updateData: Record<string, unknown> = {
    primary_file_id: fileId,
    current_version_id: fileId,
  };

  if (newPreviewPath) {
    updateData.preview_path = newPreviewPath;
  }

  const { error: updateError } = await supabase
    .from("designs")
    .update(updateData)
    .eq("id", designId);

  if (updateError) {
    return handleDbError(updateError, "update primary file");
  }

  return NextResponse.json({
    message: "Primary file updated successfully",
    primaryFileId: fileId,
    previewPath: newPreviewPath || undefined,
  });
}
