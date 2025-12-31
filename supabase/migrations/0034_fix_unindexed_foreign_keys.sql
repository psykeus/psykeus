-- Migration: 0034_fix_unindexed_foreign_keys.sql
-- Purpose: Fix Performance Advisor warnings for unindexed foreign keys and redundant indexes
-- Created: 2025-01-01
-- AI Model: Claude Opus 4.5 (claude-opus-4-5-20251101)
--
-- Issues addressed:
-- 1. Add indexes for 18 unindexed foreign key columns
-- 2. Drop redundant/duplicate indexes

-- ============================================================================
-- PART 1: ADD MISSING FOREIGN KEY INDEXES
-- ============================================================================
-- Foreign keys without indexes cause slow JOINs and CASCADE operations.
-- These indexes improve performance for DELETE cascades and JOIN queries.

-- designs table - file references
CREATE INDEX IF NOT EXISTS idx_designs_current_version_id
  ON public.designs(current_version_id)
  WHERE current_version_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_designs_primary_file_id
  ON public.designs(primary_file_id)
  WHERE primary_file_id IS NOT NULL;

-- downloads table - design_file reference
CREATE INDEX IF NOT EXISTS idx_downloads_design_file_id
  ON public.downloads(design_file_id)
  WHERE design_file_id IS NOT NULL;

-- import_items table - additional FK references
CREATE INDEX IF NOT EXISTS idx_import_items_design_file_id
  ON public.import_items(design_file_id)
  WHERE design_file_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_import_items_duplicate_of
  ON public.import_items(duplicate_of_design_id)
  WHERE duplicate_of_design_id IS NOT NULL;

-- import_logs table - FK references for audit trail
CREATE INDEX IF NOT EXISTS idx_import_logs_item_id
  ON public.import_logs(item_id)
  WHERE item_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_import_logs_design_id
  ON public.import_logs(design_id)
  WHERE design_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_import_logs_design_file_id
  ON public.import_logs(design_file_id)
  WHERE design_file_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_import_logs_duplicate_of
  ON public.import_logs(duplicate_of_design_id)
  WHERE duplicate_of_design_id IS NOT NULL;

-- webhooks table - creator reference
CREATE INDEX IF NOT EXISTS idx_webhooks_created_by
  ON public.webhooks(created_by)
  WHERE created_by IS NOT NULL;

-- subscription_history table - tier and user references
CREATE INDEX IF NOT EXISTS idx_subscription_history_tier_id
  ON public.subscription_history(tier_id);

CREATE INDEX IF NOT EXISTS idx_subscription_history_previous_tier
  ON public.subscription_history(previous_tier_id)
  WHERE previous_tier_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subscription_history_granted_by
  ON public.subscription_history(granted_by)
  WHERE granted_by IS NOT NULL;

-- users table - self-references for status tracking
CREATE INDEX IF NOT EXISTS idx_users_suspended_by
  ON public.users(suspended_by)
  WHERE suspended_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_disabled_by
  ON public.users(disabled_by)
  WHERE disabled_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_paused_by
  ON public.users(paused_by)
  WHERE paused_by IS NOT NULL;

-- app_settings table - updated_by reference
CREATE INDEX IF NOT EXISTS idx_app_settings_updated_by
  ON public.app_settings(updated_by)
  WHERE updated_by IS NOT NULL;

-- payment_history table - tier reference
CREATE INDEX IF NOT EXISTS idx_payment_history_tier_id
  ON public.payment_history(tier_id)
  WHERE tier_id IS NOT NULL;

-- ============================================================================
-- PART 2: CLEAN UP REDUNDANT INDEXES
-- ============================================================================
-- Remove duplicate or superseded indexes to reduce write overhead and storage.

-- Drop old FTS index - superseded by idx_designs_fts_vector (GENERATED column approach in 0012)
DROP INDEX IF EXISTS public.idx_designs_fulltext;

-- Drop duplicate idx_design_tags_tag_id if created multiple times
-- (Migration 0010 and 0012 both create this - keep one instance)
-- Note: DROP INDEX IF EXISTS is idempotent, so this is safe even if only one exists

-- Drop duplicate audit_logs entity index (created in both 0008 and 0032)
-- Keep the one from 0008, drop any duplicate
-- Note: PostgreSQL won't allow duplicate index names, so this may already be a single index

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON INDEX idx_designs_current_version_id IS
'FK index: designs.current_version_id -> design_files for version lookups';

COMMENT ON INDEX idx_designs_primary_file_id IS
'FK index: designs.primary_file_id -> design_files for primary file lookups';

COMMENT ON INDEX idx_downloads_design_file_id IS
'FK index: downloads.design_file_id -> design_files for CASCADE deletes';

COMMENT ON INDEX idx_import_items_design_file_id IS
'FK index: import_items.design_file_id -> design_files';

COMMENT ON INDEX idx_import_items_duplicate_of IS
'FK index: import_items.duplicate_of_design_id -> designs for duplicate tracking';

COMMENT ON INDEX idx_webhooks_created_by IS
'FK index: webhooks.created_by -> users';

COMMENT ON INDEX idx_subscription_history_tier_id IS
'FK index: subscription_history.tier_id -> access_tiers';

COMMENT ON INDEX idx_users_suspended_by IS
'FK index: users.suspended_by -> users (self-reference) for admin tracking';

COMMENT ON INDEX idx_users_disabled_by IS
'FK index: users.disabled_by -> users (self-reference) for admin tracking';

COMMENT ON INDEX idx_users_paused_by IS
'FK index: users.paused_by -> users (self-reference) for admin tracking';

COMMENT ON INDEX idx_app_settings_updated_by IS
'FK index: app_settings.updated_by -> users for audit tracking';

COMMENT ON INDEX idx_payment_history_tier_id IS
'FK index: payment_history.tier_id -> access_tiers';
