import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUser, isAdmin } from "@/lib/auth";
import { isAnalyticsChartsEnabled } from "@/lib/feature-flags";
import { forbiddenResponse, featureDisabledResponse, handleDbError } from "@/lib/api/helpers";

/**
 * GET /api/admin/analytics/downloads
 * Get download statistics over time
 * Query params: range (7d, 30d, 90d, 1y)
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
  const range = searchParams.get("range") || "30d";

  // Calculate date range
  const now = new Date();
  let startDate: Date;
  let groupBy: "day" | "week" | "month";

  switch (range) {
    case "7d":
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      groupBy = "day";
      break;
    case "30d":
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      groupBy = "day";
      break;
    case "90d":
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      groupBy = "week";
      break;
    case "1y":
      startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      groupBy = "month";
      break;
    default:
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      groupBy = "day";
  }

  const supabase = await createClient();

  // Fetch downloads within range
  const { data: downloads, error } = await supabase
    .from("downloads")
    .select("downloaded_at")
    .gte("downloaded_at", startDate.toISOString())
    .order("downloaded_at", { ascending: true });

  if (error) {
    return handleDbError(error, "fetch download analytics");
  }

  // Group downloads by period
  const grouped = new Map<string, number>();

  downloads?.forEach((d) => {
    const date = new Date(d.downloaded_at);
    let key: string;

    if (groupBy === "day") {
      key = date.toISOString().split("T")[0];
    } else if (groupBy === "week") {
      // Get start of week (Sunday)
      const startOfWeek = new Date(date);
      startOfWeek.setDate(date.getDate() - date.getDay());
      key = startOfWeek.toISOString().split("T")[0];
    } else {
      // Month
      key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    }

    grouped.set(key, (grouped.get(key) || 0) + 1);
  });

  // Fill in missing dates with 0
  const data: Array<{ date: string; downloads: number }> = [];
  const current = new Date(startDate);

  while (current <= now) {
    let key: string;

    if (groupBy === "day") {
      key = current.toISOString().split("T")[0];
      current.setDate(current.getDate() + 1);
    } else if (groupBy === "week") {
      const startOfWeek = new Date(current);
      startOfWeek.setDate(current.getDate() - current.getDay());
      key = startOfWeek.toISOString().split("T")[0];
      current.setDate(current.getDate() + 7);
    } else {
      key = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}`;
      current.setMonth(current.getMonth() + 1);
    }

    if (!data.find((d) => d.date === key)) {
      data.push({
        date: key,
        downloads: grouped.get(key) || 0,
      });
    }
  }

  // Calculate totals
  const total = downloads?.length || 0;
  const previousPeriodStart = new Date(
    startDate.getTime() - (now.getTime() - startDate.getTime())
  );

  const { count: previousTotal } = await supabase
    .from("downloads")
    .select("*", { count: "exact", head: true })
    .gte("downloaded_at", previousPeriodStart.toISOString())
    .lt("downloaded_at", startDate.toISOString());

  const changePercent =
    previousTotal && previousTotal > 0
      ? Math.round(((total - previousTotal) / previousTotal) * 100)
      : 0;

  return NextResponse.json({
    data,
    total,
    previousTotal: previousTotal || 0,
    changePercent,
    range,
    groupBy,
  });
}
