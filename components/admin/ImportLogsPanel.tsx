"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Copy,
  ChevronDown,
  ChevronRight,
  Search,
  FileText,
  Clock,
  Loader2,
  RefreshCw,
} from "lucide-react";
import type {
  ImportLog,
  ImportLogStatus,
  ImportLogSummary,
  ImportLogReasonGroup,
} from "@/lib/types/import";

interface Props {
  jobId: string;
  jobStatus: string;
}

const STATUS_CONFIG: Record<
  ImportLogStatus,
  { label: string; icon: React.ElementType; color: string; bgColor: string }
> = {
  pending: { label: "Pending", icon: Clock, color: "text-muted-foreground", bgColor: "bg-muted/50" },
  processing: { label: "Processing", icon: Loader2, color: "text-blue-500", bgColor: "bg-blue-500/10" },
  succeeded: { label: "Succeeded", icon: CheckCircle, color: "text-green-600", bgColor: "bg-green-500/10" },
  failed: { label: "Failed", icon: XCircle, color: "text-destructive", bgColor: "bg-destructive/10" },
  skipped: { label: "Skipped", icon: AlertTriangle, color: "text-amber-600", bgColor: "bg-amber-500/10" },
  duplicate: { label: "Duplicate", icon: Copy, color: "text-purple-600", bgColor: "bg-purple-500/10" },
};

export function ImportLogsPanel({ jobId, jobStatus }: Props) {
  const [logs, setLogs] = useState<ImportLog[]>([]);
  const [summary, setSummary] = useState<ImportLogSummary | null>(null);
  const [reasons, setReasons] = useState<ImportLogReasonGroup[]>([]);
  const [fileTypes, setFileTypes] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [migrationRequired, setMigrationRequired] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const perPage = 50;

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Fetch logs
  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        per_page: perPage.toString(),
        order_by: "created_at",
        order_dir: "asc",
      });

      if (statusFilter !== "all") {
        params.set("status", statusFilter);
      }

      if (searchQuery.trim()) {
        params.set("search", searchQuery.trim());
      }

      const response = await fetch(`/api/admin/import/jobs/${jobId}/logs?${params}`);
      if (!response.ok) {
        throw new Error("Failed to fetch logs");
      }

      const data = await response.json();

      // Check if migration is required
      if (data.migration_required) {
        setMigrationRequired(true);
        setLogs([]);
        setSummary(null);
        setTotal(0);
        setTotalPages(0);
        return;
      }

      setMigrationRequired(false);
      setLogs(data.logs);
      setSummary(data.summary);
      setTotal(data.total);
      setTotalPages(data.total_pages);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch logs");
    } finally {
      setIsLoading(false);
    }
  }, [jobId, page, statusFilter, searchQuery]);

  // Fetch reasons
  const fetchReasons = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/import/jobs/${jobId}/logs/reasons`);
      if (response.ok) {
        const data = await response.json();
        setReasons(data.reasons);
        setFileTypes(data.file_types);
      }
    } catch (err) {
      console.error("Failed to fetch reasons:", err);
    }
  }, [jobId]);

  // Initial fetch
  useEffect(() => {
    fetchLogs();
    fetchReasons();
  }, [fetchLogs, fetchReasons]);

  // Auto-refresh when job is active
  useEffect(() => {
    if (jobStatus === "processing" || jobStatus === "scanning") {
      const interval = setInterval(() => {
        fetchLogs();
        fetchReasons();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [jobStatus, fetchLogs, fetchReasons]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [statusFilter, searchQuery]);

  const toggleRow = (logId: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(logId)) {
        next.delete(logId);
      } else {
        next.add(logId);
      }
      return next;
    });
  };

  const formatDuration = (ms: number | null) => {
    if (!ms) return "-";
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const formatBytes = (bytes: number | null) => {
    if (!bytes) return "-";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Migration required message
  if (migrationRequired) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Database Migration Required
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-muted-foreground">
              The import logs feature requires a database migration that has not been applied yet.
            </p>
            <div className="bg-muted rounded-lg p-4">
              <p className="font-medium mb-2">To enable import logs:</p>
              <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                <li>Open your Supabase Studio SQL Editor</li>
                <li>Run the migration file: <code className="bg-background px-1 py-0.5 rounded">supabase/migrations/0011_import_logs.sql</code></li>
                <li>Restart any running imports to see detailed logs</li>
              </ol>
            </div>
            <p className="text-sm text-muted-foreground">
              Note: Logs will only be created for imports started after the migration is applied.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      {summary && (
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-lg flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Import Log Summary
            </CardTitle>
            <CardDescription>
              Detailed processing results for all files in this import
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <div className="text-xl font-bold">{summary.total_files.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">Total Files</div>
              </div>
              <div className={`${STATUS_CONFIG.succeeded.bgColor} rounded-lg p-3 text-center`}>
                <div className={`text-xl font-bold ${STATUS_CONFIG.succeeded.color}`}>
                  {summary.succeeded_count.toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground">Succeeded</div>
              </div>
              <div className={`${STATUS_CONFIG.failed.bgColor} rounded-lg p-3 text-center`}>
                <div className={`text-xl font-bold ${STATUS_CONFIG.failed.color}`}>
                  {summary.failed_count.toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground">Failed</div>
              </div>
              <div className={`${STATUS_CONFIG.skipped.bgColor} rounded-lg p-3 text-center`}>
                <div className={`text-xl font-bold ${STATUS_CONFIG.skipped.color}`}>
                  {summary.skipped_count.toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground">Skipped</div>
              </div>
              <div className={`${STATUS_CONFIG.duplicate.bgColor} rounded-lg p-3 text-center`}>
                <div className={`text-xl font-bold ${STATUS_CONFIG.duplicate.color}`}>
                  {summary.duplicate_count.toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground">Duplicates</div>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <div className="text-xl font-bold">
                  {summary.avg_duration_ms ? formatDuration(summary.avg_duration_ms) : "-"}
                </div>
                <div className="text-xs text-muted-foreground">Avg Time</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reasons Summary */}
      {reasons.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-lg">Skip/Fail Reasons</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {reasons.map((reason, idx) => {
                const config = STATUS_CONFIG[reason.status as ImportLogStatus] || STATUS_CONFIG.failed;
                return (
                  <div
                    key={idx}
                    className={`flex items-center justify-between p-2 rounded-lg ${config.bgColor}`}
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={config.color}>
                        {reason.status}
                      </Badge>
                      <span className="text-sm">{reason.reason}</span>
                    </div>
                    <span className="font-mono text-sm">{reason.count}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="font-heading text-lg">File Logs</CardTitle>
              <CardDescription>
                {total.toLocaleString()} file{total !== 1 ? "s" : ""} total
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                fetchLogs();
                fetchReasons();
              }}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>

          {/* Filters */}
          <div className="flex gap-4 mt-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search filename or path..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="succeeded">Succeeded</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="skipped">Skipped</SelectItem>
                <SelectItem value="duplicate">Duplicate</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="text-center py-8 text-destructive">{error}</div>
          ) : isLoading && logs.length === 0 ? (
            <div className="text-center py-8">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">Loading logs...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No logs found matching your filters
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      <TableHead>File</TableHead>
                      <TableHead className="w-[100px]">Status</TableHead>
                      <TableHead className="w-[80px]">Type</TableHead>
                      <TableHead className="w-[80px]">Size</TableHead>
                      <TableHead className="w-[80px]">Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => {
                      const config = STATUS_CONFIG[log.status] || STATUS_CONFIG.pending;
                      const StatusIcon = config.icon;
                      const isExpanded = expandedRows.has(log.id);

                      return (
                        <React.Fragment key={log.id}>
                          <TableRow
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => toggleRow(log.id)}
                          >
                            <TableCell className="w-8">
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </Button>
                            </TableCell>
                            <TableCell>
                              <div className="truncate max-w-[300px]" title={log.file_path}>
                                {log.filename}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={`${config.color} flex items-center gap-1 w-fit`}
                              >
                                <StatusIcon
                                  className={`h-3 w-3 ${log.status === "processing" ? "animate-spin" : ""}`}
                                />
                                {config.label}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <span className="text-xs text-muted-foreground uppercase">
                                {log.file_type || "-"}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span className="text-xs text-muted-foreground">
                                {formatBytes(log.file_size)}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span className="text-xs text-muted-foreground">
                                {formatDuration(log.processing_duration_ms)}
                              </span>
                            </TableCell>
                          </TableRow>
                          {isExpanded && (
                            <TableRow className="bg-muted/30 hover:bg-muted/30">
                              <TableCell colSpan={6} className="p-4">
                                <div className="space-y-3 text-sm">
                                  {/* File Path */}
                                  <div>
                                    <span className="text-muted-foreground">Path: </span>
                                    <code className="text-xs bg-muted px-1 py-0.5 rounded">
                                      {log.file_path}
                                    </code>
                                  </div>

                                  {/* Reason */}
                                  {log.reason && (
                                    <div>
                                      <span className="text-muted-foreground">Reason: </span>
                                      <span className={config.color}>{log.reason}</span>
                                    </div>
                                  )}

                                  {/* Duplicate Info */}
                                  {log.duplicate_of_design_id && (
                                    <div>
                                      <span className="text-muted-foreground">
                                        Duplicate of:{" "}
                                      </span>
                                      <a
                                        href={`/admin/designs/${log.duplicate_of_design_id}`}
                                        className="text-primary hover:underline"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        View Design
                                      </a>
                                      {log.duplicate_similarity && (
                                        <span className="text-muted-foreground ml-2">
                                          ({log.duplicate_similarity.toFixed(1)}% similar)
                                        </span>
                                      )}
                                    </div>
                                  )}

                                  {/* Created Design */}
                                  {log.design_id && log.status === "succeeded" && (
                                    <div>
                                      <span className="text-muted-foreground">
                                        Created design:{" "}
                                      </span>
                                      <a
                                        href={`/admin/designs/${log.design_id}`}
                                        className="text-primary hover:underline"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        View Design
                                      </a>
                                    </div>
                                  )}

                                  {/* Steps Completed */}
                                  {log.steps_completed && log.steps_completed.length > 0 && (
                                    <div>
                                      <span className="text-muted-foreground">
                                        Steps completed:{" "}
                                      </span>
                                      <div className="flex flex-wrap gap-1 mt-1">
                                        {log.steps_completed.map((step, idx) => (
                                          <Badge
                                            key={idx}
                                            variant="secondary"
                                            className="text-xs"
                                          >
                                            {step.replace(/_/g, " ")}
                                          </Badge>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Details */}
                                  {log.details &&
                                    Object.keys(log.details).length > 0 &&
                                    !isEmptyDetails(log.details) && (
                                      <div>
                                        <span className="text-muted-foreground">Details: </span>
                                        <pre className="mt-1 text-xs bg-muted p-2 rounded overflow-x-auto">
                                          {JSON.stringify(log.details, null, 2)}
                                        </pre>
                                      </div>
                                    )}

                                  {/* Timing */}
                                  {log.processing_started_at && (
                                    <div className="text-xs text-muted-foreground">
                                      Started: {new Date(log.processing_started_at).toLocaleString()}
                                      {log.processing_completed_at && (
                                        <span>
                                          {" "}
                                          | Completed:{" "}
                                          {new Date(log.processing_completed_at).toLocaleString()}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    Showing {((page - 1) * perPage) + 1} to {Math.min(page * perPage, total)} of{" "}
                    {total.toLocaleString()} logs
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      Previous
                    </Button>
                    <span className="flex items-center px-3 text-sm">
                      Page {page} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function isEmptyDetails(details: Record<string, unknown>): boolean {
  const ignoredKeys = ["duplicate_hash", "duplicate_phash"];
  const keys = Object.keys(details).filter((k) => !ignoredKeys.includes(k));
  return keys.length === 0;
}
