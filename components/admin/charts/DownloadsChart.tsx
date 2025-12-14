"use client";

import { useState, useEffect } from "react";
import {
  LineChart,
  Line,
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
import { TrendingUp, TrendingDown, Download } from "lucide-react";

interface DataPoint {
  date: string;
  downloads: number;
}

interface DownloadsData {
  data: DataPoint[];
  total: number;
  previousTotal: number;
  changePercent: number;
  range: string;
  groupBy: string;
}

export function DownloadsChart() {
  const [data, setData] = useState<DownloadsData | null>(null);
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
      const response = await fetch(`/api/admin/analytics/downloads?range=${range}`);

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

  // Format date for display
  function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    if (data?.groupBy === "month") {
      return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
    }
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  if (error === "Feature disabled") {
    return null;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="space-y-1">
          <CardTitle className="text-lg font-medium flex items-center gap-2">
            <Download className="h-5 w-5" />
            Downloads Over Time
          </CardTitle>
          {data && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-2xl font-bold">{data.total.toLocaleString()}</span>
              <span className="text-muted-foreground">total</span>
              {data.changePercent !== 0 && (
                <span
                  className={`flex items-center gap-1 ${
                    data.changePercent > 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {data.changePercent > 0 ? (
                    <TrendingUp className="h-4 w-4" />
                  ) : (
                    <TrendingDown className="h-4 w-4" />
                  )}
                  {Math.abs(data.changePercent)}%
                </span>
              )}
            </div>
          )}
        </div>
        <Select value={range} onValueChange={setRange}>
          <SelectTrigger className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
            <SelectItem value="1y">Last year</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-[300px] w-full" />
        ) : error ? (
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            {error}
          </div>
        ) : data && data.data.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data.data}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                tick={{ fontSize: 12 }}
                className="text-muted-foreground"
              />
              <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" />
              <Tooltip
                labelFormatter={formatDate}
                formatter={(value: number) => [value.toLocaleString(), "Downloads"]}
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  borderColor: "hsl(var(--border))",
                  borderRadius: "8px",
                }}
              />
              <Line
                type="monotone"
                dataKey="downloads"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            No download data available
          </div>
        )}
      </CardContent>
    </Card>
  );
}
