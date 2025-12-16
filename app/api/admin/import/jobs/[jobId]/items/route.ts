import { NextRequest, NextResponse } from "next/server";
import { getUser, isAdmin } from "@/lib/auth";
import * as itemService from "@/lib/services/import-item-service";
import type { ImportItemFilters, ImportItemStatus } from "@/lib/types/import";
import { forbiddenResponse, handleDbError } from "@/lib/api/helpers";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ jobId: string }>;
}

/**
 * GET /api/admin/import/jobs/[jobId]/items
 * List items in an import job
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const user = await getUser();
  if (!user || !isAdmin(user)) {
    return forbiddenResponse("Admin access required");
  }

  try {
    const { jobId } = await params;
    const { searchParams } = new URL(request.url);

    const filters: ImportItemFilters = {};

    const status = searchParams.get("status");
    if (status) {
      filters.status = status.split(",") as ImportItemStatus[];
    }

    const projectId = searchParams.get("project_id");
    if (projectId) {
      filters.project_id = projectId;
    }

    const hasError = searchParams.get("has_error");
    if (hasError === "true") {
      filters.has_error = true;
    }

    const search = searchParams.get("search");
    if (search) {
      filters.search = search;
    }

    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    const { items, total } = await itemService.listImportItems(jobId, filters, {
      limit,
      offset,
    });

    return NextResponse.json({
      items,
      total,
      page: Math.floor(offset / limit) + 1,
      per_page: limit,
      total_pages: Math.ceil(total / limit),
    });
  } catch (error) {
    return handleDbError(error, "list import items");
  }
}
