-- Migration: 0029_revert_users_rls_policy.sql
-- Purpose: Revert users table RLS policy to original working state
-- Created: 2025-12-27
-- AI Model: Claude Opus 4.5 (claude-opus-4-5-20251101)
--
-- Issue: Migration 0028 consolidated users SELECT policies into one policy
-- with a self-referential EXISTS clause that caused circular RLS dependency.
-- The original policies used public.is_admin() which is SECURITY DEFINER
-- and bypasses RLS, avoiding the circular issue.

-- ============================================================================
-- REVERT users TABLE RLS - Restore original separate policies
-- ============================================================================

-- Drop the broken consolidated policy
DROP POLICY IF EXISTS "users_select" ON public.users;

-- Restore original policies that use is_admin() function (SECURITY DEFINER)
-- Users can read their own record
CREATE POLICY "users_select_own" ON public.users
FOR SELECT USING (id = (SELECT auth.uid()));

-- Admins can read all users (uses SECURITY DEFINER function to bypass RLS)
CREATE POLICY "users_select_admin" ON public.users
FOR SELECT USING (public.is_admin());

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON POLICY "users_select_own" ON public.users IS
'Users can view their own record. Uses (SELECT auth.uid()) for performance.';

COMMENT ON POLICY "users_select_admin" ON public.users IS
'Admins can view all user records. Uses is_admin() SECURITY DEFINER function to bypass RLS.';
