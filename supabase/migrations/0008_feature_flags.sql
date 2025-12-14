-- Migration: Feature Flags Support
-- Adds tables for favorites, collections, audit logs, webhooks, and scheduled publishing

-- ============================================================================
-- USER FAVORITES
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  design_id UUID NOT NULL REFERENCES designs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Prevent duplicate favorites
  UNIQUE(user_id, design_id)
);

-- Indexes for fast lookups
CREATE INDEX idx_user_favorites_user_id ON user_favorites(user_id);
CREATE INDEX idx_user_favorites_design_id ON user_favorites(design_id);
CREATE INDEX idx_user_favorites_created_at ON user_favorites(created_at DESC);

-- RLS policies
ALTER TABLE user_favorites ENABLE ROW LEVEL SECURITY;

-- Users can view their own favorites
CREATE POLICY "Users can view own favorites"
  ON user_favorites FOR SELECT
  USING (auth.uid() = user_id);

-- Users can add favorites
CREATE POLICY "Users can add favorites"
  ON user_favorites FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can remove their own favorites
CREATE POLICY "Users can remove own favorites"
  ON user_favorites FOR DELETE
  USING (auth.uid() = user_id);

-- Admins can view all favorites (for analytics)
CREATE POLICY "Admins can view all favorites"
  ON user_favorites FOR SELECT
  USING (public.is_admin());

-- ============================================================================
-- COLLECTIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  cover_image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_collections_user_id ON collections(user_id);
CREATE INDEX idx_collections_is_public ON collections(is_public) WHERE is_public = TRUE;
CREATE INDEX idx_collections_created_at ON collections(created_at DESC);

-- RLS policies
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;

-- Users can view their own collections
CREATE POLICY "Users can view own collections"
  ON collections FOR SELECT
  USING (auth.uid() = user_id);

-- Users can view public collections
CREATE POLICY "Anyone can view public collections"
  ON collections FOR SELECT
  USING (is_public = TRUE);

-- Users can create collections
CREATE POLICY "Users can create collections"
  ON collections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own collections
CREATE POLICY "Users can update own collections"
  ON collections FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own collections
CREATE POLICY "Users can delete own collections"
  ON collections FOR DELETE
  USING (auth.uid() = user_id);

-- Admins can view all collections
CREATE POLICY "Admins can view all collections"
  ON collections FOR SELECT
  USING (public.is_admin());

-- ============================================================================
-- COLLECTION ITEMS
-- ============================================================================

CREATE TABLE IF NOT EXISTS collection_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  design_id UUID NOT NULL REFERENCES designs(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sort_order INTEGER NOT NULL DEFAULT 0,
  notes TEXT,

  -- Prevent duplicate items in same collection
  UNIQUE(collection_id, design_id)
);

-- Indexes
CREATE INDEX idx_collection_items_collection_id ON collection_items(collection_id);
CREATE INDEX idx_collection_items_design_id ON collection_items(design_id);
CREATE INDEX idx_collection_items_sort_order ON collection_items(collection_id, sort_order);

-- RLS policies
ALTER TABLE collection_items ENABLE ROW LEVEL SECURITY;

-- Users can view items in their collections
CREATE POLICY "Users can view own collection items"
  ON collection_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = collection_items.collection_id
      AND c.user_id = auth.uid()
    )
  );

-- Anyone can view items in public collections
CREATE POLICY "Anyone can view public collection items"
  ON collection_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = collection_items.collection_id
      AND c.is_public = TRUE
    )
  );

-- Users can add items to their collections
CREATE POLICY "Users can add items to own collections"
  ON collection_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = collection_items.collection_id
      AND c.user_id = auth.uid()
    )
  );

-- Users can update items in their collections
CREATE POLICY "Users can update own collection items"
  ON collection_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = collection_items.collection_id
      AND c.user_id = auth.uid()
    )
  );

-- Users can remove items from their collections
CREATE POLICY "Users can remove items from own collections"
  ON collection_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = collection_items.collection_id
      AND c.user_id = auth.uid()
    )
  );

-- ============================================================================
-- AUDIT LOGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  user_email VARCHAR(255),
  action VARCHAR(50) NOT NULL, -- 'create', 'update', 'delete', 'publish', 'unpublish', etc.
  entity_type VARCHAR(50) NOT NULL, -- 'design', 'user', 'collection', 'tag', etc.
  entity_id UUID,
  entity_name VARCHAR(255),
  changes JSONB, -- Before/after diff
  metadata JSONB, -- Additional context (IP, user agent, etc.)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for querying
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_entity_type ON audit_logs(entity_type);
CREATE INDEX idx_audit_logs_entity_id ON audit_logs(entity_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- Composite index for common queries
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id, created_at DESC);

-- RLS policies
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Admins can view audit logs"
  ON audit_logs FOR SELECT
  USING (public.is_admin());

-- Only service role can insert (via backend)
CREATE POLICY "Service role can insert audit logs"
  ON audit_logs FOR INSERT
  WITH CHECK (TRUE); -- Will be restricted by service role usage

-- ============================================================================
-- WEBHOOKS
-- ============================================================================

CREATE TABLE IF NOT EXISTS webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  url TEXT NOT NULL,
  secret VARCHAR(255), -- For signature verification
  events TEXT[] NOT NULL DEFAULT '{}', -- Array of event types
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  headers JSONB DEFAULT '{}', -- Custom headers
  retry_count INTEGER NOT NULL DEFAULT 3,
  timeout_ms INTEGER NOT NULL DEFAULT 5000,
  last_triggered_at TIMESTAMPTZ,
  last_status INTEGER, -- HTTP status code
  last_error TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_webhooks_is_active ON webhooks(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_webhooks_events ON webhooks USING GIN(events);

-- RLS policies
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;

-- Only admins can manage webhooks
CREATE POLICY "Admins can view webhooks"
  ON webhooks FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Admins can create webhooks"
  ON webhooks FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update webhooks"
  ON webhooks FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "Admins can delete webhooks"
  ON webhooks FOR DELETE
  USING (public.is_admin());

-- ============================================================================
-- WEBHOOK DELIVERIES (for tracking/debugging)
-- ============================================================================

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,
  payload JSONB NOT NULL,
  response_status INTEGER,
  response_body TEXT,
  error TEXT,
  duration_ms INTEGER,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  delivered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_webhook_deliveries_webhook_id ON webhook_deliveries(webhook_id);
CREATE INDEX idx_webhook_deliveries_event_type ON webhook_deliveries(event_type);
CREATE INDEX idx_webhook_deliveries_delivered_at ON webhook_deliveries(delivered_at DESC);

-- RLS policies
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view webhook deliveries"
  ON webhook_deliveries FOR SELECT
  USING (public.is_admin());

-- ============================================================================
-- SCHEDULED PUBLISHING (add column to designs)
-- ============================================================================

ALTER TABLE designs
ADD COLUMN IF NOT EXISTS publish_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS unpublish_at TIMESTAMPTZ;

-- Index for finding designs to publish/unpublish
CREATE INDEX IF NOT EXISTS idx_designs_publish_at
  ON designs(publish_at)
  WHERE publish_at IS NOT NULL AND is_public = FALSE;

CREATE INDEX IF NOT EXISTS idx_designs_unpublish_at
  ON designs(unpublish_at)
  WHERE unpublish_at IS NOT NULL AND is_public = TRUE;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to get favorite count for a design
CREATE OR REPLACE FUNCTION get_favorite_count(design_uuid UUID)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER
  FROM user_favorites
  WHERE design_id = design_uuid;
$$ LANGUAGE SQL STABLE;

-- Function to check if user has favorited a design
CREATE OR REPLACE FUNCTION is_favorited(design_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_favorites
    WHERE design_id = design_uuid AND user_id = user_uuid
  );
$$ LANGUAGE SQL STABLE;

-- Function to get collection count for a user
CREATE OR REPLACE FUNCTION get_user_collection_count(user_uuid UUID)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER
  FROM collections
  WHERE user_id = user_uuid;
$$ LANGUAGE SQL STABLE;

-- Function to check designs due for publishing
CREATE OR REPLACE FUNCTION get_designs_to_publish()
RETURNS SETOF designs AS $$
  SELECT * FROM designs
  WHERE publish_at IS NOT NULL
    AND publish_at <= NOW()
    AND is_public = FALSE;
$$ LANGUAGE SQL STABLE;

-- Function to check designs due for unpublishing
CREATE OR REPLACE FUNCTION get_designs_to_unpublish()
RETURNS SETOF designs AS $$
  SELECT * FROM designs
  WHERE unpublish_at IS NOT NULL
    AND unpublish_at <= NOW()
    AND is_public = TRUE;
$$ LANGUAGE SQL STABLE;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update collections.updated_at on change
CREATE OR REPLACE FUNCTION update_collection_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER collections_updated_at
  BEFORE UPDATE ON collections
  FOR EACH ROW
  EXECUTE FUNCTION update_collection_timestamp();

-- Update webhooks.updated_at on change
CREATE TRIGGER webhooks_updated_at
  BEFORE UPDATE ON webhooks
  FOR EACH ROW
  EXECUTE FUNCTION update_collection_timestamp();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE user_favorites IS 'Tracks user favorite designs';
COMMENT ON TABLE collections IS 'User-created collections of designs';
COMMENT ON TABLE collection_items IS 'Designs within collections';
COMMENT ON TABLE audit_logs IS 'Admin action audit trail';
COMMENT ON TABLE webhooks IS 'Webhook configurations for external integrations';
COMMENT ON TABLE webhook_deliveries IS 'Webhook delivery history and debugging';
COMMENT ON COLUMN designs.publish_at IS 'Scheduled time to auto-publish design';
COMMENT ON COLUMN designs.unpublish_at IS 'Scheduled time to auto-unpublish design';
