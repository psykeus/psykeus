/**
 * Import Log Service
 *
 * Provides CRUD operations for import_logs table.
 * Used to track detailed processing results for each file in an import job.
 *
 * Created: 2025-12-07
 * AI Model: Claude Opus 4.5 (claude-opus-4-5-20251101)
 */

import { createServiceClient } from "@/lib/supabase/server";
import { escapeIlikePattern } from "@/lib/validations";
import type {
  ImportLog,
  ImportLogStatus,
  ImportLogSummary,
  ImportLogReasonGroup,
  ImportLogFilters,
  CreateImportLogRequest,
  ImportProcessingStep,
  DuplicateType,
  ImportLogDetails,
} from "@/lib/types/import";

// ============================================================================
// Log Creation
// ============================================================================

/**
 * Create a new import log entry.
 *
 * @param data - Log entry data
 * @returns Created log entry or null on error
 */
export async function createImportLog(
  data: CreateImportLogRequest
): Promise<ImportLog | null> {
  const supabase = createServiceClient();

  const { data: log, error } = await supabase
    .from("import_logs")
    .insert({
      job_id: data.job_id,
      item_id: data.item_id || null,
      file_path: data.file_path,
      filename: data.filename,
      file_type: data.file_type || null,
      file_size: data.file_size || null,
      status: data.status,
      reason: data.reason || null,
      details: data.details || {},
      steps_completed: data.steps_completed || [],
      design_id: data.design_id || null,
      design_file_id: data.design_file_id || null,
      duplicate_of_design_id: data.duplicate_of_design_id || null,
      duplicate_type: data.duplicate_type || null,
      duplicate_similarity: data.duplicate_similarity || null,
      processing_started_at: data.processing_started_at || null,
      processing_completed_at: data.processing_completed_at || null,
      processing_duration_ms: data.processing_duration_ms || null,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating import log:", error);
    return null;
  }

  return log as ImportLog;
}

/**
 * Create multiple log entries in a batch.
 *
 * @param logs - Array of log entries to create
 * @returns Number of logs created
 */
export async function createImportLogsBatch(
  logs: CreateImportLogRequest[]
): Promise<number> {
  if (logs.length === 0) return 0;

  const supabase = createServiceClient();

  const insertData = logs.map((data) => ({
    job_id: data.job_id,
    item_id: data.item_id || null,
    file_path: data.file_path,
    filename: data.filename,
    file_type: data.file_type || null,
    file_size: data.file_size || null,
    status: data.status,
    reason: data.reason || null,
    details: data.details || {},
    steps_completed: data.steps_completed || [],
    design_id: data.design_id || null,
    design_file_id: data.design_file_id || null,
    duplicate_of_design_id: data.duplicate_of_design_id || null,
    duplicate_type: data.duplicate_type || null,
    duplicate_similarity: data.duplicate_similarity || null,
    processing_started_at: data.processing_started_at || null,
    processing_completed_at: data.processing_completed_at || null,
    processing_duration_ms: data.processing_duration_ms || null,
  }));

  const { error, count } = await supabase
    .from("import_logs")
    .insert(insertData);

  if (error) {
    console.error("Error creating import logs batch:", error);
    return 0;
  }

  return count || logs.length;
}

// ============================================================================
// Log Updates
// ============================================================================

/**
 * Update an existing log entry.
 *
 * @param logId - Log entry ID
 * @param updates - Fields to update
 * @returns Updated log or null on error
 */
export async function updateImportLog(
  logId: string,
  updates: Partial<Omit<ImportLog, "id" | "job_id" | "created_at">>
): Promise<ImportLog | null> {
  const supabase = createServiceClient();

  const { data: log, error } = await supabase
    .from("import_logs")
    .update(updates)
    .eq("id", logId)
    .select()
    .single();

  if (error) {
    console.error("Error updating import log:", error);
    return null;
  }

  return log as ImportLog;
}

/**
 * Mark a log as processing started.
 *
 * @param logId - Log entry ID
 * @returns Updated log or null
 */
export async function markLogProcessing(logId: string): Promise<ImportLog | null> {
  return updateImportLog(logId, {
    status: "processing",
    processing_started_at: new Date().toISOString(),
  });
}

/**
 * Calculate processing duration for a log entry.
 * Fetches the log's processing_started_at and calculates duration from now.
 *
 * @param logId - Log entry ID
 * @returns Object with completedAt timestamp and durationMs (or null if not started)
 */
async function calculateProcessingDuration(
  logId: string
): Promise<{ completedAt: string; durationMs: number | null }> {
  const now = new Date().toISOString();
  const supabase = createServiceClient();

  const { data: current } = await supabase
    .from("import_logs")
    .select("processing_started_at")
    .eq("id", logId)
    .single();

  let durationMs: number | null = null;
  if (current?.processing_started_at) {
    durationMs = new Date(now).getTime() - new Date(current.processing_started_at).getTime();
  }

  return { completedAt: now, durationMs };
}

/**
 * Mark a log as succeeded with result details.
 *
 * @param logId - Log entry ID
 * @param result - Success result data
 * @returns Updated log or null
 */
export async function markLogSucceeded(
  logId: string,
  result: {
    design_id?: string;
    design_file_id?: string;
    steps_completed: ImportProcessingStep[];
    details?: Partial<ImportLogDetails>;
  }
): Promise<ImportLog | null> {
  const { completedAt, durationMs } = await calculateProcessingDuration(logId);

  return updateImportLog(logId, {
    status: "succeeded",
    design_id: result.design_id || null,
    design_file_id: result.design_file_id || null,
    steps_completed: result.steps_completed,
    details: result.details || {},
    processing_completed_at: completedAt,
    processing_duration_ms: durationMs,
  });
}

/**
 * Mark a log as failed with error details.
 *
 * @param logId - Log entry ID
 * @param error - Error information
 * @returns Updated log or null
 */
export async function markLogFailed(
  logId: string,
  error: {
    reason: string;
    steps_completed: ImportProcessingStep[];
    details?: Partial<ImportLogDetails>;
  }
): Promise<ImportLog | null> {
  const { completedAt, durationMs } = await calculateProcessingDuration(logId);

  return updateImportLog(logId, {
    status: "failed",
    reason: error.reason,
    steps_completed: error.steps_completed,
    details: error.details || {},
    processing_completed_at: completedAt,
    processing_duration_ms: durationMs,
  });
}

/**
 * Mark a log as skipped with reason.
 *
 * @param logId - Log entry ID
 * @param skip - Skip information
 * @returns Updated log or null
 */
export async function markLogSkipped(
  logId: string,
  skip: {
    reason: string;
    details?: Partial<ImportLogDetails>;
  }
): Promise<ImportLog | null> {
  return updateImportLog(logId, {
    status: "skipped",
    reason: skip.reason,
    details: skip.details || {},
    processing_completed_at: new Date().toISOString(),
  });
}

/**
 * Mark a log as duplicate.
 *
 * @param logId - Log entry ID
 * @param duplicate - Duplicate information
 * @returns Updated log or null
 */
export async function markLogDuplicate(
  logId: string,
  duplicate: {
    duplicate_of_design_id: string;
    duplicate_type: DuplicateType;
    duplicate_similarity?: number;
    reason: string;
    details?: Partial<ImportLogDetails>;
  }
): Promise<ImportLog | null> {
  return updateImportLog(logId, {
    status: "duplicate",
    reason: duplicate.reason,
    duplicate_of_design_id: duplicate.duplicate_of_design_id,
    duplicate_type: duplicate.duplicate_type,
    duplicate_similarity: duplicate.duplicate_similarity || null,
    details: duplicate.details || {},
    processing_completed_at: new Date().toISOString(),
  });
}

// ============================================================================
// Log Queries
// ============================================================================

/**
 * Get a single log by ID.
 *
 * @param logId - Log entry ID
 * @returns Log entry or null
 */
export async function getImportLog(logId: string): Promise<ImportLog | null> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("import_logs")
    .select("*")
    .eq("id", logId)
    .single();

  if (error) {
    console.error("Error fetching import log:", error);
    return null;
  }

  return data as ImportLog;
}

/**
 * Get all logs for a job with optional filtering and pagination.
 *
 * @param jobId - Import job ID
 * @param options - Query options
 * @returns Paginated logs and total count
 */
export async function getImportLogs(
  jobId: string,
  options: {
    filters?: ImportLogFilters;
    page?: number;
    perPage?: number;
    orderBy?: "created_at" | "filename" | "status" | "processing_duration_ms";
    orderDir?: "asc" | "desc";
  } = {}
): Promise<{ logs: ImportLog[]; total: number }> {
  const supabase = createServiceClient();
  const {
    filters = {},
    page = 1,
    perPage = 50,
    orderBy = "created_at",
    orderDir = "asc",
  } = options;

  let query = supabase
    .from("import_logs")
    .select("*", { count: "exact" })
    .eq("job_id", jobId);

  // Apply filters
  if (filters.status && filters.status.length > 0) {
    query = query.in("status", filters.status);
  }

  if (filters.file_type && filters.file_type.length > 0) {
    query = query.in("file_type", filters.file_type);
  }

  if (filters.has_reason === true) {
    query = query.not("reason", "is", null);
  } else if (filters.has_reason === false) {
    query = query.is("reason", null);
  }

  if (filters.search) {
    const escapedSearch = escapeIlikePattern(filters.search);
    query = query.or(`filename.ilike.%${escapedSearch}%,file_path.ilike.%${escapedSearch}%`);
  }

  // Apply ordering
  query = query.order(orderBy, { ascending: orderDir === "asc" });

  // Apply pagination
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;

  if (error) {
    console.error("Error fetching import logs:", error);
    return { logs: [], total: 0 };
  }

  return { logs: data as ImportLog[], total: count || 0 };
}

/**
 * Get logs by status for a job.
 *
 * @param jobId - Import job ID
 * @param status - Status to filter by
 * @returns Array of logs
 */
export async function getLogsByStatus(
  jobId: string,
  status: ImportLogStatus
): Promise<ImportLog[]> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("import_logs")
    .select("*")
    .eq("job_id", jobId)
    .eq("status", status)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching logs by status:", error);
    return [];
  }

  return data as ImportLog[];
}

// ============================================================================
// Log Summary & Analytics
// ============================================================================

/**
 * Get summary statistics for a job's logs.
 *
 * @param jobId - Import job ID
 * @returns Summary statistics
 */
export async function getImportLogSummary(jobId: string): Promise<ImportLogSummary | null> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("import_log_summary")
    .select("*")
    .eq("job_id", jobId)
    .single();

  if (error) {
    // View might not have data yet
    if (error.code === "PGRST116") {
      return {
        job_id: jobId,
        total_files: 0,
        succeeded_count: 0,
        failed_count: 0,
        skipped_count: 0,
        duplicate_count: 0,
        pending_count: 0,
        processing_count: 0,
        total_size_bytes: 0,
        first_started: null,
        last_completed: null,
        avg_duration_ms: null,
      };
    }
    console.error("Error fetching log summary:", error);
    return null;
  }

  return data as ImportLogSummary;
}

/**
 * Get grouped reasons for skip/fail logs.
 *
 * @param jobId - Import job ID
 * @returns Array of reason groups with counts
 */
export async function getImportLogReasons(jobId: string): Promise<ImportLogReasonGroup[]> {
  const supabase = createServiceClient();

  const { data, error } = await supabase.rpc("get_import_log_reasons", {
    p_job_id: jobId,
  });

  if (error) {
    console.error("Error fetching log reasons:", error);
    return [];
  }

  return data as ImportLogReasonGroup[];
}

/**
 * Get file type distribution for a job's logs.
 *
 * @param jobId - Import job ID
 * @returns Map of file type to count
 */
export async function getLogFileTypeDistribution(
  jobId: string
): Promise<Record<string, number>> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("import_logs")
    .select("file_type")
    .eq("job_id", jobId);

  if (error) {
    console.error("Error fetching file type distribution:", error);
    return {};
  }

  const distribution: Record<string, number> = {};
  for (const row of data) {
    const type = row.file_type || "unknown";
    distribution[type] = (distribution[type] || 0) + 1;
  }

  return distribution;
}

// ============================================================================
// Bulk Operations
// ============================================================================

/**
 * Create pending log entries for all items in a job.
 * Called at the start of processing to pre-populate the log.
 *
 * @param jobId - Import job ID
 * @returns Number of logs created
 */
export async function createPendingLogsForJob(jobId: string): Promise<number> {
  const supabase = createServiceClient();

  // First check if import_logs table exists
  const { error: tableCheckError } = await supabase
    .from("import_logs")
    .select("id")
    .limit(0);

  if (tableCheckError) {
    if (tableCheckError.message.includes("does not exist") || tableCheckError.code === "42P01") {
      console.warn(
        "[IMPORT LOGS] The import_logs table does not exist. " +
        "Please run the 0011_import_logs.sql migration to enable file-level logging."
      );
      return 0;
    }
    console.error("[IMPORT LOGS] Error checking import_logs table:", tableCheckError);
    return 0;
  }

  // Get all items for the job
  const { data: items, error: fetchError } = await supabase
    .from("import_items")
    .select("id, source_path, filename, file_type, file_size")
    .eq("job_id", jobId);

  if (fetchError || !items) {
    console.error("[IMPORT LOGS] Error fetching items for pending logs:", fetchError);
    return 0;
  }

  if (items.length === 0) {
    console.warn(`[IMPORT LOGS] No import_items found for job ${jobId}`);
    return 0;
  }

  // Create pending log for each item
  const logs: CreateImportLogRequest[] = items.map((item) => ({
    job_id: jobId,
    item_id: item.id,
    file_path: item.source_path,
    filename: item.filename,
    file_type: item.file_type,
    file_size: item.file_size,
    status: "pending" as ImportLogStatus,
  }));

  return createImportLogsBatch(logs);
}

/**
 * Delete all logs for a job.
 *
 * @param jobId - Import job ID
 * @returns True if successful
 */
export async function deleteLogsForJob(jobId: string): Promise<boolean> {
  const supabase = createServiceClient();

  const { error } = await supabase
    .from("import_logs")
    .delete()
    .eq("job_id", jobId);

  if (error) {
    console.error("Error deleting logs for job:", error);
    return false;
  }

  return true;
}

/**
 * Get log by item ID.
 *
 * @param itemId - Import item ID
 * @returns Log entry or null
 */
export async function getLogByItemId(itemId: string): Promise<ImportLog | null> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("import_logs")
    .select("*")
    .eq("item_id", itemId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // Not found
    console.error("Error fetching log by item ID:", error);
    return null;
  }

  return data as ImportLog;
}
