-- Migration: Add tier archiving support
-- Allows tiers to be archived when they can't be deleted (have users assigned)

-- Add is_archived column
ALTER TABLE access_tiers
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;

-- Add archived_at timestamp
ALTER TABLE access_tiers
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- Add comments
COMMENT ON COLUMN access_tiers.is_archived IS 'Whether the tier is archived (soft deleted)';
COMMENT ON COLUMN access_tiers.archived_at IS 'When the tier was archived';

-- Create index for filtering archived tiers
CREATE INDEX IF NOT EXISTS idx_access_tiers_archived ON access_tiers(is_archived);
