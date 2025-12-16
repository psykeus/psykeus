import { NextRequest, NextResponse } from "next/server";
import { getUser, isAdmin } from "@/lib/auth";
import * as jobService from "@/lib/services/import-job-service";
import { cancelJob as cancelProcessor } from "@/lib/import/job-processor";
import { forbiddenResponse, handleDbError } from "@/lib/api/helpers";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ jobId: string }>;
}

/**
 * POST /api/admin/import/jobs/[jobId]/cancel
 * Cancel an import job
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const user = await getUser();
  if (!user || !isAdmin(user)) {
    return forbiddenResponse("Admin access required");
  }

  try {
    const { jobId } = await params;

    // Cancel the processor
    cancelProcessor(jobId);

    // Update database status
    const job = await jobService.cancelJob(jobId);

    return NextResponse.json({
      success: true,
      message: "Job cancelled",
      job,
    });
  } catch (error) {
    return handleDbError(error, "cancel job");
  }
}
