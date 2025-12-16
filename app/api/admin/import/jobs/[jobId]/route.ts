import { NextRequest, NextResponse } from "next/server";
import { getUser, isAdmin } from "@/lib/auth";
import * as jobService from "@/lib/services/import-job-service";
import * as itemService from "@/lib/services/import-item-service";
import { forbiddenResponse, notFoundResponse, handleDbError } from "@/lib/api/helpers";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ jobId: string }>;
}

/**
 * GET /api/admin/import/jobs/[jobId]
 * Get job details with progress
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const user = await getUser();
  if (!user || !isAdmin(user)) {
    return forbiddenResponse("Admin access required");
  }

  try {
    const { jobId } = await params;
    const job = await jobService.getImportJobWithProgress(jobId);

    if (!job) {
      return notFoundResponse("Job");
    }

    // Get status counts
    const statusCounts = await itemService.getItemStatusCounts(jobId);

    // Get AI metadata stats if AI was requested for this job
    let aiStats = null;
    if (job.generate_ai_metadata) {
      aiStats = await itemService.getAIMetadataStats(jobId);
    }

    return NextResponse.json({
      job,
      status_counts: statusCounts,
      ai_stats: aiStats,
    });
  } catch (error) {
    return handleDbError(error, "get import job");
  }
}

/**
 * DELETE /api/admin/import/jobs/[jobId]
 * Delete a job and all associated data
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
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

    // Don't allow deleting active jobs
    if (["scanning", "processing"].includes(job.status)) {
      return NextResponse.json(
        { error: "Cannot delete an active job. Cancel it first." },
        { status: 400 }
      );
    }

    await jobService.deleteJob(jobId);

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleDbError(error, "delete import job");
  }
}
