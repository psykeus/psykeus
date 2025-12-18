-- Migration: 0026_fix_rls_and_function_security
-- Description: Fix Supabase Performance and Security Lints
--
-- Issues addressed:
-- 1. Auth RLS Initialization Plan: Wrap auth.uid() in (SELECT ...) for email_settings/email_templates
-- 2. Multiple Permissive Policies: Consolidate overlapping policies for notifications, tier_features, user_email_preferences
-- 3. Function Search Path Mutable: Add SET search_path = '' to functions

-- ============================================================================
-- 1. FIX AUTH RLS INITIALIZATION PLAN - email_settings
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can view email settings" ON email_settings;
DROP POLICY IF EXISTS "Admins can insert email settings" ON email_settings;
DROP POLICY IF EXISTS "Admins can update email settings" ON email_settings;
DROP POLICY IF EXISTS "Admins can delete email settings" ON email_settings;

-- Recreate with (SELECT auth.uid()) instead of auth.uid()
CREATE POLICY "Admins can view email settings"
  ON email_settings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (SELECT auth.uid())
      AND users.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can insert email settings"
  ON email_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (SELECT auth.uid())
      AND users.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can update email settings"
  ON email_settings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (SELECT auth.uid())
      AND users.role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (SELECT auth.uid())
      AND users.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can delete email settings"
  ON email_settings FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (SELECT auth.uid())
      AND users.role IN ('admin', 'super_admin')
    )
  );

-- ============================================================================
-- 1b. FIX AUTH RLS INITIALIZATION PLAN - email_templates
-- ============================================================================

DROP POLICY IF EXISTS "Admins can view email templates" ON email_templates;
DROP POLICY IF EXISTS "Admins can insert email templates" ON email_templates;
DROP POLICY IF EXISTS "Admins can update email templates" ON email_templates;
DROP POLICY IF EXISTS "Admins can delete email templates" ON email_templates;

CREATE POLICY "Admins can view email templates"
  ON email_templates FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (SELECT auth.uid())
      AND users.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can insert email templates"
  ON email_templates FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (SELECT auth.uid())
      AND users.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can update email templates"
  ON email_templates FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (SELECT auth.uid())
      AND users.role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (SELECT auth.uid())
      AND users.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can delete email templates"
  ON email_templates FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (SELECT auth.uid())
      AND users.role IN ('admin', 'super_admin')
    )
  );

-- ============================================================================
-- 2. FIX MULTIPLE PERMISSIVE POLICIES - notifications
-- Remove redundant service_all and service_insert policies, use single service_role policy
-- ============================================================================

DROP POLICY IF EXISTS "notifications_service_all" ON notifications;
DROP POLICY IF EXISTS "notifications_service_insert" ON notifications;

-- Single policy for service_role that handles all operations
CREATE POLICY "notifications_service_role"
  ON notifications FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 2b. FIX MULTIPLE PERMISSIVE POLICIES - tier_features
-- Remove admin manage (which includes SELECT) and keep only view for public
-- ============================================================================

DROP POLICY IF EXISTS "Anyone can view active tier features" ON tier_features;
DROP POLICY IF EXISTS "Admins can manage tier features" ON tier_features;

-- Public can view active features
CREATE POLICY "Public can view active tier features"
  ON tier_features FOR SELECT
  USING (is_active = TRUE);

-- Admins can manage via service role (INSERT, UPDATE, DELETE)
CREATE POLICY "Admins can insert tier features"
  ON tier_features FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update tier features"
  ON tier_features FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete tier features"
  ON tier_features FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- 2c. FIX MULTIPLE PERMISSIVE POLICIES - user_email_preferences
-- Remove redundant service_all policy, use specific TO service_role
-- ============================================================================

DROP POLICY IF EXISTS "user_email_preferences_service_all" ON user_email_preferences;

-- Single policy for service_role
CREATE POLICY "user_email_preferences_service_role"
  ON user_email_preferences FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 3. FIX FUNCTION SEARCH PATH MUTABLE
-- Recreate functions with SET search_path = ''
-- ============================================================================

-- 3a. update_email_settings_updated_at
CREATE OR REPLACE FUNCTION update_email_settings_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 3b. update_email_templates_updated_at
CREATE OR REPLACE FUNCTION update_email_templates_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 3c. can_user_access_design - update existing function with search_path
-- Signature is (UUID, UUID) for user_uuid and design_uuid
CREATE OR REPLACE FUNCTION public.can_user_access_design(user_uuid UUID, design_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  design_access VARCHAR(20);
  user_tier RECORD;
BEGIN
  -- Get design access level
  SELECT access_level INTO design_access
  FROM public.designs WHERE id = design_uuid;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Free designs are accessible to everyone
  IF design_access = 'free' THEN
    RETURN TRUE;
  END IF;

  -- Get user's tier (only active users can access premium content)
  SELECT t.* INTO user_tier
  FROM public.users u
  JOIN public.access_tiers t ON u.tier_id = t.id
  WHERE u.id = user_uuid
    AND (u.tier_expires_at IS NULL OR u.tier_expires_at > NOW())
    AND u.status = 'active';

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Check access based on design level
  IF design_access = 'premium' THEN
    RETURN user_tier.can_access_premium;
  ELSIF design_access = 'exclusive' THEN
    RETURN user_tier.can_access_exclusive;
  END IF;

  RETURN FALSE;
END;
$$;

-- 3d. get_user_status_reason - must drop first due to return type change
DROP FUNCTION IF EXISTS public.get_user_status_reason(UUID);
CREATE OR REPLACE FUNCTION public.get_user_status_reason(user_uuid UUID)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_status TEXT;
  v_reason TEXT;
BEGIN
  SELECT
    status,
    CASE status
      WHEN 'suspended' THEN suspended_reason
      WHEN 'paused' THEN paused_reason
      WHEN 'disabled' THEN disabled_reason
      ELSE NULL
    END
  INTO v_status, v_reason
  FROM public.users
  WHERE id = user_uuid;

  RETURN v_reason;
END;
$$;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION update_email_settings_updated_at IS 'Trigger function for email_settings updated_at - secured with empty search_path';
COMMENT ON FUNCTION update_email_templates_updated_at IS 'Trigger function for email_templates updated_at - secured with empty search_path';
COMMENT ON FUNCTION public.can_user_access_design(UUID, UUID) IS 'Check if user can access a design based on their tier - secured with empty search_path';
COMMENT ON FUNCTION public.get_user_status_reason IS 'Get the reason for a user status (suspended/paused/disabled) - secured with empty search_path';
