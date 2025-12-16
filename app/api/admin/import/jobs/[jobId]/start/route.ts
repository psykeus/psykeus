import { NextRequest, NextResponse } from "next/server";
import { getUser, isAdmin } from "@/lib/auth";
import * as jobService from "@/lib/services/import-job-service";
import * as itemService from "@/lib/services/import-item-service";
import { startJobProcessing } from "@/lib/import/job-processor";
import { scanDirectory } from "@/lib/import/scanner";
import type { ProcessingOptions } from "@/lib/types/import";
import { DEFAULT_PROCESSING_OPTIONS } from "@/lib/types/import";
import { forbiddenResponse, notFoundResponse, handleDbError } from "@/lib/api/helpers";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ jobId: string }>;
}

/**
 * POST /api/admin/import/jobs/[jobId]/start
 * Start processing an import job
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const user = await getUser();
  if (!user || !isAdmin(user)) {
    return forbiddenResponse("Admin access required");
  }

  try {
    const { jobId } = await params;
    const job = await jobService.getImportJob(jobId);

    if (!job) {
      return notFoundResponse("Job");
    }

    if (!["pending", "paused"].includes(job.status)) {
      return NextResponse.json(
        { error: `Cannot start job with status: ${job.status}` },
        { status: 400 }
      );
    }

    // For folder imports, check if items already exist (pre-selected) or need to scan
    if (job.source_type === "folder" && job.source_path) {
      // Check if items already exist (created during job creation with selected_files)
      const existingCounts = await itemService.getItemStatusCounts(jobId);
      const existingItemCount = Object.values(existingCounts).reduce((a, b) => a + b, 0);

      if (existingItemCount === 0) {
        // No items exist, need to scan the directory
        // Update status to scanning
        await jobService.updateJobStatus(jobId, "scanning");

        // Scan the directory
        const scanResult = await scanDirectory(job.source_path);

        // Flatten all files from detected projects
        const allFiles = scanResult.detected_projects.flatMap((p) => p.files);

        if (allFiles.length === 0) {
          await jobService.setJobError(jobId, "No supported files found in directory");
          return NextResponse.json(
            { error: "No supported files found in directory" },
            { status: 400 }
          );
        }

        // Create import items
        await itemService.createImportItems(jobId, allFiles);

        // Update job with total files count
        await jobService.updateJobProgress(jobId, {
          total_files: allFiles.length,
          files_scanned: allFiles.length,
        });

        // Reset status to pending so processing can start
        await jobService.updateJobStatus(jobId, "pending");
      }
      // If items already exist, we use them directly (user pre-selected them)
    }

    // Parse optional options from body, starting with defaults
    let options: ProcessingOptions = {
      ...DEFAULT_PROCESSING_OPTIONS,
      // Override with job-level settings
      generate_previews: job.generate_previews,
      generate_ai_metadata: job.generate_ai_metadata,
      detect_duplicates: job.detect_duplicates,
      auto_publish: job.auto_publish,
    };

    try {
      const body = await request.json();
      // Merge any request body options
      if (typeof body.concurrency === "number") options.concurrency = body.concurrency;
      if (typeof body.checkpoint_interval === "number") options.checkpoint_interval = body.checkpoint_interval;
      if (typeof body.near_duplicate_threshold === "number") options.near_duplicate_threshold = body.near_duplicate_threshold;
      if (typeof body.exact_duplicates_only === "boolean") options.exact_duplicates_only = body.exact_duplicates_only;
      if (typeof body.enable_project_detection === "boolean") options.enable_project_detection = body.enable_project_detection;
      if (typeof body.cross_folder_detection === "boolean") options.cross_folder_detection = body.cross_folder_detection;
      if (typeof body.project_confidence_threshold === "number") options.project_confidence_threshold = body.project_confidence_threshold;
      if (typeof body.max_retries === "number") options.max_retries = body.max_retries;
      if (typeof body.skip_failed_files === "boolean") options.skip_failed_files = body.skip_failed_files;
      if (Array.isArray(body.preview_type_priority)) options.preview_type_priority = body.preview_type_priority;
    } catch {
      // No body or invalid JSON, use defaults
    }

    // Refresh job to get updated total_files
    const updatedJob = await jobService.getImportJob(jobId);
    if (!updatedJob) {
      return notFoundResponse("Job");
    }

    // Start processing in background (don't await)
    startJobProcessing(updatedJob, options).catch((err) => {
      console.error(`Background processing error for job ${jobId}:`, err);
    });

    return NextResponse.json({
      success: true,
      message: "Job started",
      job_id: jobId,
    });
  } catch (error) {
    return handleDbError(error, "start import job");
  }
}
