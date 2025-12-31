import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import * as jobService from "@/lib/services/import-job-service";
import * as itemService from "@/lib/services/import-item-service";
import { selectPrimaryFile, determineFileRole } from "@/lib/import/project-detector";
import type { CreateImportJobRequest, ScannedFile, DetectedProjectPreview, ProjectRole } from "@/lib/types/import";
import { requireAdminApi, parseJsonBody, handleDbError } from "@/lib/api/helpers";

export const runtime = "nodejs";

/**
 * GET /api/admin/import/jobs
 * List all import jobs
 */
export async function GET(request: NextRequest) {
  const adminResult = await requireAdminApi();
  if (adminResult.response) return adminResult.response;

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status")?.split(",").filter(Boolean);
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");

    const { jobs, total } = await jobService.listImportJobs({
      status: status as never,
      limit,
      offset,
    });

    return NextResponse.json({
      jobs,
      total,
      page: Math.floor(offset / limit) + 1,
      per_page: limit,
      total_pages: Math.ceil(total / limit),
    });
  } catch (error) {
    return handleDbError(error, "list import jobs");
  }
}

/**
 * POST /api/admin/import/jobs
 * Create a new import job
 */
export async function POST(request: NextRequest) {
  const adminResult = await requireAdminApi();
  if (adminResult.response) return adminResult.response;
  const user = adminResult.user;

  try {
    const bodyResult = await parseJsonBody<CreateImportJobRequest & {
      selected_files?: ScannedFile[];
      detected_projects?: DetectedProjectPreview[];
    }>(request);
    if (!bodyResult.success) return bodyResult.response!;

    const body = bodyResult.data!;

    if (!body.source_type) {
      return NextResponse.json(
        { error: "source_type is required" },
        { status: 400 }
      );
    }

    if (!["folder", "zip", "upload"].includes(body.source_type)) {
      return NextResponse.json(
        { error: "Invalid source_type. Must be: folder, zip, or upload" },
        { status: 400 }
      );
    }

    const job = await jobService.createImportJob(user.id, body);
    const supabase = createServiceClient();

    // If detected_projects were provided, create project records and import items with proper grouping
    if (body.detected_projects && body.detected_projects.length > 0) {
      let totalFiles = 0;

      for (const project of body.detected_projects) {
        // Create the detected project record
        const { data: projectRecord, error: projectError } = await supabase
          .from("import_detected_projects")
          .insert({
            job_id: job.id,
            inferred_name: project.inferred_name,
            file_count: project.files.length,
            detection_reason: project.detection_reason,
            confidence: project.confidence,
            user_confirmed: true, // User selected this project
            should_merge: true,
          })
          .select()
          .single();

        if (projectError) {
          console.error("Failed to create detected project:", projectError);
          continue;
        }

        // Determine primary file and roles for each file
        const primaryFile = selectPrimaryFile(project.files);

        // Build project assignments map
        const projectAssignments = new Map<string, { projectId: string; role: ProjectRole }>();
        for (const file of project.files) {
          const role = determineFileRole(file, primaryFile, project.files);
          projectAssignments.set(file.path, { projectId: projectRecord.id, role });
        }

        // Create import items with project assignments
        await itemService.createImportItems(job.id, project.files, projectAssignments);
        totalFiles += project.files.length;
      }

      // Update job with total files count
      await jobService.updateJobProgress(job.id, {
        total_files: totalFiles,
        files_scanned: totalFiles,
      });
    }
    // Legacy: If selected_files were provided without project info
    else if (body.selected_files && body.selected_files.length > 0) {
      await itemService.createImportItems(job.id, body.selected_files);

      // Update job with total files count
      await jobService.updateJobProgress(job.id, {
        total_files: body.selected_files.length,
        files_scanned: body.selected_files.length,
      });
    }

    return NextResponse.json(job, { status: 201 });
  } catch (error) {
    return handleDbError(error, "create import job");
  }
}
