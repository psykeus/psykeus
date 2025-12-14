import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getUser, isAdmin } from "@/lib/auth";
import { isSupportedExtension, getFileExtension } from "@/lib/file-types";
import type { FileRole, DesignFileWithMeta } from "@/lib/types";
import crypto from "crypto";
import { z } from "zod";

const paramsSchema = z.object({
  id: z.string().uuid(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/admin/designs/[id]/files
 * List all files for a design
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const user = await getUser();
  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const rawParams = await params;
  const validation = paramsSchema.safeParse(rawParams);
  if (!validation.success) {
    return NextResponse.json({ error: "Invalid design ID" }, { status: 400 });
  }

  const { id: designId } = validation.data;
  const supabase = createServiceClient();

  // Get design to verify it exists
  const { data: design, error: designError } = await supabase
    .from("designs")
    .select("id, title, primary_file_id")
    .eq("id", designId)
    .single();

  if (designError || !design) {
    return NextResponse.json({ error: "Design not found" }, { status: 404 });
  }

  // Get all active files for the design
  const { data: files, error: filesError } = await supabase
    .from("design_files")
    .select("*")
    .eq("design_id", designId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (filesError) {
    return NextResponse.json({ error: "Failed to fetch files" }, { status: 500 });
  }

  // Group files by role
  const grouped = {
    primary: files?.find(f => f.file_role === "primary") || null,
    variants: files?.filter(f => f.file_role === "variant") || [],
    components: files?.filter(f => f.file_role === "component") || [],
  };

  return NextResponse.json({
    files: files as DesignFileWithMeta[],
    grouped,
    primaryFileId: design.primary_file_id,
    totalFiles: files?.length || 0,
  });
}

/**
 * POST /api/admin/designs/[id]/files
 * Add new file(s) to an existing design
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const user = await getUser();
  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const rawParams = await params;
  const validation = paramsSchema.safeParse(rawParams);
  if (!validation.success) {
    return NextResponse.json({ error: "Invalid design ID" }, { status: 400 });
  }

  const { id: designId } = validation.data;
  const supabase = createServiceClient();

  // Verify design exists
  const { data: design, error: designError } = await supabase
    .from("designs")
    .select("id, title")
    .eq("id", designId)
    .single();

  if (designError || !design) {
    return NextResponse.json({ error: "Design not found" }, { status: 404 });
  }

  // Parse form data
  const formData = await request.formData();
  const files = formData.getAll("files") as File[];
  const fileRole = (formData.get("fileRole") as FileRole) || "component";
  const fileGroup = (formData.get("fileGroup") as string) || null;

  if (!files || files.length === 0) {
    return NextResponse.json({ error: "No files provided" }, { status: 400 });
  }

  // Get current max sort_order
  const { data: existingFiles } = await supabase
    .from("design_files")
    .select("sort_order")
    .eq("design_id", designId)
    .eq("is_active", true)
    .order("sort_order", { ascending: false })
    .limit(1);

  let nextSortOrder = (existingFiles?.[0]?.sort_order ?? -1) + 1;

  const results: Array<{
    success: boolean;
    filename: string;
    fileId?: string;
    error?: string;
  }> = [];

  for (const file of files) {
    try {
      // Validate file type
      if (!isSupportedExtension(file.name)) {
        results.push({
          success: false,
          filename: file.name,
          error: `Unsupported file type: ${getFileExtension(file.name)}`,
        });
        continue;
      }

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const contentHash = crypto.createHash("sha256").update(buffer).digest("hex");

      // Check for duplicate within this design
      const { data: existingFile } = await supabase
        .from("design_files")
        .select("id")
        .eq("design_id", designId)
        .eq("content_hash", contentHash)
        .eq("is_active", true)
        .single();

      if (existingFile) {
        results.push({
          success: false,
          filename: file.name,
          error: "This file already exists in this design",
        });
        continue;
      }

      const fileExt = getFileExtension(file.name);
      const baseName = file.name.replace(/\.[^/.]+$/, "");
      const fileId = crypto.randomUUID();

      // Upload to storage
      const storagePath = `files/${designId}/${fileId}${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from("designs")
        .upload(storagePath, buffer, {
          contentType: file.type || "application/octet-stream",
          upsert: false,
        });

      if (uploadError) {
        results.push({
          success: false,
          filename: file.name,
          error: `Upload failed: ${uploadError.message}`,
        });
        continue;
      }

      // Create design_files record
      const { data: newFile, error: insertError } = await supabase
        .from("design_files")
        .insert({
          id: fileId,
          design_id: designId,
          storage_path: storagePath,
          file_type: fileExt.slice(1),
          size_bytes: buffer.length,
          content_hash: contentHash,
          version_number: 1,
          is_active: true,
          file_role: fileRole,
          file_group: fileGroup,
          original_filename: file.name,
          display_name: baseName,
          sort_order: nextSortOrder++,
        })
        .select()
        .single();

      if (insertError || !newFile) {
        // Clean up uploaded file
        await supabase.storage.from("designs").remove([storagePath]);
        results.push({
          success: false,
          filename: file.name,
          error: `Database error: ${insertError?.message}`,
        });
        continue;
      }

      results.push({
        success: true,
        filename: file.name,
        fileId: newFile.id,
      });

    } catch (err) {
      results.push({
        success: false,
        filename: file.name,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;

  return NextResponse.json({
    message: `Added ${successCount} file(s), ${failCount} failed`,
    results,
    successCount,
    failCount,
  });
}
