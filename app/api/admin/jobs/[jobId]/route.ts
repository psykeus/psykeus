/**
 * Individual Job API
 *
 * GET /api/admin/jobs/[jobId] - Get job status and details
 */

import { NextRequest, NextResponse } from "next/server";
import { getUser, isAdmin } from "@/lib/auth";
import { jobQueue } from "@/lib/jobs/queue";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ jobId: string }>;
}

/**
 * GET /api/admin/jobs/[jobId]
 * Returns job status and details
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const user = await getUser();
  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { jobId } = await params;

  const isAvailable = await jobQueue.isAvailable();
  if (!isAvailable) {
    return NextResponse.json(
      { error: "Job queue unavailable (Redis not configured)" },
      { status: 503 }
    );
  }

  const job = await jobQueue.getJob(jobId);

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const state = await job.getState();
  const progress = job.progress;

  return NextResponse.json({
    id: job.id,
    name: job.name,
    data: job.data,
    state,
    progress,
    attemptsMade: job.attemptsMade,
    timestamp: job.timestamp,
    processedOn: job.processedOn,
    finishedOn: job.finishedOn,
    returnValue: job.returnvalue,
    failedReason: job.failedReason,
  });
}
