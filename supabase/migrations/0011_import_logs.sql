-- Migration: Add import_logs table for detailed import processing logs
-- Created: 2025-12-07
-- Purpose: Track all files during import with detailed status, skip/fail reasons

-- =============================================================================
-- IMPORT LOGS TABLE
-- =============================================================================
-- Stores detailed processing logs for each file in an import job.
-- This provides a complete audit trail that persists after import completion.

CREATE TABLE IF NOT EXISTS import_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES import_jobs(id) ON DELETE CASCADE,
  item_id uuid REFERENCES import_items(id) ON DELETE SET NULL,

  -- File identification
  file_path text NOT NULL,
  filename text NOT NULL,
  file_type text,
  file_size bigint,

  -- Processing result
  status text NOT NULL CHECK (status IN (
    'pending',      -- Queued for processing
    'processing',   -- Currently being processed
    'succeeded',    -- Successfully imported
    'failed',       -- Failed with error
    'skipped',      -- Skipped (not an error, intentional)
    'duplicate'     -- Detected as duplicate
  )),

  -- Detailed reason for skip/fail (human-readable)
  reason text,

  -- Structured details for programmatic access
  details jsonb DEFAULT '{}',

  -- Processing steps completed (for debugging/transparency)
  steps_completed text[] DEFAULT '{}',

  -- Links to created resources (if successful)
  design_id uuid REFERENCES designs(id) ON DELETE SET NULL,
  design_file_id uuid REFERENCES design_files(id) ON DELETE SET NULL,

  -- Duplicate information
  duplicate_of_design_id uuid REFERENCES designs(id) ON DELETE SET NULL,
  duplicate_type text CHECK (duplicate_type IN ('exact', 'near')),
  duplicate_similarity float,

  -- Timing
  processing_started_at timestamptz,
  processing_completed_at timestamptz,
  processing_duration_ms int,

  -- Metadata
  created_at timestamptz DEFAULT now()
);

-- =============================================================================
-- INDEXES
-- =============================================================================

-- Fast lookup by job
CREATE INDEX idx_import_logs_job_id ON import_logs(job_id);

-- Filter by status within a job
CREATE INDEX idx_import_logs_job_status ON import_logs(job_id, status);

-- Search by filename
CREATE INDEX idx_import_logs_filename ON import_logs(job_id, filename);

-- Filter by file type
CREATE INDEX idx_import_logs_file_type ON import_logs(job_id, file_type);

-- =============================================================================
-- IMPORT LOG SUMMARY VIEW
-- =============================================================================
-- Provides quick summary stats for each job's logs

CREATE OR REPLACE VIEW import_log_summary AS
SELECT
  job_id,
  COUNT(*) as total_files,
  COUNT(*) FILTER (WHERE status = 'succeeded') as succeeded_count,
  COUNT(*) FILTER (WHERE status = 'failed') as failed_count,
  COUNT(*) FILTER (WHERE status = 'skipped') as skipped_count,
  COUNT(*) FILTER (WHERE status = 'duplicate') as duplicate_count,
  COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
  COUNT(*) FILTER (WHERE status = 'processing') as processing_count,
  SUM(file_size) as total_size_bytes,
  MIN(processing_started_at) as first_started,
  MAX(processing_completed_at) as last_completed,
  AVG(processing_duration_ms) as avg_duration_ms
FROM import_logs
GROUP BY job_id;

-- =============================================================================
-- HELPER FUNCTION: Get skip/fail reasons summary
-- =============================================================================

CREATE OR REPLACE FUNCTION get_import_log_reasons(p_job_id uuid)
RETURNS TABLE (
  status text,
  reason text,
  count bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    l.status,
    l.reason,
    COUNT(*)::bigint as count
  FROM import_logs l
  WHERE l.job_id = p_job_id
    AND l.reason IS NOT NULL
  GROUP BY l.status, l.reason
  ORDER BY count DESC;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE import_logs IS 'Detailed processing log for each file in a bulk import job';
COMMENT ON COLUMN import_logs.status IS 'Final processing status: succeeded, failed, skipped, or duplicate';
COMMENT ON COLUMN import_logs.reason IS 'Human-readable explanation for skip/fail status';
COMMENT ON COLUMN import_logs.details IS 'Structured data: error stack, skip criteria matched, etc.';
COMMENT ON COLUMN import_logs.steps_completed IS 'Array of processing steps completed before final status';
COMMENT ON COLUMN import_logs.duplicate_type IS 'Whether duplicate was exact (hash match) or near (perceptual similarity)';
