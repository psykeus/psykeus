/**
 * User Export API
 * GET - Export users to CSV or JSON
 */

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  exportUsers,
  getUserExportCount,
  getExportableFields,
  EXPORTABLE_FIELDS,
} from "@/lib/services/user-export-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireAdmin();

    const url = new URL(request.url);
    const action = url.searchParams.get("action");

    // Return field definitions
    if (action === "fields") {
      return NextResponse.json({
        success: true,
        fields: getExportableFields(),
        allFields: EXPORTABLE_FIELDS,
      });
    }

    // Return count only
    if (action === "count") {
      const filters = parseFilters(url.searchParams);
      const count = await getUserExportCount({ filters });

      return NextResponse.json({
        success: true,
        count,
      });
    }

    // Export users
    const format = (url.searchParams.get("format") as "csv" | "json") || "csv";
    const fieldsParam = url.searchParams.get("fields");
    const fields = fieldsParam ? fieldsParam.split(",") : undefined;
    const filters = parseFilters(url.searchParams);

    const result = await exportUsers({
      format,
      fields,
      filters,
    });

    // Set appropriate content type and headers
    const contentType = format === "json" ? "application/json" : "text/csv";
    const contentDisposition = `attachment; filename="${result.filename}"`;

    return new NextResponse(result.data, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": contentDisposition,
        "X-Export-Count": result.count.toString(),
      },
    });
  } catch (error) {
    console.error("Failed to export users:", error);

    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to export users" },
      { status: 500 }
    );
  }
}

/**
 * Parse filter parameters from URL
 */
function parseFilters(searchParams: URLSearchParams) {
  const filters: {
    status?: string[];
    role?: string[];
    subscribedOnly?: boolean;
    hasActiveSubscription?: boolean;
    createdAfter?: string;
    createdBefore?: string;
  } = {};

  const status = searchParams.get("status");
  if (status) {
    filters.status = status.split(",");
  }

  const role = searchParams.get("role");
  if (role) {
    filters.role = role.split(",");
  }

  if (searchParams.get("subscribedOnly") === "true") {
    filters.subscribedOnly = true;
  }

  if (searchParams.get("hasActiveSubscription") === "true") {
    filters.hasActiveSubscription = true;
  }

  const createdAfter = searchParams.get("createdAfter");
  if (createdAfter) {
    filters.createdAfter = createdAfter;
  }

  const createdBefore = searchParams.get("createdBefore");
  if (createdBefore) {
    filters.createdBefore = createdBefore;
  }

  return Object.keys(filters).length > 0 ? filters : undefined;
}
