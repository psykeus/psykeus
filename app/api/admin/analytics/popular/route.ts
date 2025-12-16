import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUser, isAdmin } from "@/lib/auth";
import { isAnalyticsChartsEnabled } from "@/lib/feature-flags";
import { forbiddenResponse, featureDisabledResponse, handleDbError } from "@/lib/api/helpers";

/**
 * GET /api/admin/analytics/popular
 * Get most downloaded designs
 * Query params: limit (default 10), range (7d, 30d, 90d, 1y, all)
 */
export async function GET(request: NextRequest) {
  // Check if feature is enabled
  if (!(await isAnalyticsChartsEnabled())) {
    return featureDisabledResponse("Analytics charts");
  }

  const user = await getUser();
  if (!user || !isAdmin(user)) {
    return forbiddenResponse("Admin access required");
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 50);
  const range = searchParams.get("range") || "30d";

  const supabase = await createClient();

  // Calculate date range
  let startDate: Date | null = null;
  const now = new Date();

  if (range !== "all") {
    switch (range) {
      case "7d":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "30d":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "90d":
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case "1y":
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
    }
  }

  // Use RPC function for efficient database-level aggregation
  const { data, error } = await supabase.rpc("get_popular_designs", {
    p_start_date: startDate?.toISOString() || null,
    p_limit: limit,
  });

  if (error) {
    return handleDbError(error, "fetch popular designs analytics");
  }

  // Transform to expected format
  const formattedData = (data || []).map((d: {
    id: string;
    title: string;
    slug: string;
    preview_path: string | null;
    categories: string[] | null;
    download_count: number;
  }) => ({
    id: d.id,
    title: d.title,
    slug: d.slug,
    preview_path: d.preview_path,
    categories: d.categories,
    downloads: d.download_count,
  }));

  return NextResponse.json(
    {
      data: formattedData,
      range,
    },
    {
      headers: {
        // Private cache for admin analytics, 5 min max age
        "Cache-Control": "private, max-age=300",
      },
    }
  );
}
