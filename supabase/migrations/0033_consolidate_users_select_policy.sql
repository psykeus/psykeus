-- Migration: 0033_consolidate_users_select_policy.sql
-- Purpose: Fix Performance Advisor warning about multiple permissive policies
-- Created: 2025-01-01
-- AI Model: Claude Opus 4.5 (claude-opus-4-5-20251101)
--
-- Problem: users_select_own and users_select_admin are two permissive policies
-- that must both be evaluated for every SELECT query.
--
-- Solution: Consolidate into single policy using is_admin() SECURITY DEFINER
-- function which bypasses RLS internally, avoiding circular dependency.
--
-- Note: Migration 0028 attempted this with an inline EXISTS clause but caused
-- circular RLS dependency. This approach uses the existing is_admin() function
-- which is SECURITY DEFINER and bypasses RLS.

-- ============================================================================
-- CONSOLIDATE users TABLE SELECT POLICIES
-- ============================================================================

-- Drop the two separate policies
DROP POLICY IF EXISTS "users_select_own" ON public.users;
DROP POLICY IF EXISTS "users_select_admin" ON public.users;

-- Create single consolidated policy
-- - Users can view their own record (simple equality check)
-- - Admins can view all (is_admin() is SECURITY DEFINER, bypasses RLS)
CREATE POLICY "users_select" ON public.users
FOR SELECT USING (
  id = (SELECT auth.uid()) OR public.is_admin()
);

COMMENT ON POLICY "users_select" ON public.users IS
'Consolidated SELECT policy: users view own record, admins view all. Uses is_admin() SECURITY DEFINER to avoid RLS circular dependency.';
