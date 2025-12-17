-- =============================================================================
-- RECOMMENDED INDEXES FOR FOREIGN KEYS
-- These indexes improve JOIN performance on frequently-queried tables
-- Date: 2025-12-16
-- =============================================================================

-- -----------------------------------------------------------------------------
-- High Priority: Frequently joined tables
-- -----------------------------------------------------------------------------

-- design_tags: Used when displaying tags for designs
CREATE INDEX IF NOT EXISTS idx_design_tags_design_id
  ON public.design_tags(design_id);

-- design_view_stats: Used for view counts per design
CREATE INDEX IF NOT EXISTS idx_design_view_stats_design_id
  ON public.design_view_stats(design_id);

-- downloads: Used for download tracking and history
CREATE INDEX IF NOT EXISTS idx_downloads_design_file_id
  ON public.downloads(design_file_id);

-- designs: Used when fetching the primary file for a design
CREATE INDEX IF NOT EXISTS idx_designs_primary_file_id
  ON public.designs(primary_file_id);

-- designs: Used when fetching current version
CREATE INDEX IF NOT EXISTS idx_designs_current_version_id
  ON public.designs(current_version_id);

-- -----------------------------------------------------------------------------
-- Medium Priority: Occasionally joined tables
-- -----------------------------------------------------------------------------

-- import_items: Used during import process
CREATE INDEX IF NOT EXISTS idx_import_items_design_file_id
  ON public.import_items(design_file_id);

-- import_items: Used for duplicate detection
CREATE INDEX IF NOT EXISTS idx_import_items_duplicate_of
  ON public.import_items(duplicate_of_design_id);

-- payment_history: Used for tier lookups in payment history
CREATE INDEX IF NOT EXISTS idx_payment_history_tier_id
  ON public.payment_history(tier_id);

-- subscription_history: User subscription lookups
CREATE INDEX IF NOT EXISTS idx_subscription_history_user_id
  ON public.subscription_history(user_id);

-- subscription_history: Tier lookups
CREATE INDEX IF NOT EXISTS idx_subscription_history_tier_id
  ON public.subscription_history(tier_id);

-- =============================================================================
-- DONE! These indexes will improve JOIN performance.
-- =============================================================================
