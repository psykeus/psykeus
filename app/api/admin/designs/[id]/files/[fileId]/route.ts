import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getUser, isAdmin } from "@/lib/auth";
import type { UpdateFileRequest } from "@/lib/types";
import { z } from "zod";

const paramsSchema = z.object({
  id: z.string().uuid(),
  fileId: z.string().uuid(),
});

interface RouteParams {
  params: Promise<{ id: string; fileId: string }>;
}

/**
 * PATCH /api/admin/designs/[id]/files/[fileId]
 * Update file metadata (display_name, description, role, group, sort_order)
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const user = await getUser();
  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const rawParams = await params;
  const validation = paramsSchema.safeParse(rawParams);
  if (!validation.success) {
    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
  }

  const { id: designId, fileId } = validation.data;
  const supabase = createServiceClient();

  // Verify file exists and belongs to design
  const { data: existingFile, error: fileError } = await supabase
    .from("design_files")
    .select("id, design_id, file_role")
    .eq("id", fileId)
    .eq("design_id", designId)
    .eq("is_active", true)
    .single();

  if (fileError || !existingFile) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  // Parse update request
  const body: UpdateFileRequest = await request.json();

  // Build update object with only allowed fields
  const updateData: Record<string, unknown> = {};

  if (body.display_name !== undefined) {
    updateData.display_name = body.display_name;
  }
  if (body.file_description !== undefined) {
    updateData.file_description = body.file_description;
  }
  if (body.file_role !== undefined) {
    if (!["primary", "variant", "component"].includes(body.file_role)) {
      return NextResponse.json({ error: "Invalid file_role" }, { status: 400 });
    }
    updateData.file_role = body.file_role;
  }
  if (body.file_group !== undefined) {
    updateData.file_group = body.file_group;
  }
  if (body.sort_order !== undefined) {
    updateData.sort_order = body.sort_order;
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  // Update file
  const { data: updatedFile, error: updateError } = await supabase
    .from("design_files")
    .update(updateData)
    .eq("id", fileId)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json({ error: "Failed to update file" }, { status: 500 });
  }

  return NextResponse.json({
    message: "File updated successfully",
    file: updatedFile,
  });
}

/**
 * DELETE /api/admin/designs/[id]/files/[fileId]
 * Remove a file from a design (soft delete by setting is_active = false)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const user = await getUser();
  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const rawParams = await params;
  const validation = paramsSchema.safeParse(rawParams);
  if (!validation.success) {
    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
  }

  const { id: designId, fileId } = validation.data;
  const supabase = createServiceClient();

  // Get design to check if this is the primary file
  const { data: design, error: designError } = await supabase
    .from("designs")
    .select("id, primary_file_id, current_version_id")
    .eq("id", designId)
    .single();

  if (designError || !design) {
    return NextResponse.json({ error: "Design not found" }, { status: 404 });
  }

  // Verify file exists
  const { data: file, error: fileError } = await supabase
    .from("design_files")
    .select("id, storage_path, file_role")
    .eq("id", fileId)
    .eq("design_id", designId)
    .eq("is_active", true)
    .single();

  if (fileError || !file) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  // Count remaining active files
  const { count, error: countError } = await supabase
    .from("design_files")
    .select("id", { count: "exact", head: true })
    .eq("design_id", designId)
    .eq("is_active", true);

  if (countError) {
    return NextResponse.json({ error: "Failed to check file count" }, { status: 500 });
  }

  // Don't allow deleting the last file
  if ((count || 0) <= 1) {
    return NextResponse.json(
      { error: "Cannot delete the last file. Delete the entire design instead." },
      { status: 400 }
    );
  }

  // Soft delete by setting is_active = false
  const { error: deleteError } = await supabase
    .from("design_files")
    .update({ is_active: false })
    .eq("id", fileId);

  if (deleteError) {
    return NextResponse.json({ error: "Failed to delete file" }, { status: 500 });
  }

  // If this was the primary file, reassign to another file
  if (design.primary_file_id === fileId || design.current_version_id === fileId) {
    // Find another active file to be primary
    const { data: newPrimary } = await supabase
      .from("design_files")
      .select("id")
      .eq("design_id", designId)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .limit(1)
      .single();

    if (newPrimary) {
      await supabase
        .from("designs")
        .update({
          primary_file_id: newPrimary.id,
          current_version_id: newPrimary.id,
        })
        .eq("id", designId);

      // Update the new primary file's role
      await supabase
        .from("design_files")
        .update({ file_role: "primary" })
        .eq("id", newPrimary.id);
    }
  }

  return NextResponse.json({
    message: "File deleted successfully",
    fileId,
  });
}
