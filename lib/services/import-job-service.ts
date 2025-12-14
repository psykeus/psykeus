/**
 * Import Job Service
 * CRUD operations and status management for import jobs
 */

import { createServiceClient } from "@/lib/supabase/server";
import type {
  ImportJob,
  ImportJobStatus,
  CreateImportJobRequest,
  ImportJobWithProgress,
} from "@/lib/types/import";
import { DEFAULT_PROCESSING_OPTIONS } from "@/lib/types/import";

/**
 * Create a new import job
 */
export async function createImportJob(
  userId: string,
  request: CreateImportJobRequest
): Promise<ImportJob> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("import_jobs")
    .insert({
      created_by: userId,
      source_type: request.source_type,
      source_path: request.source_path || null,
      generate_previews: request.generate_previews ?? DEFAULT_PROCESSING_OPTIONS.generate_previews,
      generate_ai_metadata:
        request.generate_ai_metadata ?? DEFAULT_PROCESSING_OPTIONS.generate_ai_metadata,
      detect_duplicates: request.detect_duplicates ?? DEFAULT_PROCESSING_OPTIONS.detect_duplicates,
      auto_publish: request.auto_publish ?? DEFAULT_PROCESSING_OPTIONS.auto_publish,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create import job: ${error.message}`);
  }

  return data;
}

/**
 * Get an import job by ID
 * Uses service client to bypass RLS since API routes handle auth
 */
export async function getImportJob(jobId: string): Promise<ImportJob | null> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("import_jobs")
    .select("*")
    .eq("id", jobId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`Failed to get import job: ${error.message}`);
  }

  return data;
}

/**
 * Get an import job with progress calculations
 */
export async function getImportJobWithProgress(
  jobId: string
): Promise<ImportJobWithProgress | null> {
  const job = await getImportJob(jobId);
  if (!job) return null;

  return calculateProgress(job);
}

/**
 * List import jobs with optional filtering
 * Uses service client to bypass RLS since API routes handle auth
 */
export async function listImportJobs(options?: {
  userId?: string;
  status?: ImportJobStatus[];
  limit?: number;
  offset?: number;
}): Promise<{ jobs: ImportJobWithProgress[]; total: number }> {
  const supabase = createServiceClient();

  let query = supabase
    .from("import_jobs")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  if (options?.userId) {
    query = query.eq("created_by", options.userId);
  }

  if (options?.status && options.status.length > 0) {
    query = query.in("status", options.status);
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 20) - 1);
  }

  const { data, error, count } = await query;

  if (error) {
    throw new Error(`Failed to list import jobs: ${error.message}`);
  }

  const jobs = (data || []).map((job) => calculateProgress(job));

  return { jobs, total: count || 0 };
}

/**
 * Update job status
 */
export async function updateJobStatus(
  jobId: string,
  status: ImportJobStatus,
  additionalData?: Partial<ImportJob>
): Promise<ImportJob> {
  const supabase = createServiceClient();

  const updateData: Partial<ImportJob> & { status: ImportJobStatus } = {
    status,
    ...additionalData,
  };

  // Set timing fields based on status
  if (status === "processing" && !additionalData?.started_at) {
    updateData.started_at = new Date().toISOString();
  }

  if (["completed", "failed", "cancelled"].includes(status)) {
    updateData.completed_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from("import_jobs")
    .update(updateData)
    .eq("id", jobId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update job status: ${error.message}`);
  }

  return data;
}

/**
 * Update job progress counters
 */
export async function updateJobProgress(
  jobId: string,
  progress: {
    files_scanned?: number;
    files_processed?: number;
    files_succeeded?: number;
    files_failed?: number;
    files_skipped?: number;
    total_files?: number;
  }
): Promise<void> {
  const supabase = createServiceClient();

  const { error } = await supabase.from("import_jobs").update(progress).eq("id", jobId);

  if (error) {
    throw new Error(`Failed to update job progress: ${error.message}`);
  }
}

/**
 * Increment a specific counter
 */
export async function incrementJobCounter(
  jobId: string,
  counter: "files_processed" | "files_succeeded" | "files_failed" | "files_skipped"
): Promise<void> {
  const supabase = createServiceClient();

  // Use RPC for atomic increment (or fall back to read-update)
  const { data: job } = await supabase
    .from("import_jobs")
    .select(counter)
    .eq("id", jobId)
    .single();

  if (job) {
    const currentValue = (job as Record<string, number>)[counter] || 0;
    await supabase
      .from("import_jobs")
      .update({ [counter]: currentValue + 1 })
      .eq("id", jobId);
  }
}

/**
 * Set job error
 */
export async function setJobError(
  jobId: string,
  error: string,
  details?: Record<string, unknown>
): Promise<void> {
  await updateJobStatus(jobId, "failed", {
    error_message: error,
    error_details: details || null,
  });
}

/**
 * Cancel a job
 */
export async function cancelJob(jobId: string): Promise<ImportJob> {
  const job = await getImportJob(jobId);

  if (!job) {
    throw new Error("Job not found");
  }

  if (["completed", "failed", "cancelled"].includes(job.status)) {
    throw new Error(`Cannot cancel job with status: ${job.status}`);
  }

  return updateJobStatus(jobId, "cancelled");
}

/**
 * Pause a running job
 */
export async function pauseJob(jobId: string): Promise<ImportJob> {
  const job = await getImportJob(jobId);

  if (!job) {
    throw new Error("Job not found");
  }

  if (job.status !== "processing") {
    throw new Error(`Cannot pause job with status: ${job.status}`);
  }

  return updateJobStatus(jobId, "paused");
}

/**
 * Resume a paused job
 */
export async function resumeJob(jobId: string): Promise<ImportJob> {
  const job = await getImportJob(jobId);

  if (!job) {
    throw new Error("Job not found");
  }

  if (job.status !== "paused") {
    throw new Error(`Cannot resume job with status: ${job.status}`);
  }

  return updateJobStatus(jobId, "processing");
}

/**
 * Delete a job and all associated data
 */
export async function deleteJob(jobId: string): Promise<void> {
  const supabase = createServiceClient();

  // Delete will cascade to items and detected projects
  const { error } = await supabase.from("import_jobs").delete().eq("id", jobId);

  if (error) {
    throw new Error(`Failed to delete job: ${error.message}`);
  }
}

/**
 * Get active (in-progress) jobs
 * Uses service client to bypass RLS since API routes handle auth
 */
export async function getActiveJobs(): Promise<ImportJob[]> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("import_jobs")
    .select("*")
    .in("status", ["scanning", "processing"])
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to get active jobs: ${error.message}`);
  }

  return data || [];
}

/**
 * Calculate progress metrics for a job
 */
function calculateProgress(job: ImportJob): ImportJobWithProgress {
  const processed = job.files_processed || 0;
  const total = job.total_files || 0;

  const progress_percentage = total > 0 ? Math.round((processed / total) * 100) : 0;

  // Calculate ETA based on processing rate
  let eta_seconds: number | null = null;
  let items_per_minute: number | null = null;

  if (job.started_at && processed > 0 && job.status === "processing") {
    const startTime = new Date(job.started_at).getTime();
    const elapsed = (Date.now() - startTime) / 1000; // seconds
    const rate = processed / elapsed; // items per second
    const remaining = total - processed;

    if (rate > 0) {
      eta_seconds = Math.round(remaining / rate);
      items_per_minute = Math.round(rate * 60);
    }
  }

  return {
    ...job,
    progress_percentage,
    eta_seconds,
    items_per_minute,
  };
}
