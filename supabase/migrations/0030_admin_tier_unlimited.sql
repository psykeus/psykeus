-- Migration: 0030_admin_tier_unlimited.sql
-- Purpose: Give admin users unlimited access regardless of tier
-- Created: 2025-12-28
-- AI Model: Claude Opus 4.5 (claude-opus-4-5-20251101)

-- ============================================================================
-- CREATE ADMIN TIER
-- ============================================================================

-- Insert admin tier if it doesn't exist
INSERT INTO access_tiers (
  name,
  slug,
  description,
  daily_download_limit,
  monthly_download_limit,
  can_access_premium,
  can_access_exclusive,
  can_create_collections,
  max_collections,
  max_favorites,
  price_monthly,
  price_yearly,
  sort_order,
  is_active,
  show_on_pricing
)
VALUES (
  'Admin',
  'admin',
  'Administrative access with unlimited privileges',
  NULL,  -- Unlimited daily
  NULL,  -- Unlimited monthly
  TRUE,  -- Can access premium
  TRUE,  -- Can access exclusive
  TRUE,  -- Can create collections
  NULL,  -- Unlimited collections
  NULL,  -- Unlimited favorites
  0,     -- Free (internal use)
  0,
  999,   -- Sort last (not shown on pricing)
  TRUE,
  FALSE  -- Don't show on pricing page
)
ON CONFLICT (slug) DO UPDATE SET
  description = EXCLUDED.description,
  daily_download_limit = EXCLUDED.daily_download_limit,
  monthly_download_limit = EXCLUDED.monthly_download_limit,
  can_access_premium = EXCLUDED.can_access_premium,
  can_access_exclusive = EXCLUDED.can_access_exclusive,
  can_create_collections = EXCLUDED.can_create_collections,
  max_collections = EXCLUDED.max_collections,
  max_favorites = EXCLUDED.max_favorites,
  show_on_pricing = EXCLUDED.show_on_pricing;

-- ============================================================================
-- UPDATE ACCESS FUNCTIONS TO BYPASS FOR ADMINS
-- ============================================================================

-- Update can_user_access_design to always allow admins
CREATE OR REPLACE FUNCTION can_user_access_design(user_uuid UUID, design_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  design_access VARCHAR(20);
  user_record RECORD;
BEGIN
  -- Check if user is an admin - admins can access everything
  SELECT role INTO user_record
  FROM public.users
  WHERE id = user_uuid;

  IF user_record.role IN ('admin', 'super_admin') THEN
    RETURN TRUE;
  END IF;

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

  -- Get user's tier
  SELECT t.can_access_premium, t.can_access_exclusive INTO user_record
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
    RETURN user_record.can_access_premium;
  ELSIF design_access = 'exclusive' THEN
    RETURN user_record.can_access_exclusive;
  END IF;

  RETURN FALSE;
END;
$$;

-- Update check_user_download_limit to always allow admins unlimited downloads
CREATE OR REPLACE FUNCTION check_user_download_limit(user_uuid UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  user_record RECORD;
  user_tier RECORD;
  downloads_today INTEGER;
  downloads_month INTEGER;
  can_download BOOLEAN := TRUE;
  reason TEXT := NULL;
BEGIN
  -- Check if user is an admin - admins have unlimited downloads
  SELECT role INTO user_record
  FROM public.users
  WHERE id = user_uuid;

  IF user_record.role IN ('admin', 'super_admin') THEN
    -- Get download counts for display purposes
    SELECT
      COUNT(*) FILTER (WHERE downloaded_at >= CURRENT_DATE),
      COUNT(*) FILTER (WHERE downloaded_at >= DATE_TRUNC('month', CURRENT_DATE))
    INTO downloads_today, downloads_month
    FROM public.downloads
    WHERE user_id = user_uuid;

    RETURN jsonb_build_object(
      'can_download', TRUE,
      'reason', NULL,
      'downloads_today', COALESCE(downloads_today, 0),
      'downloads_this_month', COALESCE(downloads_month, 0),
      'daily_limit', NULL,
      'monthly_limit', NULL,
      'is_admin', TRUE
    );
  END IF;

  -- Get user's tier
  SELECT t.* INTO user_tier
  FROM public.users u
  JOIN public.access_tiers t ON u.tier_id = t.id
  WHERE u.id = user_uuid;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('can_download', FALSE, 'reason', 'User not found');
  END IF;

  -- Get current download counts
  SELECT
    COUNT(*) FILTER (WHERE downloaded_at >= CURRENT_DATE),
    COUNT(*) FILTER (WHERE downloaded_at >= DATE_TRUNC('month', CURRENT_DATE))
  INTO downloads_today, downloads_month
  FROM public.downloads
  WHERE user_id = user_uuid;

  -- Check daily limit
  IF user_tier.daily_download_limit IS NOT NULL AND downloads_today >= user_tier.daily_download_limit THEN
    can_download := FALSE;
    reason := 'Daily download limit reached';
  -- Check monthly limit
  ELSIF user_tier.monthly_download_limit IS NOT NULL AND downloads_month >= user_tier.monthly_download_limit THEN
    can_download := FALSE;
    reason := 'Monthly download limit reached';
  END IF;

  RETURN jsonb_build_object(
    'can_download', can_download,
    'reason', reason,
    'downloads_today', COALESCE(downloads_today, 0),
    'downloads_this_month', COALESCE(downloads_month, 0),
    'daily_limit', user_tier.daily_download_limit,
    'monthly_limit', user_tier.monthly_download_limit,
    'is_admin', FALSE
  );
END;
$$;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION can_user_access_design(UUID, UUID) IS
'Check if a user can access a design. Admins always have access.';

COMMENT ON FUNCTION check_user_download_limit(UUID) IS
'Check if user has remaining downloads. Admins have unlimited downloads.';
