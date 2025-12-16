/**
 * Design IDs API
 *
 * Returns design IDs matching filters for bulk selection operations.
 * More efficient than fetching full records when only IDs are needed.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getUser, isAdmin } from "@/lib/auth";
import { escapeIlikePattern } from "@/lib/validations";
import { forbiddenResponse, handleDbError } from "@/lib/api/helpers";

export const runtime = "nodejs";

/**
 * GET /api/admin/designs/ids
 *
 * Query parameters:
 * - q: Search query for title/description
 * - status: "public" | "hidden"
 * - import_job_id: UUID of import job
 *
 * Returns: { ids: string[], total: number }
 */
export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user || !isAdmin(user)) {
    return forbiddenResponse("Admin access required");
  }

  const searchParams = request.nextUrl.searchParams;
  const q = searchParams.get("q");
  const status = searchParams.get("status");
  const importJobId = searchParams.get("import_job_id");

  const supabase = createServiceClient();

  // Build query - only select id for efficiency
  let query = supabase.from("designs").select("id");

  // Apply search filter (escape special characters for safe ILIKE matching)
  if (q) {
    query = query.or(`title.ilike.%${escapeIlikePattern(q)}%,description.ilike.%${escapeIlikePattern(q)}%`);
  }

  // Apply status filter
  if (status === "public") {
    query = query.eq("is_public", true);
  } else if (status === "hidden") {
    query = query.eq("is_public", false);
  }

  // Apply import job filter
  if (importJobId) {
    query = query.eq("import_job_id", importJobId);
  }

  // Order by updated_at for consistency
  query = query.order("updated_at", { ascending: false });

  const { data, error } = await query;

  if (error) {
    return handleDbError(error, "fetch design IDs");
  }

  const ids = data?.map((d) => d.id) || [];

  return NextResponse.json({
    ids,
    total: ids.length,
  });
}
