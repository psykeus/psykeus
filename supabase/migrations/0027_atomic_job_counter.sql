-- Migration: 0027_atomic_job_counter.sql
-- Purpose: Add atomic increment function for import job counters to prevent race conditions
-- Created: 2025-12-26
-- AI Model: Claude Opus 4.5 (claude-opus-4-5-20251101)

-- Function to atomically increment a job counter
-- This prevents race conditions when multiple workers update the same counter
CREATE OR REPLACE FUNCTION increment_import_job_counter(
  p_job_id UUID,
  p_counter TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_value INTEGER;
BEGIN
  -- Validate counter name to prevent SQL injection
  IF p_counter NOT IN ('files_processed', 'files_succeeded', 'files_failed', 'files_skipped') THEN
    RAISE EXCEPTION 'Invalid counter name: %', p_counter;
  END IF;

  -- Use dynamic SQL with proper quoting for atomic update
  EXECUTE format(
    'UPDATE import_jobs SET %I = COALESCE(%I, 0) + 1 WHERE id = $1 RETURNING %I',
    p_counter, p_counter, p_counter
  ) INTO v_new_value USING p_job_id;

  RETURN v_new_value;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION increment_import_job_counter(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_import_job_counter(UUID, TEXT) TO service_role;
