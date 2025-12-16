/**
 * Background Jobs API
 *
 * GET /api/admin/jobs - Get queue statistics
 * POST /api/admin/jobs - Add a new job to the queue
 */

import { NextRequest, NextResponse } from "next/server";
import { getUser, isAdmin } from "@/lib/auth";
import { jobQueue, enqueueJob, type JobData } from "@/lib/jobs/queue";
import { forbiddenResponse, handleDbError } from "@/lib/api/helpers";

export const runtime = "nodejs";

/**
 * GET /api/admin/jobs
 * Returns queue statistics
 */
export async function GET() {
  const user = await getUser();
  if (!user || !isAdmin(user)) {
    return forbiddenResponse("Admin access required");
  }

  const isAvailable = await jobQueue.isAvailable();
  const stats = await jobQueue.getStats();

  return NextResponse.json({
    available: isAvailable,
    stats: stats || {
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
    },
    message: isAvailable
      ? "Job queue is running"
      : "Job queue unavailable (Redis not configured)",
  });
}

/**
 * POST /api/admin/jobs
 * Add a job to the queue
 *
 * Body:
 * - type: JobType
 * - data: Job-specific data
 * - delay?: number (ms)
 * - priority?: number
 */
export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user || !isAdmin(user)) {
    return forbiddenResponse("Admin access required");
  }

  try {
    const body = await request.json();
    const { type, delay, priority, ...jobData } = body;

    if (!type) {
      return NextResponse.json({ error: "Job type is required" }, { status: 400 });
    }

    // Validate job type
    const validTypes = [
      "preview:generate",
      "ai:extract-metadata",
      "design:publish",
      "design:unpublish",
      "webhook:deliver",
      "import:process-item",
    ];

    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid job type. Valid types: ${validTypes.join(", ")}` },
        { status: 400 }
      );
    }

    const jobPayload: JobData = { type, ...jobData };

    const result = await enqueueJob(jobPayload, { delay, priority });

    if (!result.queued) {
      return NextResponse.json(
        {
          error: result.error || "Failed to queue job",
          fallbackMessage: "Job queue is not available. Task may need to be processed manually.",
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      success: true,
      jobId: result.jobId,
      message: `Job ${type} queued successfully`,
    });
  } catch (error) {
    return handleDbError(error, "add job to queue");
  }
}
