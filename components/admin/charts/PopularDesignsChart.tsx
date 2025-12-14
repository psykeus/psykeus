"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, ExternalLink } from "lucide-react";

interface PopularDesign {
  id: string;
  title: string;
  slug: string;
  preview_path: string | null;
  category: string | null;
  downloads: number;
}

interface PopularData {
  data: PopularDesign[];
  range: string;
}

export function PopularDesignsChart() {
  const [data, setData] = useState<PopularData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState("30d");

  useEffect(() => {
    fetchData();
  }, [range]);

  async function fetchData() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/analytics/popular?range=${range}&limit=10`);

      if (response.status === 403) {
        setError("Feature disabled");
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to load data");
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading data");
    } finally {
      setLoading(false);
    }
  }

  if (error === "Feature disabled") {
    return null;
  }

  // Truncate long titles for the chart
  function truncateTitle(title: string, maxLength: number = 20): string {
    if (title.length <= maxLength) return title;
    return title.substring(0, maxLength - 3) + "...";
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-medium flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Most Popular Designs
        </CardTitle>
        <Select value={range} onValueChange={setRange}>
          <SelectTrigger className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
            <SelectItem value="1y">Last year</SelectItem>
            <SelectItem value="all">All time</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-[400px] w-full" />
        ) : error ? (
          <div className="h-[400px] flex items-center justify-center text-muted-foreground">
            {error}
          </div>
        ) : data && data.data.length > 0 ? (
          <div className="space-y-6">
            {/* Bar Chart */}
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={data.data.map((d) => ({
                  ...d,
                  shortTitle: truncateTitle(d.title),
                }))}
                layout="vertical"
                margin={{ left: 20, right: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis
                  type="category"
                  dataKey="shortTitle"
                  width={100}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip
                  formatter={(value: number) => [value.toLocaleString(), "Downloads"]}
                  labelFormatter={(label) => {
                    const item = data.data.find((d) => truncateTitle(d.title) === label);
                    return item?.title || label;
                  }}
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    borderColor: "hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Bar
                  dataKey="downloads"
                  fill="hsl(var(--primary))"
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>

            {/* Design List */}
            <div className="space-y-2">
              {data.data.slice(0, 5).map((design, index) => (
                <Link
                  key={design.id}
                  href={`/admin/designs/${design.id}`}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/50 transition-colors"
                >
                  <span className="text-lg font-bold text-muted-foreground w-6">
                    {index + 1}
                  </span>
                  <div className="relative w-10 h-10 rounded overflow-hidden bg-muted flex-shrink-0">
                    {design.preview_path ? (
                      <Image
                        src={design.preview_path}
                        alt={design.title}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                        N/A
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{design.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {design.downloads.toLocaleString()} downloads
                    </p>
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <div className="h-[400px] flex items-center justify-center text-muted-foreground">
            No download data available
          </div>
        )}
      </CardContent>
    </Card>
  );
}
