/**
 * Import Log Reasons API
 *
 * Provides summary of skip/fail reasons grouped by status.
 */

import { NextRequest, NextResponse } from "next/server";
import { getUser, isAdmin } from "@/lib/auth";
import * as jobService from "@/lib/services/import-job-service";
import * as logService from "@/lib/services/import-log-service";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ jobId: string }>;
}

/**
 * GET /api/admin/import/jobs/[jobId]/logs/reasons
 * Get grouped reasons for skip/fail logs
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const user = await getUser();
  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  try {
    const { jobId } = await params;

    // Verify job exists
    const job = await jobService.getImportJob(jobId);
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const reasons = await logService.getImportLogReasons(jobId);
    const fileTypes = await logService.getLogFileTypeDistribution(jobId);

    return NextResponse.json({
      reasons,
      file_types: fileTypes,
    });
  } catch (error) {
    console.error("Get log reasons error:", error);
    return NextResponse.json(
      { error: "Failed to get log reasons" },
      { status: 500 }
    );
  }
}
