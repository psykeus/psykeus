/**
 * Import Item Service
 * CRUD operations for individual files within an import job
 */

import { createServiceClient, createClient } from "@/lib/supabase/server";
import type {
  ImportItem,
  ImportItemStatus,
  ImportItemWithProject,
  ImportItemFilters,
  ScannedFile,
  ProjectRole,
} from "@/lib/types/import";

/**
 * Create import items from scanned files
 */
export async function createImportItems(
  jobId: string,
  files: ScannedFile[],
  projectAssignments?: Map<string, { projectId: string; role: ProjectRole }>
): Promise<ImportItem[]> {
  const supabase = createServiceClient();

  const items = files.map((file) => {
    const assignment = projectAssignments?.get(file.path);

    return {
      job_id: jobId,
      source_path: file.path,
      filename: file.filename,
      file_type: file.file_type,
      file_size: file.size_bytes,
      content_hash: file.content_hash || null,
      detected_project_id: assignment?.projectId || null,
      project_role: assignment?.role || null,
      status: file.is_duplicate ? ("duplicate" as const) : ("pending" as const),
      duplicate_of_design_id: file.duplicate_of || null,
    };
  });

  // Insert in batches to avoid hitting limits
  const batchSize = 500;
  const results: ImportItem[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);

    const { data, error } = await supabase
      .from("import_items")
      .insert(batch)
      .select();

    if (error) {
      throw new Error(`Failed to create import items: ${error.message}`);
    }

    results.push(...(data || []));
  }

  return results;
}

/**
 * Get an import item by ID
 */
export async function getImportItem(itemId: string): Promise<ImportItem | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("import_items")
    .select("*")
    .eq("id", itemId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`Failed to get import item: ${error.message}`);
  }

  return data;
}

/**
 * Get an import item with its detected project
 */
export async function getImportItemWithProject(
  itemId: string
): Promise<ImportItemWithProject | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("import_items")
    .select(
      `
      *,
      detected_project:import_detected_projects(*)
    `
    )
    .eq("id", itemId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`Failed to get import item: ${error.message}`);
  }

  return data;
}

/**
 * List import items for a job
 */
export async function listImportItems(
  jobId: string,
  filters?: ImportItemFilters,
  options?: { limit?: number; offset?: number }
): Promise<{ items: ImportItem[]; total: number }> {
  const supabase = await createClient();

  let query = supabase
    .from("import_items")
    .select("*", { count: "exact" })
    .eq("job_id", jobId)
    .order("created_at", { ascending: true });

  if (filters?.status && filters.status.length > 0) {
    query = query.in("status", filters.status);
  }

  if (filters?.project_id) {
    query = query.eq("detected_project_id", filters.project_id);
  }

  if (filters?.has_error === true) {
    query = query.not("error_message", "is", null);
  }

  if (filters?.search) {
    query = query.ilike("filename", `%${filters.search}%`);
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
  }

  const { data, error, count } = await query;

  if (error) {
    throw new Error(`Failed to list import items: ${error.message}`);
  }

  return { items: data || [], total: count || 0 };
}

/**
 * Get pending items for processing
 * Uses service client since this is called from background job processor
 */
export async function getPendingItems(
  jobId: string,
  limit: number = 100
): Promise<ImportItem[]> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("import_items")
    .select("*")
    .eq("job_id", jobId)
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to get pending items: ${error.message}`);
  }

  return data || [];
}

/**
 * Get failed items for retry
 * Uses service client since this is called from background job processor
 */
export async function getFailedItems(
  jobId: string,
  maxRetries: number = 3
): Promise<ImportItem[]> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("import_items")
    .select("*")
    .eq("job_id", jobId)
    .eq("status", "failed")
    .lt("retry_count", maxRetries)
    .order("last_retry_at", { ascending: true, nullsFirst: true });

  if (error) {
    throw new Error(`Failed to get failed items: ${error.message}`);
  }

  return data || [];
}

/**
 * Update item status
 */
export async function updateItemStatus(
  itemId: string,
  status: ImportItemStatus,
  additionalData?: Partial<ImportItem>
): Promise<ImportItem> {
  const supabase = createServiceClient();

  const updateData: Partial<ImportItem> & { status: ImportItemStatus } = {
    status,
    ...additionalData,
  };

  // Set timing fields based on status
  if (status === "processing" && !additionalData?.processing_started_at) {
    updateData.processing_started_at = new Date().toISOString();
  }

  if (["completed", "failed", "skipped", "duplicate"].includes(status)) {
    updateData.processing_completed_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from("import_items")
    .update(updateData)
    .eq("id", itemId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update item status: ${error.message}`);
  }

  return data;
}

/**
 * Mark item as processing
 */
export async function markItemProcessing(itemId: string): Promise<ImportItem> {
  return updateItemStatus(itemId, "processing");
}

/**
 * Mark item as completed
 * @param itemId - The item ID
 * @param result - Processing results including:
 *   - design_id: The created design ID
 *   - design_file_id: The created file ID (optional)
 *   - preview_generated: Whether a preview was generated
 *   - ai_metadata_generated: Whether AI actually generated metadata (not just fallback)
 *   - ai_metadata_requested: Whether AI generation was requested (optional, defaults to value of ai_metadata_generated)
 */
export async function markItemCompleted(
  itemId: string,
  result: {
    design_id: string;
    design_file_id?: string;
    preview_generated: boolean;
    ai_metadata_generated: boolean;
    ai_metadata_requested?: boolean;
  }
): Promise<ImportItem> {
  return updateItemStatus(itemId, "completed", {
    design_id: result.design_id,
    design_file_id: result.design_file_id || null,
    preview_generated: result.preview_generated,
    ai_metadata_generated: result.ai_metadata_generated,
    ai_metadata_requested: result.ai_metadata_requested ?? result.ai_metadata_generated,
  });
}

/**
 * Mark item as failed
 */
export async function markItemFailed(
  itemId: string,
  error: string,
  incrementRetry: boolean = true
): Promise<ImportItem> {
  const supabase = createServiceClient();

  // Get current retry count
  const { data: item } = await supabase
    .from("import_items")
    .select("retry_count")
    .eq("id", itemId)
    .single();

  const retryCount = incrementRetry ? (item?.retry_count || 0) + 1 : item?.retry_count || 0;

  return updateItemStatus(itemId, "failed", {
    error_message: error,
    retry_count: retryCount,
    last_retry_at: new Date().toISOString(),
  });
}

/**
 * Mark item as skipped
 */
export async function markItemSkipped(itemId: string, reason: string): Promise<ImportItem> {
  return updateItemStatus(itemId, "skipped", {
    error_message: reason,
  });
}

/**
 * Mark item as duplicate
 */
export async function markItemDuplicate(
  itemId: string,
  duplicateOfDesignId: string,
  similarity?: number
): Promise<ImportItem> {
  return updateItemStatus(itemId, "duplicate", {
    duplicate_of_design_id: duplicateOfDesignId,
    near_duplicate_similarity: similarity || 100,
  });
}

/**
 * Reset item for retry
 */
export async function resetItemForRetry(itemId: string): Promise<ImportItem> {
  return updateItemStatus(itemId, "pending", {
    error_message: null,
    processing_started_at: null,
    processing_completed_at: null,
  });
}

/**
 * Bulk reset failed items
 */
export async function resetFailedItems(jobId: string): Promise<number> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("import_items")
    .update({
      status: "pending",
      error_message: null,
      processing_started_at: null,
      processing_completed_at: null,
    })
    .eq("job_id", jobId)
    .eq("status", "failed")
    .select("id");

  if (error) {
    throw new Error(`Failed to reset failed items: ${error.message}`);
  }

  return data?.length || 0;
}

/**
 * Get item counts by status
 * Uses service client since this is called from background job processor
 */
export async function getItemStatusCounts(
  jobId: string
): Promise<Record<ImportItemStatus, number>> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("import_items")
    .select("status")
    .eq("job_id", jobId);

  if (error) {
    throw new Error(`Failed to get item counts: ${error.message}`);
  }

  const counts: Record<ImportItemStatus, number> = {
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    skipped: 0,
    duplicate: 0,
  };

  for (const item of data || []) {
    counts[item.status as ImportItemStatus]++;
  }

  return counts;
}

/**
 * Get AI metadata statistics for a job
 * Returns counts of items where AI was requested vs actually generated
 * Uses service client since this is called from background job processor
 */
export async function getAIMetadataStats(
  jobId: string
): Promise<{ requested: number; generated: number; failed: number }> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("import_items")
    .select("ai_metadata_requested, ai_metadata_generated, status")
    .eq("job_id", jobId);

  if (error) {
    throw new Error(`Failed to get AI metadata stats: ${error.message}`);
  }

  let requested = 0;
  let generated = 0;
  let failed = 0;

  for (const item of data || []) {
    if (item.ai_metadata_requested) {
      requested++;
      if (item.ai_metadata_generated) {
        generated++;
      } else if (item.status === "completed") {
        // AI was requested but didn't generate for a completed item
        failed++;
      }
    }
  }

  return { requested, generated, failed };
}

/**
 * Update content hash after scanning
 */
export async function updateItemHash(itemId: string, contentHash: string): Promise<void> {
  const supabase = createServiceClient();

  const { error } = await supabase
    .from("import_items")
    .update({ content_hash: contentHash })
    .eq("id", itemId);

  if (error) {
    throw new Error(`Failed to update item hash: ${error.message}`);
  }
}

/**
 * Get items by content hash (for duplicate checking)
 * Uses service client since this may be called from background job processor
 */
export async function getItemsByHash(
  jobId: string,
  hashes: string[]
): Promise<Map<string, ImportItem>> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("import_items")
    .select("*")
    .eq("job_id", jobId)
    .in("content_hash", hashes);

  if (error) {
    throw new Error(`Failed to get items by hash: ${error.message}`);
  }

  const map = new Map<string, ImportItem>();
  for (const item of data || []) {
    if (item.content_hash) {
      map.set(item.content_hash, item);
    }
  }

  return map;
}

/**
 * Get pending items grouped by detected project
 * Returns items organized by project, with ungrouped items under null key
 * Uses service client since this is called from background job processor
 */
export async function getPendingItemsByProject(
  jobId: string,
  limit: number = 100
): Promise<Map<string | null, ImportItem[]>> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("import_items")
    .select("*")
    .eq("job_id", jobId)
    .eq("status", "pending")
    .order("project_role", { ascending: true }) // primary first
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to get pending items by project: ${error.message}`);
  }

  const grouped = new Map<string | null, ImportItem[]>();

  for (const item of data || []) {
    const projectId = item.detected_project_id;
    if (!grouped.has(projectId)) {
      grouped.set(projectId, []);
    }
    grouped.get(projectId)!.push(item);
  }

  return grouped;
}

/**
 * Get all pending items for a specific project
 * Uses service client since this is called from background job processor
 */
export async function getPendingItemsForProject(
  jobId: string,
  projectId: string
): Promise<ImportItem[]> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("import_items")
    .select("*")
    .eq("job_id", jobId)
    .eq("detected_project_id", projectId)
    .eq("status", "pending")
    .order("project_role", { ascending: true }) // primary first
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to get pending items for project: ${error.message}`);
  }

  return data || [];
}

/**
 * Get detected project info
 * Uses service client since this is called from background job processor
 */
export async function getDetectedProject(
  projectId: string
): Promise<{ id: string; inferred_name: string; should_merge: boolean } | null> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("import_detected_projects")
    .select("id, inferred_name, should_merge")
    .eq("id", projectId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`Failed to get detected project: ${error.message}`);
  }

  return data;
}
