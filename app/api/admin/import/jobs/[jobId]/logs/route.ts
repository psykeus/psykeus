/**
 * Import Logs API
 *
 * Provides endpoints to retrieve detailed import logs for a job.
 * Logs persist after import completion for auditing and troubleshooting.
 */

import { NextRequest, NextResponse } from "next/server";
import { getUser, isAdmin } from "@/lib/auth";
import * as jobService from "@/lib/services/import-job-service";
import * as logService from "@/lib/services/import-log-service";
import type { ImportLogStatus } from "@/lib/types/import";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ jobId: string }>;
}

/**
 * GET /api/admin/import/jobs/[jobId]/logs
 * Get paginated logs for an import job with optional filters
 *
 * Query parameters:
 * - page: Page number (default: 1)
 * - per_page: Items per page (default: 50, max: 200)
 * - status: Comma-separated list of statuses to filter by
 * - file_type: Comma-separated list of file types to filter by
 * - search: Search term for filename or path
 * - order_by: Field to order by (default: created_at)
 * - order_dir: Sort direction (asc or desc, default: asc)
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

    // Check if import_logs table exists (migration may not be applied)
    const { createServiceClient } = await import("@/lib/supabase/server");
    const supabase = createServiceClient();
    const { error: tableError } = await supabase.from("import_logs").select("id").limit(0);

    if (tableError && (tableError.message.includes("does not exist") || tableError.code === "42P01")) {
      return NextResponse.json({
        logs: [],
        total: 0,
        page: 1,
        per_page: 50,
        total_pages: 0,
        summary: null,
        migration_required: true,
        message: "The import_logs table does not exist. Please run the 0011_import_logs.sql migration.",
      });
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const perPage = Math.min(200, Math.max(1, parseInt(searchParams.get("per_page") || "50", 10)));
    const statusParam = searchParams.get("status");
    const fileTypeParam = searchParams.get("file_type");
    const search = searchParams.get("search") || undefined;
    const orderBy = (searchParams.get("order_by") || "created_at") as
      | "created_at"
      | "filename"
      | "status"
      | "processing_duration_ms";
    const orderDir = (searchParams.get("order_dir") || "asc") as "asc" | "desc";

    // Build filters
    const filters: {
      status?: ImportLogStatus[];
      file_type?: string[];
      search?: string;
    } = {};

    if (statusParam) {
      filters.status = statusParam.split(",") as ImportLogStatus[];
    }

    if (fileTypeParam) {
      filters.file_type = fileTypeParam.split(",");
    }

    if (search) {
      filters.search = search;
    }

    // Get logs
    const { logs, total } = await logService.getImportLogs(jobId, {
      filters,
      page,
      perPage,
      orderBy,
      orderDir,
    });

    // Get summary stats
    const summary = await logService.getImportLogSummary(jobId);

    return NextResponse.json({
      logs,
      total,
      page,
      per_page: perPage,
      total_pages: Math.ceil(total / perPage),
      summary,
    });
  } catch (error) {
    console.error("Get import logs error:", error);
    return NextResponse.json(
      { error: "Failed to get import logs" },
      { status: 500 }
    );
  }
}
