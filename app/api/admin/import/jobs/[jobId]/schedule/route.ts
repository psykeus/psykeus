/**
 * Schedule Import Job API
 *
 * POST - Schedule a pending import job for later execution
 * DELETE - Clear schedule from a pending import job
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getImportJob } from "@/lib/services/import-job-service";
import {
  scheduleImportJob,
  clearImportSchedule,
} from "@/lib/services/scheduled-import-service";
import type { ScheduleImportOptions } from "@/lib/types/import";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ jobId: string }>;
}

/**
 * POST /api/admin/import/jobs/[jobId]/schedule
 * Schedule a pending import job for later execution
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    await requireAdmin();
    const { jobId } = await params;

    // Parse request body
    const body = await request.json();
    const { type, datetime, delayMinutes } = body as ScheduleImportOptions;

    // Validate schedule type
    if (!type || (type !== "datetime" && type !== "delay")) {
      return NextResponse.json(
        { error: "Invalid schedule type. Must be 'datetime' or 'delay'" },
        { status: 400 }
      );
    }

    // Validate datetime option
    if (type === "datetime") {
      if (!datetime) {
        return NextResponse.json(
          { error: "datetime is required for datetime schedule type" },
          { status: 400 }
        );
      }
      const scheduledDate = new Date(datetime);
      if (isNaN(scheduledDate.getTime())) {
        return NextResponse.json(
          { error: "Invalid datetime format" },
          { status: 400 }
        );
      }
    }

    // Validate delay option
    if (type === "delay") {
      if (typeof delayMinutes !== "number" || delayMinutes < 1) {
        return NextResponse.json(
          { error: "delayMinutes must be a positive number" },
          { status: 400 }
        );
      }
    }

    // Check if job exists and is pending
    const job = await getImportJob(jobId);
    if (!job) {
      return NextResponse.json({ error: "Import job not found" }, { status: 404 });
    }
    if (job.status !== "pending") {
      return NextResponse.json(
        { error: "Only pending jobs can be scheduled" },
        { status: 400 }
      );
    }

    // Schedule the job
    const result = await scheduleImportJob(jobId, {
      type,
      datetime,
      delayMinutes,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to schedule job" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      scheduled_at: result.scheduled_at,
      message: `Job scheduled for ${result.scheduled_at}`,
    });
  } catch (error) {
    console.error("[ScheduleAPI] Error scheduling job:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/import/jobs/[jobId]/schedule
 * Clear schedule from a pending import job
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    await requireAdmin();
    const { jobId } = await params;

    // Check if job exists
    const job = await getImportJob(jobId);
    if (!job) {
      return NextResponse.json({ error: "Import job not found" }, { status: 404 });
    }

    // Only pending jobs can have schedule cleared
    if (job.status !== "pending") {
      return NextResponse.json(
        { error: "Only pending jobs can have their schedule cleared" },
        { status: 400 }
      );
    }

    // Clear the schedule
    const result = await clearImportSchedule(jobId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to clear schedule" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Schedule cleared",
    });
  } catch (error) {
    console.error("[ScheduleAPI] Error clearing schedule:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
