/**
 * Bulk Import System Types
 * Types for processing 10,000+ files with job tracking
 */

// ============================================================================
// Job Status Types
// ============================================================================

export type ImportJobStatus =
  | "pending"
  | "scanning"
  | "processing"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled";

export type ImportItemStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "skipped"
  | "duplicate";

export type ImportSourceType = "folder" | "zip" | "upload";

export type ProjectRole = "primary" | "variant" | "component";

export type DetectionReason = "folder" | "prefix" | "variant" | "manifest" | "layer" | "cross-folder";

export type ScheduleType = "datetime" | "delay";

// ============================================================================
// Database Row Types (matching Supabase schema)
// ============================================================================

export interface ImportJob {
  id: string;
  created_by: string | null;
  source_type: ImportSourceType;
  source_path: string | null;
  total_files: number;

  // Options
  generate_previews: boolean;
  generate_ai_metadata: boolean;
  detect_duplicates: boolean;
  auto_publish: boolean;

  // Status
  status: ImportJobStatus;

  // Progress
  files_scanned: number;
  files_processed: number;
  files_succeeded: number;
  files_failed: number;
  files_skipped: number;

  // Timing
  started_at: string | null;
  completed_at: string | null;
  estimated_completion: string | null;

  // Scheduling
  scheduled_start_at: string | null;
  schedule_type: ScheduleType | null;

  // Errors
  error_message: string | null;
  error_details: Record<string, unknown> | null;

  created_at: string;
  updated_at: string;
}

export interface ImportItem {
  id: string;
  job_id: string;

  // File info
  source_path: string;
  filename: string;
  file_type: string;
  file_size: number | null;
  content_hash: string | null;

  // Project grouping
  detected_project_id: string | null;
  project_role: ProjectRole | null;

  // Status
  status: ImportItemStatus;

  // Processing flags
  preview_generated: boolean;
  ai_metadata_generated: boolean;
  ai_metadata_requested: boolean;

  // Results
  design_id: string | null;
  design_file_id: string | null;
  duplicate_of_design_id: string | null;
  near_duplicate_similarity: number | null;

  // Errors
  error_message: string | null;
  retry_count: number;
  last_retry_at: string | null;

  // Timing
  processing_started_at: string | null;
  processing_completed_at: string | null;

  created_at: string;
}

export interface ImportDetectedProject {
  id: string;
  job_id: string;
  inferred_name: string;
  file_count: number;
  detection_reason: DetectionReason | null;
  confidence: number;
  user_confirmed: boolean;
  user_name_override: string | null;
  should_merge: boolean;
  created_at: string;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface CreateImportJobRequest {
  source_type: ImportSourceType;
  source_path?: string;
  generate_previews?: boolean;
  generate_ai_metadata?: boolean;
  detect_duplicates?: boolean;
  auto_publish?: boolean;
}

export interface ImportJobWithProgress extends ImportJob {
  progress_percentage: number;
  eta_seconds: number | null;
  items_per_minute: number | null;
}

export interface ImportItemWithProject extends ImportItem {
  detected_project?: ImportDetectedProject | null;
}

export interface ScanResult {
  total_files: number;
  file_types: Record<string, number>;
  total_size_bytes: number;
  detected_projects: DetectedProjectPreview[];
  duplicate_count: number;
  errors: ScanError[];
}

export interface DetectedProjectPreview {
  inferred_name: string;
  files: ScannedFile[];
  detection_reason: DetectionReason;
  confidence: number;
  primary_file: ScannedFile | null;
}

export interface ScannedFile {
  path: string;
  filename: string;
  file_type: string;
  size_bytes: number;
  content_hash?: string;
  is_duplicate?: boolean;
  duplicate_of?: string;
}

export interface ScanError {
  path: string;
  error: string;
}

// ============================================================================
// Scheduling Types
// ============================================================================

/**
 * Options for scheduling an import job to start later
 */
export interface ScheduleImportOptions {
  /** Schedule type */
  type: ScheduleType;
  /** For 'datetime' type: specific date/time to start */
  datetime?: string;
  /** For 'delay' type: number of minutes to delay start */
  delayMinutes?: number;
}

// ============================================================================
// Processing Types
// ============================================================================

/**
 * Processing Options for Import Jobs
 *
 * All configurable settings for the import process.
 * These settings affect how files are processed, deduplicated, and organized.
 */
export interface ProcessingOptions {
  // ========== Core Features ==========

  /**
   * Generate preview images for design files.
   * Creates thumbnail images for SVG, DXF, STL, OBJ, and other supported formats.
   * Required for visual browsing and near-duplicate detection.
   * @default true
   */
  generate_previews: boolean;

  /**
   * Use AI (OpenAI Vision) to generate metadata.
   * Generates titles, descriptions, tags, and categorization based on the design content.
   * Slower and uses API credits, but provides better searchability.
   * @default false
   */
  generate_ai_metadata: boolean;

  /**
   * Automatically make imported designs public.
   * If false, designs are imported as drafts requiring manual publishing.
   * @default false
   */
  auto_publish: boolean;

  // ========== Duplicate Detection ==========

  /**
   * Enable duplicate detection during import.
   * Skips files that already exist in the library.
   * Uses both exact hash matching and perceptual hash (phash) for near-duplicates.
   * @default true
   */
  detect_duplicates: boolean;

  /**
   * Near-duplicate similarity threshold (percentage).
   * Files with visual similarity above this threshold are considered duplicates.
   * Range: 0-100 where 100 means exact match only.
   *
   * Recommended values:
   * - 95+: Very strict, only catches nearly identical files
   * - 90: Moderate, catches obvious duplicates
   * - 85: Default, good balance for most imports
   * - 80: Aggressive, may flag similar but distinct designs
   *
   * @default 85
   */
  near_duplicate_threshold: number;

  /**
   * Only detect exact duplicates (identical file content).
   * Disables perceptual hash comparison for near-duplicates.
   * Faster processing, but may import visually identical files with minor differences.
   * @default false
   */
  exact_duplicates_only: boolean;

  // ========== Project Detection ==========

  /**
   * Enable automatic project detection and file grouping.
   * Groups related files (variants, components) into single designs.
   * @default true
   */
  enable_project_detection: boolean;

  /**
   * Enable cross-folder project detection.
   * Detects when files are organized by type in separate folders
   * (e.g., SVG/Design.svg, DXF/Design.dxf become one project).
   * @default true
   */
  cross_folder_detection: boolean;

  /**
   * Minimum confidence threshold for project grouping (0.0-1.0).
   * Projects detected with lower confidence are treated as individual files.
   * Higher values = stricter grouping, fewer false positives.
   * @default 0.7
   */
  project_confidence_threshold: number;

  // ========== Performance ==========

  /**
   * Number of files to process concurrently.
   * Higher values = faster processing but more memory/CPU usage.
   * Recommended: 3-10 depending on system resources.
   * @default 5
   */
  concurrency: number;

  /**
   * Save progress checkpoint every N files.
   * Allows resuming interrupted imports from the last checkpoint.
   * Lower values = more frequent saves, slower processing.
   * @default 10
   */
  checkpoint_interval: number;

  // ========== Error Handling ==========

  /**
   * Maximum retry attempts for failed files.
   * Files that fail are retried up to this many times before being marked as failed.
   * Set to 0 to disable retries.
   * @default 3
   */
  max_retries: number;

  /**
   * Skip files that fail after max retries instead of stopping the job.
   * When true, failed files are logged but import continues.
   * When false, the job fails entirely when a file fails.
   * @default true
   */
  skip_failed_files: boolean;

  // ========== Preview Settings ==========

  /**
   * Priority order of file types for preview generation in projects.
   * The first matching type will be used as the primary preview source.
   * @default ["svg", "png", "jpg", "dxf", "stl"]
   */
  preview_type_priority: string[];
}

/**
 * Default processing options
 * Used when creating new import jobs
 */
export const DEFAULT_PROCESSING_OPTIONS: ProcessingOptions = {
  // Core features
  generate_previews: true,
  generate_ai_metadata: false,
  auto_publish: false,

  // Duplicate detection
  detect_duplicates: true,
  near_duplicate_threshold: 85,
  exact_duplicates_only: false,

  // Project detection
  enable_project_detection: true,
  cross_folder_detection: true,
  project_confidence_threshold: 0.7,

  // Performance
  concurrency: 5,
  checkpoint_interval: 10,

  // Error handling
  max_retries: 3,
  skip_failed_files: true,

  // Preview settings - controls which file type is used for the preview/thumbnail image
  // Images first (better quality), then vector formats, then 3D (auto-generated renders)
  preview_type_priority: ["png", "jpg", "jpeg", "webp", "svg", "dxf", "ai", "eps", "stl", "obj", "gltf", "glb", "3mf"],
};

export interface ProcessingProgress {
  job_id: string;
  status: ImportJobStatus;
  files_processed: number;
  files_succeeded: number;
  files_failed: number;
  files_skipped: number;
  total_files: number;
  progress_percentage: number;
  current_file?: string;
  eta_seconds?: number;
  items_per_minute?: number;
}

export interface ProcessingResult {
  item_id: string;
  success: boolean;
  design_id?: string;
  design_file_id?: string;
  error?: string;
  is_duplicate?: boolean;
  duplicate_of?: string;
  near_duplicate_similarity?: number;
  processing_time_ms: number;
}

export interface FileProcessingContext {
  item: ImportItem;
  buffer: Buffer;
  options: ProcessingOptions;
  existingHashes: Set<string>;
  existingPhashes: Map<string, { design_id: string; title: string }>;
}

// ============================================================================
// Event Types (for SSE streaming)
// ============================================================================

export type ImportEventType =
  | "job:started"
  | "job:paused"
  | "job:resumed"
  | "job:completed"
  | "job:failed"
  | "job:cancelled"
  | "scan:started"
  | "scan:progress"
  | "scan:completed"
  | "item:started"
  | "item:completed"
  | "item:failed"
  | "item:skipped"
  | "progress:update"
  | "checkpoint:saved";

export interface ImportEvent {
  type: ImportEventType;
  job_id: string;
  timestamp: string;
  // Using unknown allows any data structure - specific event types can be discriminated by 'type'
  data: Record<string, unknown>;
}

// ============================================================================
// UI State Types
// ============================================================================

export interface ImportWizardState {
  step: "source" | "scan" | "review" | "options" | "processing" | "complete";
  source_type: ImportSourceType | null;
  source_path: string | null;
  uploaded_files: File[];
  scan_result: ScanResult | null;
  confirmed_projects: DetectedProjectPreview[];
  options: ProcessingOptions;
  job_id: string | null;
}

export interface ImportJobSummary {
  id: string;
  status: ImportJobStatus;
  source_type: ImportSourceType;
  total_files: number;
  files_succeeded: number;
  files_failed: number;
  files_skipped: number;
  progress_percentage: number;
  created_at: string;
  completed_at: string | null;
}

// ============================================================================
// Utility Types
// ============================================================================

export interface ImportPaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface ImportItemFilters {
  status?: ImportItemStatus[];
  project_id?: string;
  has_error?: boolean;
  search?: string;
}

export interface ImportJobFilters {
  status?: ImportJobStatus[];
  created_after?: string;
  created_before?: string;
}

// ============================================================================
// Import Log Types
// ============================================================================

/**
 * Status values for import log entries
 */
export type ImportLogStatus =
  | "pending"
  | "processing"
  | "succeeded"
  | "failed"
  | "skipped"
  | "duplicate";

/**
 * Type of duplicate detection
 */
export type DuplicateType = "exact" | "near";

/**
 * Processing steps that can be completed during import
 */
export type ImportProcessingStep =
  | "file_read"
  | "hash_computed"
  | "duplicate_check"
  | "preview_generated"
  | "ai_metadata_generated"
  | "design_created"
  | "design_file_created"
  | "storage_uploaded";

/**
 * Skip reasons for import logs
 */
export type ImportSkipReason =
  | "exact_duplicate"
  | "near_duplicate"
  | "unsupported_file_type"
  | "file_too_large"
  | "file_empty"
  | "file_corrupted"
  | "user_excluded"
  | "project_excluded";

/**
 * Fail reasons for import logs
 */
export type ImportFailReason =
  | "file_read_error"
  | "hash_error"
  | "preview_generation_error"
  | "ai_metadata_error"
  | "storage_upload_error"
  | "database_error"
  | "timeout"
  | "unknown_error";

/**
 * Database row type for import_logs table
 */
export interface ImportLog {
  id: string;
  job_id: string;
  item_id: string | null;

  // File identification
  file_path: string;
  filename: string;
  file_type: string | null;
  file_size: number | null;

  // Processing result
  status: ImportLogStatus;
  reason: string | null;
  details: ImportLogDetails;
  steps_completed: ImportProcessingStep[];

  // Links to created resources
  design_id: string | null;
  design_file_id: string | null;

  // Duplicate information
  duplicate_of_design_id: string | null;
  duplicate_type: DuplicateType | null;
  duplicate_similarity: number | null;

  // Timing
  processing_started_at: string | null;
  processing_completed_at: string | null;
  processing_duration_ms: number | null;

  created_at: string;
}

/**
 * Structured details stored in the JSONB column
 */
export interface ImportLogDetails {
  // Error details
  error_code?: string;
  error_stack?: string;

  // Skip details
  skip_reason?: ImportSkipReason;
  skip_criteria?: string;

  // Fail details
  fail_reason?: ImportFailReason;
  fail_step?: ImportProcessingStep;

  // Duplicate details
  duplicate_hash?: string;
  duplicate_phash?: string;
  duplicate_title?: string;

  // AI metadata details
  ai_tokens_used?: number;
  ai_response_time_ms?: number;

  // Preview details
  preview_format?: string;
  preview_size_bytes?: number;

  // Geometry analysis (for 3D files)
  geometry_dimensions?: {
    width: number;
    height: number;
    depth: number;
  };
  geometry_triangle_count?: number;

  // Any additional context
  [key: string]: unknown;
}

/**
 * Summary of log entries for a job
 */
export interface ImportLogSummary {
  job_id: string;
  total_files: number;
  succeeded_count: number;
  failed_count: number;
  skipped_count: number;
  duplicate_count: number;
  pending_count: number;
  processing_count: number;
  total_size_bytes: number;
  first_started: string | null;
  last_completed: string | null;
  avg_duration_ms: number | null;
}

/**
 * Grouped reasons for logs (from get_import_log_reasons function)
 */
export interface ImportLogReasonGroup {
  status: ImportLogStatus;
  reason: string;
  count: number;
}

/**
 * Request to create a log entry
 */
export interface CreateImportLogRequest {
  job_id: string;
  item_id?: string;
  file_path: string;
  filename: string;
  file_type?: string;
  file_size?: number;
  status: ImportLogStatus;
  reason?: string;
  details?: Partial<ImportLogDetails>;
  steps_completed?: ImportProcessingStep[];
  design_id?: string;
  design_file_id?: string;
  duplicate_of_design_id?: string;
  duplicate_type?: DuplicateType;
  duplicate_similarity?: number;
  processing_started_at?: string;
  processing_completed_at?: string;
  processing_duration_ms?: number;
}

/**
 * Filters for querying logs
 */
export interface ImportLogFilters {
  status?: ImportLogStatus[];
  file_type?: string[];
  has_reason?: boolean;
  search?: string;
}

/**
 * Import log with related item data
 */
export interface ImportLogWithItem extends ImportLog {
  item?: ImportItem | null;
}
