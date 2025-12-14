import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUser, isAdmin } from "@/lib/auth";

export async function GET() {
  const supabase = await createClient();
  const user = await getUser();

  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  // Get total designs
  const { count: totalDesigns } = await supabase
    .from("designs")
    .select("*", { count: "exact", head: true });

  // Get public designs
  const { count: publicDesigns } = await supabase
    .from("designs")
    .select("*", { count: "exact", head: true })
    .eq("is_public", true);

  // Get total downloads
  const { count: totalDownloads } = await supabase
    .from("downloads")
    .select("*", { count: "exact", head: true });

  // Get unique users who downloaded
  const { data: uniqueDownloaders } = await supabase
    .from("downloads")
    .select("user_id")
    .limit(10000);

  const uniqueUserCount = new Set(uniqueDownloaders?.map((d) => d.user_id)).size;

  // Get total users
  const { count: totalUsers } = await supabase
    .from("users")
    .select("*", { count: "exact", head: true });

  // Get top downloaded designs
  const { data: topDownloads } = await supabase
    .from("downloads")
    .select(
      `
      design_id,
      designs (
        id,
        title,
        slug,
        preview_path
      )
    `
    )
    .limit(1000);

  // Count downloads per design
  const downloadCounts: Record<string, { count: number; design: unknown }> = {};
  topDownloads?.forEach((d) => {
    if (d.design_id && d.designs) {
      if (!downloadCounts[d.design_id]) {
        downloadCounts[d.design_id] = { count: 0, design: d.designs };
      }
      downloadCounts[d.design_id].count++;
    }
  });

  const topDesigns = Object.entries(downloadCounts)
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, 10)
    .map(([design_id, { count, design }]) => ({
      design_id,
      download_count: count,
      ...(design as object),
    }));

  // Get downloads this week
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const { count: downloadsThisWeek } = await supabase
    .from("downloads")
    .select("*", { count: "exact", head: true })
    .gte("downloaded_at", weekAgo.toISOString());

  // Get new designs this week
  const { count: designsThisWeek } = await supabase
    .from("designs")
    .select("*", { count: "exact", head: true })
    .gte("created_at", weekAgo.toISOString());

  return NextResponse.json({
    totalDesigns: totalDesigns ?? 0,
    publicDesigns: publicDesigns ?? 0,
    totalDownloads: totalDownloads ?? 0,
    uniqueDownloaders: uniqueUserCount,
    totalUsers: totalUsers ?? 0,
    downloadsThisWeek: downloadsThisWeek ?? 0,
    designsThisWeek: designsThisWeek ?? 0,
    topDesigns,
  });
}
