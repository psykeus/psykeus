-- Performance Optimizations Migration (Supabase Studio Version)
-- Created: 2025-12-06
-- Note: CONCURRENTLY removed for execution in transaction block

-- ============================================================================
-- RPC Function: get_popular_designs
-- Efficiently aggregates download counts at database level instead of in-memory
-- ============================================================================
CREATE OR REPLACE FUNCTION get_popular_designs(
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_limit INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  slug TEXT,
  preview_path TEXT,
  categories TEXT[],
  download_count BIGINT
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    d.title,
    d.slug,
    d.preview_path,
    d.categories,
    COUNT(dl.id) as download_count
  FROM designs d
  LEFT JOIN downloads dl ON dl.design_id = d.id
    AND (p_start_date IS NULL OR dl.downloaded_at >= p_start_date)
  GROUP BY d.id, d.title, d.slug, d.preview_path, d.categories
  HAVING COUNT(dl.id) > 0
  ORDER BY download_count DESC
  LIMIT p_limit;
END;
$$;

-- ============================================================================
-- RPC Function: get_designs_by_tag
-- Single-query tag filtering instead of 3 separate queries
-- ============================================================================
CREATE OR REPLACE FUNCTION get_designs_by_tag(p_tag_name TEXT)
RETURNS SETOF UUID
LANGUAGE sql
STABLE
AS $$
  SELECT DISTINCT dt.design_id
  FROM design_tags dt
  JOIN tags t ON t.id = dt.tag_id
  WHERE t.name = p_tag_name;
$$;

-- ============================================================================
-- Performance Indexes (without CONCURRENTLY for transaction compatibility)
-- ============================================================================

-- Index for public designs listing (most common query)
CREATE INDEX IF NOT EXISTS idx_designs_public_created
ON designs(is_public, created_at DESC)
WHERE is_public = true;

-- Index for design files lookup
CREATE INDEX IF NOT EXISTS idx_design_files_active_role
ON design_files(design_id, file_role, is_active)
WHERE is_active = true;

-- Index for slug lookups (design detail pages)
CREATE INDEX IF NOT EXISTS idx_designs_slug
ON designs(slug)
WHERE slug IS NOT NULL;

-- Index for tag filtering
CREATE INDEX IF NOT EXISTS idx_design_tags_tag_id
ON design_tags(tag_id);

-- Index for favorites by user (used in favorite status checks)
CREATE INDEX IF NOT EXISTS idx_favorites_user_design
ON user_favorites(user_id, design_id);

-- Index for downloads by date (used in analytics)
CREATE INDEX IF NOT EXISTS idx_downloads_date
ON downloads(downloaded_at DESC);

-- Index for downloads by design (used in popular designs query)
CREATE INDEX IF NOT EXISTS idx_downloads_design_id
ON downloads(design_id);

-- ============================================================================
-- RPC Function: validate_session_with_role
-- Combined session validation and role check in one query
-- ============================================================================
CREATE OR REPLACE FUNCTION validate_session_with_role(
  p_session_token TEXT,
  p_user_id UUID
)
RETURNS TABLE (
  is_valid BOOLEAN,
  user_role TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    (s.user_id IS NOT NULL AND s.user_id = p_user_id) as is_valid,
    COALESCE(u.role, 'user') as user_role
  FROM user_sessions s
  LEFT JOIN users u ON u.id = s.user_id
  WHERE s.session_token = p_session_token
  LIMIT 1;

  -- If no rows returned (session not found), return invalid
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'user'::TEXT;
  END IF;
END;
$$;

-- ============================================================================
-- Grant permissions
-- ============================================================================
GRANT EXECUTE ON FUNCTION get_popular_designs TO authenticated;
GRANT EXECUTE ON FUNCTION get_popular_designs TO service_role;
GRANT EXECUTE ON FUNCTION get_designs_by_tag TO authenticated;
GRANT EXECUTE ON FUNCTION get_designs_by_tag TO service_role;
GRANT EXECUTE ON FUNCTION get_designs_by_tag TO anon;
GRANT EXECUTE ON FUNCTION validate_session_with_role TO service_role;
