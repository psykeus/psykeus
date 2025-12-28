-- Migration: 0028_fix_performance_advisor_warnings.sql
-- Purpose: Fix Supabase Performance Advisor warnings
-- Created: 2025-12-27
-- AI Model: Claude Opus 4.5 (claude-opus-4-5-20251101)
--
-- Issues addressed:
-- 1. Multiple Permissive Policies on notifications table
-- 2. Multiple Permissive Policies on user_email_preferences table
-- 3. Multiple Permissive Policies on users table
-- 4. Function search_path mutable on increment_import_job_counter

-- ============================================================================
-- 1. FIX notifications TABLE - Consolidate SELECT policies
-- Problem: notifications_admin_select and notifications_select_own overlap
-- Solution: Single policy that allows SELECT when user owns OR is admin
-- ============================================================================

-- Drop the overlapping SELECT policies
DROP POLICY IF EXISTS "notifications_admin_select" ON notifications;
DROP POLICY IF EXISTS "notifications_select_own" ON notifications;

-- Create single consolidated SELECT policy
-- Uses (SELECT auth.uid()) for performance optimization
CREATE POLICY "notifications_select"
  ON notifications FOR SELECT
  USING (
    user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (SELECT auth.uid())
      AND users.role IN ('admin', 'super_admin')
    )
  );

-- ============================================================================
-- 2. FIX user_email_preferences TABLE - Consolidate SELECT policies
-- Problem: user_email_preferences_admin_select and user_email_preferences_select_own overlap
-- Solution: Single policy that allows SELECT when user owns OR is admin
-- ============================================================================

-- Drop the overlapping SELECT policies
DROP POLICY IF EXISTS "user_email_preferences_admin_select" ON user_email_preferences;
DROP POLICY IF EXISTS "user_email_preferences_select_own" ON user_email_preferences;

-- Create single consolidated SELECT policy
CREATE POLICY "user_email_preferences_select"
  ON user_email_preferences FOR SELECT
  USING (
    user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (SELECT auth.uid())
      AND users.role IN ('admin', 'super_admin')
    )
  );

-- ============================================================================
-- 3. FIX users TABLE - Consolidate SELECT policies
-- Problem: users_select and users_select_own overlap
-- Solution: Single policy that allows SELECT when viewing self OR is admin
-- ============================================================================

-- Drop the overlapping SELECT policies
DROP POLICY IF EXISTS "users_select" ON public.users;
DROP POLICY IF EXISTS "users_select_own" ON public.users;
DROP POLICY IF EXISTS "users_select_admin" ON public.users;

-- Create single consolidated SELECT policy
-- Users can view their own record OR admins can view all
CREATE POLICY "users_select"
  ON public.users FOR SELECT
  USING (
    id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
      AND u.role IN ('admin', 'super_admin')
    )
  );

-- ============================================================================
-- 4. FIX increment_import_job_counter FUNCTION - Add search_path
-- Problem: Function has mutable search_path (security concern)
-- Solution: Add SET search_path = ''
-- ============================================================================

CREATE OR REPLACE FUNCTION increment_import_job_counter(
  p_job_id UUID,
  p_counter TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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
    'UPDATE public.import_jobs SET %I = COALESCE(%I, 0) + 1 WHERE id = $1 RETURNING %I',
    p_counter, p_counter, p_counter
  ) INTO v_new_value USING p_job_id;

  RETURN v_new_value;
END;
$$;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON POLICY "notifications_select" ON notifications IS
'Consolidated SELECT policy: users can view own notifications, admins can view all';

COMMENT ON POLICY "user_email_preferences_select" ON user_email_preferences IS
'Consolidated SELECT policy: users can view own preferences, admins can view all';

COMMENT ON POLICY "users_select" ON public.users IS
'Consolidated SELECT policy: users can view own record, admins can view all';

COMMENT ON FUNCTION increment_import_job_counter(UUID, TEXT) IS
'Atomically increment import job counter with secured search_path';
