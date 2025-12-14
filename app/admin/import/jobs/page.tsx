import { requireAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Clock, CheckCircle, XCircle, Pause, Loader2 } from "lucide-react";
import { DeleteJobButton } from "@/components/admin/DeleteJobButton";
import * as jobService from "@/lib/services/import-job-service";
import type { ImportJobStatus } from "@/lib/types/import";

const STATUS_CONFIG: Record<
  ImportJobStatus,
  { label: string; icon: React.ElementType; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  pending: { label: "Pending", icon: Clock, variant: "secondary" },
  scanning: { label: "Scanning", icon: Loader2, variant: "default" },
  processing: { label: "Processing", icon: Loader2, variant: "default" },
  paused: { label: "Paused", icon: Pause, variant: "outline" },
  completed: { label: "Completed", icon: CheckCircle, variant: "secondary" },
  failed: { label: "Failed", icon: XCircle, variant: "destructive" },
  cancelled: { label: "Cancelled", icon: XCircle, variant: "outline" },
};

export default async function ImportJobsPage() {
  const user = await requireAdmin();
  if (!user) {
    redirect("/login?redirect=/admin/import/jobs");
  }

  const { jobs } = await jobService.listImportJobs({ limit: 50, offset: 0 });

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold">Import Jobs</h1>
          <p className="text-muted-foreground mt-1">Monitor and manage bulk import jobs</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/admin/import">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Import
            </Link>
          </Button>
          <Button asChild>
            <Link href="/admin/import">
              <Plus className="mr-2 h-4 w-4" />
              New Import
            </Link>
          </Button>
        </div>
      </div>

      {jobs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="text-muted-foreground text-center">
              <p className="text-lg font-medium">No import jobs yet</p>
              <p className="text-sm mt-1">Start a new import to process your design files</p>
            </div>
            <Button asChild className="mt-4">
              <Link href="/admin/import">
                <Plus className="mr-2 h-4 w-4" />
                Start Import
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {jobs.map((job) => {
            const status = STATUS_CONFIG[job.status];
            const StatusIcon = status.icon;
            const progress =
              job.total_files > 0
                ? Math.round((job.files_processed / job.total_files) * 100)
                : 0;

            return (
              <Card key={job.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge variant={status.variant} className="flex items-center gap-1">
                        <StatusIcon
                          className={`h-3 w-3 ${
                            job.status === "processing" || job.status === "scanning"
                              ? "animate-spin"
                              : ""
                          }`}
                        />
                        {status.label}
                      </Badge>
                      {job.status === "pending" && job.scheduled_start_at && (
                        <Badge variant="outline" className="flex items-center gap-1 text-primary border-primary/50">
                          <Clock className="h-3 w-3" />
                          {new Date(job.scheduled_start_at).toLocaleString()}
                        </Badge>
                      )}
                      <CardTitle className="font-heading text-lg">
                        {job.source_type === "folder" ? "Folder Import" : "Upload Import"}
                      </CardTitle>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/admin/import/jobs/${job.id}`}>View Details</Link>
                      </Button>
                      <DeleteJobButton
                        jobId={job.id}
                        disabled={job.status === "scanning" || job.status === "processing"}
                      />
                    </div>
                  </div>
                  <CardDescription className="truncate">{job.source_path}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {/* Progress Bar */}
                    {(job.status === "processing" || job.status === "completed") && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span>{progress}% complete</span>
                          <span>
                            {job.files_processed.toLocaleString()} / {job.total_files.toLocaleString()} files
                          </span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all ${
                              job.status === "completed" ? "bg-green-500" : "bg-primary"
                            }`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Stats */}
                    <div className="flex flex-wrap gap-4 text-sm">
                      <div className="flex items-center gap-1">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span>{job.files_succeeded.toLocaleString()} succeeded</span>
                      </div>
                      {job.files_failed > 0 && (
                        <div className="flex items-center gap-1">
                          <XCircle className="h-4 w-4 text-destructive" />
                          <span>{job.files_failed.toLocaleString()} failed</span>
                        </div>
                      )}
                      {job.files_skipped > 0 && (
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <span>{job.files_skipped.toLocaleString()} skipped</span>
                        </div>
                      )}
                    </div>

                    {/* Timestamps */}
                    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                      <span>Created: {new Date(job.created_at).toLocaleString()}</span>
                      {job.started_at && (
                        <span>Started: {new Date(job.started_at).toLocaleString()}</span>
                      )}
                      {job.completed_at && (
                        <span>Completed: {new Date(job.completed_at).toLocaleString()}</span>
                      )}
                    </div>

                    {/* Error Message */}
                    {job.error_message && (
                      <div className="text-sm text-destructive bg-destructive/10 p-2 rounded">
                        {job.error_message}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
