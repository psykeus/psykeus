/**
 * Import Log Reasons API
 *
 * Provides summary of skip/fail reasons grouped by status.
 */

import { NextRequest, NextResponse } from "next/server";
import { getUser, isAdmin } from "@/lib/auth";
import * as jobService from "@/lib/services/import-job-service";
import * as logService from "@/lib/services/import-log-service";
import { forbiddenResponse, notFoundResponse, handleDbError } from "@/lib/api/helpers";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ jobId: string }>;
}

/**
 * GET /api/admin/import/jobs/[jobId]/logs/reasons
 * Get grouped reasons for skip/fail logs
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const user = await getUser();
  if (!user || !isAdmin(user)) {
    return forbiddenResponse("Admin access required");
  }

  try {
    const { jobId } = await params;

    // Verify job exists
    const job = await jobService.getImportJob(jobId);
    if (!job) {
      return notFoundResponse("Job");
    }

    const reasons = await logService.getImportLogReasons(jobId);
    const fileTypes = await logService.getLogFileTypeDistribution(jobId);

    return NextResponse.json({
      reasons,
      file_types: fileTypes,
    });
  } catch (error) {
    return handleDbError(error, "get log reasons");
  }
}
