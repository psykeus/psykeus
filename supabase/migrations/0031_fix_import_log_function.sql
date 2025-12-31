-- Migration: 0031_fix_import_log_function.sql
-- Purpose: Fix get_import_log_reasons function to use correct column name
-- Created: 2025-12-29
-- AI Model: Claude Opus 4.5 (claude-opus-4-5-20251101)

-- ============================================================================
-- FIX: get_import_log_reasons function uses wrong column name
-- ============================================================================
-- Migration 0018 defined this function using 'skip_reason' column,
-- but the import_logs table (defined in 0011) uses 'reason' column.

DROP FUNCTION IF EXISTS public.get_import_log_reasons(uuid);

CREATE OR REPLACE FUNCTION public.get_import_log_reasons(p_job_id uuid)
RETURNS TABLE (
  reason TEXT,
  count BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT
    il.reason,
    COUNT(*)::BIGINT as count
  FROM public.import_logs il
  WHERE il.job_id = p_job_id
    AND il.reason IS NOT NULL
  GROUP BY il.reason
  ORDER BY count DESC;
END;
$$;

COMMENT ON FUNCTION public.get_import_log_reasons(uuid) IS
'Get summary of skip/fail reasons for an import job. Returns reason text and count.';
