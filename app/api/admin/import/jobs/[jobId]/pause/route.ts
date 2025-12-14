import { NextRequest, NextResponse } from "next/server";
import { getUser, isAdmin } from "@/lib/auth";
import * as jobService from "@/lib/services/import-job-service";
import { pauseJob as pauseProcessor } from "@/lib/import/job-processor";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ jobId: string }>;
}

/**
 * POST /api/admin/import/jobs/[jobId]/pause
 * Pause a running import job
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const user = await getUser();
  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  try {
    const { jobId } = await params;

    // Pause the processor
    pauseProcessor(jobId);

    // Update database status
    const job = await jobService.pauseJob(jobId);

    return NextResponse.json({
      success: true,
      message: "Job paused",
      job,
    });
  } catch (error) {
    console.error("Pause job error:", error);
    const message = error instanceof Error ? error.message : "Failed to pause job";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
