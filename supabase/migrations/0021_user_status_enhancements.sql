-- Migration: Enhanced User Status Management
-- Adds paused and disabled status states, tracking columns, and password reset support

-- ============================================================================
-- ADD NEW STATUS COLUMNS
-- ============================================================================

-- Add columns for tracking paused status
ALTER TABLE users ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS paused_by UUID REFERENCES users(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS paused_reason TEXT;

-- Add columns for tracking disabled status
ALTER TABLE users ADD COLUMN IF NOT EXISTS disabled_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS disabled_by UUID REFERENCES users(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS disabled_reason TEXT;

-- Add constraint to enforce valid status values (if not already exists)
-- Note: status column already exists as VARCHAR(20) with default 'active'
-- New valid values: 'active', 'paused', 'disabled', 'suspended', 'banned'
DO $$
BEGIN
  -- Drop existing constraint if it exists
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_status_check') THEN
    ALTER TABLE users DROP CONSTRAINT users_status_check;
  END IF;

  -- Add new constraint with all status values
  ALTER TABLE users ADD CONSTRAINT users_status_check
    CHECK (status IN ('active', 'paused', 'disabled', 'suspended', 'banned'));
END $$;

-- Create index for new status values
CREATE INDEX IF NOT EXISTS idx_users_paused_at ON users(paused_at) WHERE paused_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_disabled_at ON users(disabled_at) WHERE disabled_at IS NOT NULL;

-- ============================================================================
-- UPDATE HELPER FUNCTIONS
-- ============================================================================

-- Update can_user_access_design to check for paused/disabled status
CREATE OR REPLACE FUNCTION can_user_access_design(user_uuid UUID, design_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  design_access VARCHAR(20);
  user_tier RECORD;
BEGIN
  -- Get design access level
  SELECT access_level INTO design_access
  FROM designs WHERE id = design_uuid;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Free designs are accessible to everyone
  IF design_access = 'free' THEN
    RETURN TRUE;
  END IF;

  -- Get user's tier (only active users can access premium content)
  SELECT t.* INTO user_tier
  FROM users u
  JOIN access_tiers t ON u.tier_id = t.id
  WHERE u.id = user_uuid
    AND (u.tier_expires_at IS NULL OR u.tier_expires_at > NOW())
    AND u.status = 'active'; -- Only active users

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

-- ============================================================================
-- STATUS REASON DISPLAY FUNCTION
-- ============================================================================

-- Get human-readable status reason for a user
CREATE OR REPLACE FUNCTION get_user_status_reason(user_uuid UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_record RECORD;
BEGIN
  SELECT
    status,
    paused_at, paused_reason,
    disabled_at, disabled_reason,
    suspended_at, suspended_reason
  INTO user_record
  FROM users
  WHERE id = user_uuid;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'User not found');
  END IF;

  RETURN jsonb_build_object(
    'status', user_record.status,
    'paused_at', user_record.paused_at,
    'paused_reason', user_record.paused_reason,
    'disabled_at', user_record.disabled_at,
    'disabled_reason', user_record.disabled_reason,
    'suspended_at', user_record.suspended_at,
    'suspended_reason', user_record.suspended_reason
  );
END;
$$;

-- ============================================================================
-- AUDIT LOG ENTRIES FOR STATUS CHANGES
-- ============================================================================

-- Add status change event types to audit log (if audit_logs table exists)
-- These will be logged by the application when status changes occur

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON COLUMN users.status IS 'Account status: active (normal), paused (user-requested hold), disabled (admin-disabled), suspended (policy violation), banned (permanent)';
COMMENT ON COLUMN users.paused_at IS 'When the account was paused';
COMMENT ON COLUMN users.paused_by IS 'Admin who paused the account';
COMMENT ON COLUMN users.paused_reason IS 'Reason for pausing (e.g., vacation hold)';
COMMENT ON COLUMN users.disabled_at IS 'When the account was disabled';
COMMENT ON COLUMN users.disabled_by IS 'Admin who disabled the account';
COMMENT ON COLUMN users.disabled_reason IS 'Reason for disabling';
COMMENT ON FUNCTION get_user_status_reason IS 'Get detailed status information for a user';
