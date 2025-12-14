-- Performance optimization indexes
-- Addresses slow tag filtering and search queries

-- =============================================================================
-- Full-Text Search Optimization
-- =============================================================================

-- Add generated column for full-text search vector
-- This enables efficient FTS on both title and description
ALTER TABLE designs
ADD COLUMN IF NOT EXISTS fts_vector tsvector
GENERATED ALWAYS AS (
  to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, ''))
) STORED;

-- Create GIN index on the generated column for fast FTS
CREATE INDEX IF NOT EXISTS idx_designs_fts_vector
ON designs USING gin(fts_vector);

-- =============================================================================
-- Tag Query Optimization
-- =============================================================================

-- Index for faster tag lookups when filtering designs by tag
-- The primary key is (design_id, tag_id) but we need tag_id first for tag-based queries
CREATE INDEX IF NOT EXISTS idx_design_tags_tag_id
ON design_tags(tag_id);

-- Index for faster tag name lookups (UNIQUE is slower than btree for lookups)
CREATE INDEX IF NOT EXISTS idx_tags_name_lookup
ON tags(name);

-- Composite index for common design list queries
-- Covers: is_public filter + created_at sort (most common browse query)
CREATE INDEX IF NOT EXISTS idx_designs_public_created
ON designs(is_public, created_at DESC)
WHERE is_public = true;

-- Index for category overlap queries (used in related designs)
CREATE INDEX IF NOT EXISTS idx_designs_categories
ON designs USING gin(categories)
WHERE is_public = true;

-- Index for difficulty filtering
CREATE INDEX IF NOT EXISTS idx_designs_difficulty
ON designs(difficulty)
WHERE is_public = true AND difficulty IS NOT NULL;

-- Index for style filtering
CREATE INDEX IF NOT EXISTS idx_designs_style
ON designs(style)
WHERE is_public = true AND style IS NOT NULL;

-- =============================================================================
-- Related Designs Function
-- =============================================================================

-- Efficient function to find related designs using database-level scoring
-- Much faster than fetching all data and scoring in Node.js
CREATE OR REPLACE FUNCTION get_related_designs(
  p_design_id UUID,
  p_categories TEXT[],
  p_tag_ids UUID[],
  p_limit INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  slug TEXT,
  title TEXT,
  preview_path TEXT,
  categories TEXT[],
  difficulty TEXT,
  style TEXT,
  similarity INT
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  WITH design_tag_counts AS (
    -- Count tag overlaps per design
    SELECT
      dt.design_id,
      COUNT(*)::INT * 10 AS tag_score
    FROM design_tags dt
    WHERE dt.tag_id = ANY(p_tag_ids)
      AND dt.design_id != p_design_id
    GROUP BY dt.design_id
  )
  SELECT
    d.id,
    d.slug,
    d.title,
    d.preview_path,
    d.categories,
    d.difficulty,
    d.style,
    LEAST(
      50 + COALESCE(dtc.tag_score, 0),
      95
    )::INT AS similarity
  FROM designs d
  LEFT JOIN design_tag_counts dtc ON d.id = dtc.design_id
  WHERE d.is_public = true
    AND d.id != p_design_id
    AND (
      p_categories IS NULL
      OR p_categories = '{}'
      OR d.categories && p_categories
    )
  ORDER BY similarity DESC, d.created_at DESC
  LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION get_related_designs IS
'Efficiently finds related designs by category and tag overlap.
Scoring: 50 base points for category match + 10 per matching tag, capped at 95.';

-- =============================================================================
-- Statistics
-- =============================================================================

-- Analyze tables to update statistics for query planner
ANALYZE designs;
ANALYZE design_tags;
ANALYZE tags;
