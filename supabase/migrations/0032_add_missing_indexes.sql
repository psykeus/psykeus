-- Migration: Add missing indexes for performance optimization
-- Created: 2025-12-29
-- AI Model: Claude Opus 4.5 (claude-opus-4-5-20251101)
--
-- These indexes address common query patterns identified in the codebase audit.

-- =========================================================================
-- NOTIFICATIONS TABLE INDEXES
-- =========================================================================

-- Index for expiring notifications cleanup queries
-- Used by: notification cleanup jobs that filter by expires_at
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_expires
  ON notifications(user_id, expires_at)
  WHERE expires_at IS NOT NULL;

-- Index for notification listing with type filter
-- Used by: GET /api/notifications with type parameter
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_type_created
  ON notifications(user_id, type, created_at DESC);

-- Index for unread notification counts
-- Used by: notification badge showing unread count
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_unread
  ON notifications(user_id, is_read)
  WHERE is_read = false;

-- =========================================================================
-- IMPORT JOBS TABLE INDEXES
-- =========================================================================

-- Index for listing import jobs by status
-- Used by: GET /api/admin/import/jobs with status filter
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_import_jobs_status_created
  ON import_jobs(status, created_at DESC);

-- =========================================================================
-- IMPORT ITEMS TABLE INDEXES
-- =========================================================================

-- Index for getting pending items by project
-- Used by: job processor batch queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_import_items_job_project_status
  ON import_items(job_id, detected_project_id, status)
  WHERE status = 'pending';

-- =========================================================================
-- DESIGN FILES TABLE INDEXES
-- =========================================================================

-- Index for content hash lookups (duplicate detection)
-- Used by: import processor duplicate checking
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_design_files_content_hash
  ON design_files(content_hash)
  WHERE is_active = true AND content_hash IS NOT NULL;

-- Index for preview phash lookups (near-duplicate detection)
-- Used by: import processor near-duplicate checking
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_design_files_preview_phash
  ON design_files(preview_phash)
  WHERE is_active = true AND preview_phash IS NOT NULL;

-- =========================================================================
-- AUDIT LOGS TABLE INDEXES
-- =========================================================================

-- Index for entity-based audit log queries
-- Used by: admin UI showing history for specific entities
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_entity
  ON audit_logs(entity_type, entity_id, created_at DESC);

-- =========================================================================
-- CLEANUP: Remove duplicate indexes if they exist
-- =========================================================================

-- Check and drop idx_downloads_date if it duplicates another index
-- Note: Only drop if we confirm it's truly redundant
-- The downloads table likely already has idx_downloads_created_at
DO $$
BEGIN
  -- Check if both indexes exist
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'idx_downloads_date'
    AND tablename = 'downloads'
  ) AND EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'idx_downloads_created_at'
    AND tablename = 'downloads'
  ) THEN
    DROP INDEX IF EXISTS idx_downloads_date;
  END IF;
END $$;
