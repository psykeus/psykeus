"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Play,
  Pause,
  XCircle,
  CheckCircle,
  Clock,
  Loader2,
  RefreshCw,
  AlertTriangle,
  FileText,
  Trash2,
  Undo2,
  Sparkles,
  ScrollText,
} from "lucide-react";
import { ImportLogsPanel } from "@/components/admin/ImportLogsPanel";
import { ScheduleImportDialog } from "@/components/admin/ScheduleImportDialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ImportJob, ImportItem, ImportEvent, ImportJobStatus } from "@/lib/types/import";

interface Props {
  initialJob: ImportJob;
}

const STATUS_CONFIG: Record<
  ImportJobStatus,
  { label: string; icon: React.ElementType; color: string }
> = {
  pending: { label: "Pending", icon: Clock, color: "text-muted-foreground" },
  scanning: { label: "Scanning", icon: Loader2, color: "text-blue-500" },
  processing: { label: "Processing", icon: Loader2, color: "text-primary" },
  paused: { label: "Paused", icon: Pause, color: "text-yellow-500" },
  completed: { label: "Completed", icon: CheckCircle, color: "text-green-500" },
  failed: { label: "Failed", icon: XCircle, color: "text-destructive" },
  cancelled: { label: "Cancelled", icon: XCircle, color: "text-muted-foreground" },
};

export function JobDetailsClient({ initialJob }: Props) {
  const router = useRouter();
  const [job, setJob] = useState<ImportJob>(initialJob);
  const [items, setItems] = useState<ImportItem[]>([]);
  const [failedItems, setFailedItems] = useState<ImportItem[]>([]);
  const [aiStats, setAiStats] = useState<{ requested: number; generated: number; failed: number } | null>(null);
  const [currentFile, setCurrentFile] = useState<string | null>(null);
  const [eta, setEta] = useState<number | null>(null);
  const [itemsPerMinute, setItemsPerMinute] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("progress");
  const [undoState, setUndoState] = useState<{
    isOpen: boolean;
    stage: "confirm" | "deleting" | "complete" | "error";
    message: string;
    deletedCount?: number;
  }>({
    isOpen: false,
    stage: "confirm",
    message: "",
  });

  // Fetch job progress from API
  const fetchJobProgress = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/import/jobs/${job.id}`);
      if (response.ok) {
        const data = await response.json();
        if (data.job) {
          setJob(data.job);
        }
        if (data.ai_stats) {
          setAiStats(data.ai_stats);
        }
      }
    } catch (err) {
      console.error("Failed to fetch job progress:", err);
    }
  }, [job.id]);

  // Fetch items
  const fetchItems = useCallback(async (status?: string) => {
    try {
      const url = status
        ? `/api/admin/import/jobs/${job.id}/items?status=${status}&limit=50`
        : `/api/admin/import/jobs/${job.id}/items?limit=50`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        if (status === "failed") {
          setFailedItems(data.items);
        } else {
          setItems(data.items);
        }
      }
    } catch (err) {
      console.error("Failed to fetch items:", err);
    }
  }, [job.id]);

  // Subscribe to SSE events
  useEffect(() => {
    if (job.status !== "processing" && job.status !== "scanning") {
      return;
    }

    const eventSource = new EventSource(`/api/admin/import/jobs/${job.id}/stream`);

    eventSource.onmessage = (event) => {
      try {
        const data: ImportEvent = JSON.parse(event.data);

        switch (data.type) {
          case "progress:update":
            setJob((prev) => ({
              ...prev,
              files_processed: (data.data.files_processed as number) ?? prev.files_processed,
              files_succeeded: (data.data.files_succeeded as number) ?? prev.files_succeeded,
              files_failed: (data.data.files_failed as number) ?? prev.files_failed,
              files_skipped: (data.data.files_skipped as number) ?? prev.files_skipped,
              status: (data.data.status as ImportJobStatus) ?? prev.status,
            }));
            setCurrentFile((data.data.current_file as string) ?? null);
            setEta((data.data.eta_seconds as number) ?? null);
            setItemsPerMinute((data.data.items_per_minute as number) ?? null);
            break;

          case "job:completed":
          case "job:failed":
          case "job:cancelled":
            setJob((prev) => ({
              ...prev,
              status: data.type === "job:completed"
                ? "completed"
                : data.type === "job:failed"
                ? "failed"
                : "cancelled",
              completed_at: data.timestamp,
              error_message: (data.data.error as string) ?? prev.error_message,
            }));
            fetchItems("failed");
            break;

          case "job:paused":
            setJob((prev) => ({ ...prev, status: "paused" }));
            break;

          case "item:failed":
            setFailedItems((prev) => {
              const newItem = data.data as unknown as ImportItem;
              if (prev.find((i) => i.id === newItem.id)) return prev;
              return [...prev, newItem].slice(-50);
            });
            break;
        }
      } catch (err) {
        console.error("SSE parse error:", err);
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [job.id, job.status, fetchItems]);

  // Poll for progress updates when job is active (fallback for SSE)
  useEffect(() => {
    if (job.status !== "processing" && job.status !== "scanning") {
      return;
    }

    // Fetch immediately on mount
    fetchJobProgress();
    fetchItems("failed");

    // Poll every 2 seconds
    const pollInterval = setInterval(() => {
      fetchJobProgress();
      fetchItems("failed");
    }, 2000);

    return () => {
      clearInterval(pollInterval);
    };
  }, [job.status, fetchJobProgress, fetchItems]);

  // Fetch failed items and AI stats on mount
  useEffect(() => {
    fetchItems("failed");
    // Also fetch job data to get AI stats (especially for completed jobs)
    fetchJobProgress();
  }, [fetchItems, fetchJobProgress]);

  // Actions
  const handleStart = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/admin/import/jobs/${job.id}/start`, {
        method: "POST",
      });
      if (response.ok) {
        setJob((prev) => ({ ...prev, status: "processing" }));
      }
    } catch (err) {
      console.error("Failed to start job:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePause = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/admin/import/jobs/${job.id}/pause`, {
        method: "POST",
      });
      if (response.ok) {
        setJob((prev) => ({ ...prev, status: "paused" }));
      }
    } catch (err) {
      console.error("Failed to pause job:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm("Are you sure you want to cancel this import job?")) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/admin/import/jobs/${job.id}/cancel`, {
        method: "POST",
      });
      if (response.ok) {
        setJob((prev) => ({ ...prev, status: "cancelled" }));
      }
    } catch (err) {
      console.error("Failed to cancel job:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this import job? This cannot be undone.")) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/admin/import/jobs/${job.id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        router.push("/admin/import/jobs");
      }
    } catch (err) {
      console.error("Failed to delete job:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearSchedule = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/admin/import/jobs/${job.id}/schedule`, {
        method: "DELETE",
      });
      if (response.ok) {
        setJob((prev) => ({
          ...prev,
          scheduled_start_at: null,
          schedule_type: null,
        }));
        router.refresh();
      }
    } catch (err) {
      console.error("Failed to clear schedule:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const openUndoDialog = () => {
    setUndoState({
      isOpen: true,
      stage: "confirm",
      message: "",
    });
  };

  const closeUndoDialog = () => {
    if (undoState.stage === "deleting") return; // Don't allow closing during deletion
    setUndoState((prev) => ({ ...prev, isOpen: false }));
  };

  const handleUndo = async () => {
    setUndoState({
      isOpen: true,
      stage: "deleting",
      message: "Preparing to delete designs...",
    });

    try {
      // Show initial message
      setUndoState((prev) => ({
        ...prev,
        message: `Deleting ${job.files_succeeded} design(s) and their files...`,
      }));

      const response = await fetch(`/api/admin/import/jobs/${job.id}/undo`, {
        method: "POST",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to undo import");
      }

      setUndoState({
        isOpen: true,
        stage: "complete",
        message: data.message,
        deletedCount: data.deleted_count,
      });

      // Refresh after a short delay so user can see the success message
      setTimeout(() => {
        router.refresh();
      }, 1500);
    } catch (err) {
      console.error("Failed to undo import:", err);
      setUndoState({
        isOpen: true,
        stage: "error",
        message: err instanceof Error ? err.message : "Failed to undo import",
      });
    }
  };

  const handleRetryFailed = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/admin/import/jobs/${job.id}/retry`, {
        method: "POST",
      });
      if (response.ok) {
        setJob((prev) => ({ ...prev, status: "processing" }));
        setFailedItems([]);
      }
    } catch (err) {
      console.error("Failed to retry:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const status = STATUS_CONFIG[job.status];
  const StatusIcon = status.icon;
  const progress = job.total_files > 0 ? Math.round((job.files_processed / job.total_files) * 100) : 0;
  const isActive = job.status === "processing" || job.status === "scanning";

  return (
    <div className="space-y-6">
      {/* Status & Actions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <StatusIcon
                className={`h-6 w-6 ${status.color} ${isActive ? "animate-spin" : ""}`}
              />
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle className="font-heading">{status.label}</CardTitle>
                  {job.status === "pending" && job.scheduled_start_at && (
                    <Badge variant="secondary" className="gap-1">
                      <Clock className="h-3 w-3" />
                      Scheduled
                    </Badge>
                  )}
                </div>
                <CardDescription>
                  {job.source_type === "folder" ? "Folder Import" : "Upload Import"}
                  {job.status === "pending" && job.scheduled_start_at && (
                    <span className="ml-2 text-primary">
                      Starting {new Date(job.scheduled_start_at).toLocaleString()}
                    </span>
                  )}
                </CardDescription>
              </div>
            </div>
            <div className="flex gap-2">
              {job.status === "pending" && !job.scheduled_start_at && (
                <>
                  <Button onClick={handleStart} disabled={isLoading}>
                    <Play className="mr-2 h-4 w-4" />
                    Start Now
                  </Button>
                  <ScheduleImportDialog jobId={job.id} disabled={isLoading} />
                </>
              )}
              {job.status === "pending" && job.scheduled_start_at && (
                <>
                  <Button onClick={handleStart} disabled={isLoading}>
                    <Play className="mr-2 h-4 w-4" />
                    Start Now
                  </Button>
                  <Button onClick={handleClearSchedule} variant="outline" disabled={isLoading}>
                    <XCircle className="mr-2 h-4 w-4" />
                    Clear Schedule
                  </Button>
                </>
              )}
              {job.status === "paused" && (
                <Button onClick={handleStart} disabled={isLoading}>
                  <Play className="mr-2 h-4 w-4" />
                  Resume
                </Button>
              )}
              {isActive && (
                <Button onClick={handlePause} variant="outline" disabled={isLoading}>
                  <Pause className="mr-2 h-4 w-4" />
                  Pause
                </Button>
              )}
              {(isActive || job.status === "paused") && (
                <Button onClick={handleCancel} variant="destructive" disabled={isLoading}>
                  <XCircle className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
              )}
              {(job.status === "pending" || job.status === "completed" || job.status === "cancelled" || job.status === "failed") && (
                <>
                  {job.files_succeeded > 0 && (
                    <Button onClick={openUndoDialog} variant="outline" disabled={isLoading}>
                      <Undo2 className="mr-2 h-4 w-4" />
                      Undo Import
                    </Button>
                  )}
                  <Button onClick={handleDelete} variant="outline" disabled={isLoading}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                </>
              )}
              {job.status === "failed" && failedItems.length > 0 && (
                <Button onClick={handleRetryFailed} disabled={isLoading}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Retry Failed
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>{progress}% complete</span>
              <span>
                {job.files_processed.toLocaleString()} / {job.total_files.toLocaleString()} files
              </span>
            </div>
            <Progress value={progress} className="h-3" />
          </div>

          {/* Current File */}
          {currentFile && isActive && (
            <div className="text-sm text-muted-foreground truncate">
              Processing: {currentFile}
            </div>
          )}

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <div className="text-xl font-bold">{job.total_files.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">Total</div>
            </div>
            <div className="bg-green-500/10 rounded-lg p-3 text-center">
              <div className="text-xl font-bold text-green-600">{job.files_succeeded.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">Succeeded</div>
            </div>
            <div className="bg-destructive/10 rounded-lg p-3 text-center">
              <div className="text-xl font-bold text-destructive">{job.files_failed.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">Failed</div>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <div className="text-xl font-bold">{job.files_skipped.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">Skipped</div>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <div className="text-xl font-bold">
                {itemsPerMinute ? `${itemsPerMinute.toFixed(1)}/min` : "-"}
              </div>
              <div className="text-xs text-muted-foreground">Speed</div>
            </div>
          </div>

          {/* ETA */}
          {eta && isActive && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              Estimated time remaining: {formatEta(eta)}
            </div>
          )}

          {/* Error Message */}
          {job.error_message && (
            <div className="flex items-start gap-2 text-destructive bg-destructive/10 p-3 rounded-lg">
              <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{job.error_message}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Options Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">Import Options</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Badge variant={job.generate_previews ? "default" : "secondary"}>
              {job.generate_previews ? "Previews: On" : "Previews: Off"}
            </Badge>
            <Badge variant={job.detect_duplicates ? "default" : "secondary"}>
              {job.detect_duplicates ? "Duplicate Detection: On" : "Duplicate Detection: Off"}
            </Badge>
            <Badge variant={job.generate_ai_metadata ? "default" : "secondary"}>
              {job.generate_ai_metadata ? "AI Metadata: On" : "AI Metadata: Off"}
            </Badge>
            <Badge variant={job.auto_publish ? "default" : "secondary"}>
              {job.auto_publish ? "Auto-Publish: On" : "Auto-Publish: Off"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* AI Metadata Statistics */}
      {job.generate_ai_metadata && aiStats && (
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-lg flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              AI Metadata Generation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <div className="text-xl font-bold">{aiStats.requested}</div>
                <div className="text-xs text-muted-foreground">Requested</div>
              </div>
              <div className="bg-green-500/10 rounded-lg p-3 text-center">
                <div className="text-xl font-bold text-green-600">{aiStats.generated}</div>
                <div className="text-xs text-muted-foreground">Generated</div>
              </div>
              <div className="bg-amber-500/10 rounded-lg p-3 text-center">
                <div className="text-xl font-bold text-amber-600">{aiStats.failed}</div>
                <div className="text-xs text-muted-foreground">Failed/Fallback</div>
              </div>
            </div>
            {aiStats.requested > 0 && (
              <div className="mt-4 text-sm text-muted-foreground">
                {aiStats.generated === 0 && aiStats.failed > 0 ? (
                  <div className="flex items-start gap-2 bg-amber-500/10 text-amber-700 p-3 rounded-lg">
                    <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>
                      AI metadata generation is failing. Check server logs for details.
                      Common causes: missing <code className="bg-muted px-1 rounded">AI_API_KEY</code> environment variable,
                      API rate limits, or network issues.
                    </span>
                  </div>
                ) : (
                  <span>
                    Success rate: {((aiStats.generated / aiStats.requested) * 100).toFixed(1)}%
                  </span>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Failed Items */}
      {failedItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Failed Items ({failedItems.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {failedItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-2 text-sm bg-muted/50 p-2 rounded"
                >
                  <FileText className="h-4 w-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <div className="truncate font-medium">{item.filename}</div>
                    <div className="text-xs text-destructive">{item.error_message}</div>
                  </div>
                  <Badge variant="outline" className="text-xs flex-shrink-0">
                    {item.retry_count} retries
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Timestamps */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Created</span>
              <span>{new Date(job.created_at).toLocaleString()}</span>
            </div>
            {job.started_at && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Started</span>
                <span>{new Date(job.started_at).toLocaleString()}</span>
              </div>
            )}
            {job.completed_at && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Completed</span>
                <span>{new Date(job.completed_at).toLocaleString()}</span>
              </div>
            )}
            {job.started_at && job.completed_at && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Duration</span>
                <span>
                  {formatDuration(
                    new Date(job.completed_at).getTime() - new Date(job.started_at).getTime()
                  )}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Detailed Logs Section */}
      <div className="pt-4 border-t">
        <div className="flex items-center gap-2 mb-4">
          <ScrollText className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-heading font-semibold">Detailed Import Logs</h2>
        </div>
        <ImportLogsPanel jobId={job.id} jobStatus={job.status} />
      </div>

      {/* Undo Confirmation/Progress Dialog */}
      <Dialog open={undoState.isOpen} onOpenChange={(open) => !open && closeUndoDialog()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {undoState.stage === "confirm" && (
                <>
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  Confirm Undo Import
                </>
              )}
              {undoState.stage === "deleting" && (
                <>
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  Undoing Import...
                </>
              )}
              {undoState.stage === "complete" && (
                <>
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  Import Undone
                </>
              )}
              {undoState.stage === "error" && (
                <>
                  <XCircle className="h-5 w-5 text-destructive" />
                  Undo Failed
                </>
              )}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {undoState.stage === "confirm" ? "Confirm undo import" : "Undo progress"}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {undoState.stage === "confirm" && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  This will permanently delete all <strong>{job.files_succeeded}</strong> design(s)
                  created by this import job.
                </p>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>All design files will be removed from storage</li>
                  <li>Preview images will be deleted</li>
                  <li>Import items will be reset to pending status</li>
                </ul>
                <p className="text-sm font-medium text-destructive">
                  This action cannot be undone.
                </p>
              </div>
            )}

            {undoState.stage === "deleting" && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">{undoState.message}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Progress value={undefined} className="h-2" />
                  <p className="text-xs text-muted-foreground text-center">
                    Please wait, this may take a moment for large imports...
                  </p>
                </div>
              </div>
            )}

            {undoState.stage === "complete" && (
              <div className="space-y-2">
                <p className="text-sm text-green-600">{undoState.message}</p>
                <p className="text-xs text-muted-foreground">Refreshing page...</p>
              </div>
            )}

            {undoState.stage === "error" && (
              <div className="space-y-2">
                <p className="text-sm text-destructive">{undoState.message}</p>
                <p className="text-xs text-muted-foreground">
                  Please try again or contact support if the issue persists.
                </p>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            {undoState.stage === "confirm" && (
              <>
                <Button variant="outline" onClick={closeUndoDialog}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleUndo}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Yes, Undo Import
                </Button>
              </>
            )}
            {undoState.stage === "error" && (
              <Button variant="outline" onClick={closeUndoDialog}>
                Close
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function formatEta(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  }
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}
