import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { isAnalyticsChartsEnabled } from "@/lib/feature-flags";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Layers, Eye, Download, Users, ArrowRight, Upload, Copy } from "lucide-react";
import { DownloadsChart, PopularDesignsChart } from "@/components/admin/charts";

export default async function AdminDashboardPage() {
  await requireAdmin();

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const analyticsEnabled = await isAnalyticsChartsEnabled();

  const [
    { count: totalDesigns },
    { count: publicDesigns },
    { count: totalDownloads },
    { count: totalUsers },
  ] = await Promise.all([
    supabase.from("designs").select("*", { count: "exact", head: true }),
    supabase.from("designs").select("*", { count: "exact", head: true }).eq("is_public", true),
    supabase.from("downloads").select("*", { count: "exact", head: true }),
    supabase.from("users").select("*", { count: "exact", head: true }),
  ]);

  const stats = [
    { label: "Total Designs", value: totalDesigns ?? 0, icon: Layers, color: "text-blue-500" },
    { label: "Public Designs", value: publicDesigns ?? 0, icon: Eye, color: "text-green-500" },
    { label: "Total Downloads", value: totalDownloads ?? 0, icon: Download, color: "text-primary" },
    { label: "Total Users", value: totalUsers ?? 0, icon: Users, color: "text-purple-500" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground mt-1">Overview of your design library</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-3xl font-bold mt-1">{stat.value.toLocaleString()}</p>
                </div>
                <div className={`p-3 rounded-full bg-muted ${stat.color}`}>
                  <stat.icon className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Analytics Charts */}
      {analyticsEnabled && (
        <div className="grid lg:grid-cols-2 gap-6">
          <DownloadsChart />
          <PopularDesignsChart />
        </div>
      )}

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading">Quick Actions</CardTitle>
          <CardDescription>Common tasks and shortcuts</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-3 gap-4">
            <Button asChild className="h-auto py-4 flex-col gap-2">
              <Link href="/admin/upload">
                <Upload className="h-5 w-5" />
                <span>Upload New Designs</span>
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-auto py-4 flex-col gap-2">
              <Link href="/admin/designs">
                <Layers className="h-5 w-5" />
                <span>Manage Designs</span>
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-auto py-4 flex-col gap-2">
              <Link href="/admin/duplicates">
                <Copy className="h-5 w-5" />
                <span>Review Duplicates</span>
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity Placeholder */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading">Getting Started</CardTitle>
          <CardDescription>Tips for managing your design library</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold">1.</span>
              <span>Upload your design files (SVG, DXF, STL, and more) using the Upload page</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold">2.</span>
              <span>AI will automatically generate metadata and previews for supported formats</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold">3.</span>
              <span>Review and publish designs from the Designs management page</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold">4.</span>
              <span>Check the Duplicates page regularly to keep your library clean</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
