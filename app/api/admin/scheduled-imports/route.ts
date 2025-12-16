/**
 * Scheduled Imports API
 *
 * GET - List scheduled import jobs
 * POST - Process due scheduled imports (for cron/polling)
 */

import { NextRequest, NextResponse } from "next/server";
import { getUser, isAdmin } from "@/lib/auth";
import {
  getScheduledImports,
  processScheduledImports,
  getTimeUntilStart,
} from "@/lib/services/scheduled-import-service";
import { forbiddenResponse, handleDbError } from "@/lib/api/helpers";

export const runtime = "nodejs";

/**
 * GET /api/admin/scheduled-imports
 * List all scheduled import jobs (pending jobs with future scheduled_start_at)
 */
export async function GET() {
  const user = await getUser();
  if (!user || !isAdmin(user)) {
    return forbiddenResponse("Admin access required");
  }

  try {
    const scheduledJobs = await getScheduledImports();

    // Add time until start for each job
    const jobsWithTimeLeft = scheduledJobs.map((job) => ({
      ...job,
      time_until_start_seconds: getTimeUntilStart(job),
    }));

    return NextResponse.json({
      jobs: jobsWithTimeLeft,
      count: jobsWithTimeLeft.length,
    });
  } catch (error) {
    return handleDbError(error, "fetch scheduled imports");
  }
}

/**
 * POST /api/admin/scheduled-imports
 * Process all due scheduled imports
 *
 * This endpoint is intended to be called by:
 * 1. A cron job (when Redis is not available)
 * 2. Manual trigger from admin UI
 *
 * Returns summary of jobs started and any errors
 */
export async function POST(request: NextRequest) {
  // Check for cron secret or admin auth
  const cronSecret = request.headers.get("x-cron-secret");
  const expectedSecret = process.env.CRON_SECRET;

  if (cronSecret && expectedSecret && cronSecret === expectedSecret) {
    // Authenticated via cron secret - proceed
  } else {
    // Fall back to admin auth
    const user = await getUser();
    if (!user || !isAdmin(user)) {
      return forbiddenResponse("Admin access required");
    }
  }

  try {
    const result = await processScheduledImports();

    return NextResponse.json({
      success: result.success,
      started: result.started,
      errors: result.errors,
      message: result.started > 0
        ? `Started ${result.started} scheduled job(s)`
        : "No scheduled jobs due",
    });
  } catch (error) {
    return handleDbError(error, "process scheduled imports");
  }
}
