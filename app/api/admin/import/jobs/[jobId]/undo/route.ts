import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getUser, isAdmin } from "@/lib/auth";
import * as jobService from "@/lib/services/import-job-service";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ jobId: string }>;
}

/**
 * POST /api/admin/import/jobs/[jobId]/undo
 * Undo an import by deleting all designs created by this job
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const user = await getUser();
  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  try {
    const { jobId } = await params;
    const job = await jobService.getImportJob(jobId);

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // Don't allow undoing active jobs
    if (["scanning", "processing"].includes(job.status)) {
      return NextResponse.json(
        { error: "Cannot undo an active job. Cancel it first." },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // Get all designs created by this import job
    const { data: designs, error: fetchError } = await supabase
      .from("designs")
      .select("id, slug")
      .eq("import_job_id", jobId);

    if (fetchError) {
      throw new Error(`Failed to fetch designs: ${fetchError.message}`);
    }

    if (!designs || designs.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No designs to undo",
        deleted_count: 0,
      });
    }

    const designIds = designs.map((d) => d.id);

    // Delete design files from storage
    for (const designId of designIds) {
      // Delete files from 'designs' bucket
      const { data: filesList } = await supabase.storage
        .from("designs")
        .list(`files/${designId}`);

      if (filesList && filesList.length > 0) {
        const filePaths = filesList.map((f) => `files/${designId}/${f.name}`);
        await supabase.storage.from("designs").remove(filePaths);
      }
    }

    // Delete preview images from 'previews' bucket
    // Previews are named with the slug, so we need to find and delete them
    for (const design of designs) {
      const { data: previewFiles } = await supabase.storage
        .from("previews")
        .list("", { search: design.slug });

      if (previewFiles && previewFiles.length > 0) {
        const previewPaths = previewFiles
          .filter((f) => f.name.startsWith(design.slug))
          .map((f) => f.name);
        if (previewPaths.length > 0) {
          await supabase.storage.from("previews").remove(previewPaths);
        }
      }
    }

    // Delete design_tags associations
    await supabase
      .from("design_tags")
      .delete()
      .in("design_id", designIds);

    // Delete design_files records
    await supabase
      .from("design_files")
      .delete()
      .in("design_id", designIds);

    // Delete the designs themselves
    const { error: deleteError } = await supabase
      .from("designs")
      .delete()
      .in("id", designIds);

    if (deleteError) {
      throw new Error(`Failed to delete designs: ${deleteError.message}`);
    }

    // Update import items to remove design references
    await supabase
      .from("import_items")
      .update({
        design_id: null,
        design_file_id: null,
        status: "pending",
        error_message: "Undone by user",
      })
      .eq("job_id", jobId)
      .eq("status", "completed");

    // Reset job counters
    await supabase
      .from("import_jobs")
      .update({
        files_succeeded: 0,
        files_processed: 0,
        status: "pending",
      })
      .eq("id", jobId);

    return NextResponse.json({
      success: true,
      message: `Successfully undone import: deleted ${designIds.length} design(s)`,
      deleted_count: designIds.length,
    });
  } catch (error) {
    console.error("Undo import error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to undo import" },
      { status: 500 }
    );
  }
}
