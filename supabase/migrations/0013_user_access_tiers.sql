-- Migration: User Access Tiers and Enhanced User Management
-- Adds subscription tiers, design access control, and enhanced user tracking

-- ============================================================================
-- ACCESS TIERS
-- ============================================================================

-- Define available subscription/access tiers
CREATE TABLE IF NOT EXISTS access_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL UNIQUE,
  slug VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  -- Tier limits
  daily_download_limit INTEGER, -- NULL means unlimited
  monthly_download_limit INTEGER,
  can_access_premium BOOLEAN NOT NULL DEFAULT FALSE,
  can_access_exclusive BOOLEAN NOT NULL DEFAULT FALSE,
  can_create_collections BOOLEAN NOT NULL DEFAULT TRUE,
  max_collections INTEGER DEFAULT 10, -- NULL means unlimited
  max_favorites INTEGER DEFAULT 100, -- NULL means unlimited
  -- Pricing (for display, actual billing handled externally)
  price_monthly DECIMAL(10,2),
  price_yearly DECIMAL(10,2),
  -- Metadata
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default tiers
INSERT INTO access_tiers (name, slug, description, daily_download_limit, monthly_download_limit, can_access_premium, can_access_exclusive, sort_order, price_monthly, price_yearly)
VALUES
  ('Free', 'free', 'Basic access to free designs', 5, 50, FALSE, FALSE, 0, 0, 0),
  ('Premium', 'premium', 'Unlimited access to free and premium designs', NULL, NULL, TRUE, FALSE, 1, 9.99, 99.99),
  ('Pro', 'pro', 'Full access to all designs including exclusives', NULL, NULL, TRUE, TRUE, 2, 19.99, 199.99)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- ENHANCE USERS TABLE
-- ============================================================================

-- Add new columns to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS tier_id UUID REFERENCES access_tiers(id),
ADD COLUMN IF NOT EXISTS tier_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active', -- active, suspended, banned
ADD COLUMN IF NOT EXISTS suspended_reason TEXT,
ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS suspended_by UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS login_count INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS profile_image_url TEXT,
ADD COLUMN IF NOT EXISTS bio TEXT,
ADD COLUMN IF NOT EXISTS website TEXT,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Set default tier for existing users (free tier)
UPDATE users
SET tier_id = (SELECT id FROM access_tiers WHERE slug = 'free')
WHERE tier_id IS NULL;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_users_tier_id ON users(tier_id);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login_at DESC);

-- ============================================================================
-- DESIGN ACCESS LEVELS
-- ============================================================================

-- Add access level to designs
ALTER TABLE designs
ADD COLUMN IF NOT EXISTS access_level VARCHAR(20) NOT NULL DEFAULT 'free'; -- free, premium, exclusive

-- Create index for access level filtering
CREATE INDEX IF NOT EXISTS idx_designs_access_level ON designs(access_level);

-- ============================================================================
-- DOWNLOAD TRACKING ENHANCEMENTS
-- ============================================================================

-- Add daily/monthly tracking views
CREATE OR REPLACE VIEW user_download_stats AS
SELECT
  user_id,
  COUNT(*) FILTER (WHERE downloaded_at >= CURRENT_DATE) AS downloads_today,
  COUNT(*) FILTER (WHERE downloaded_at >= DATE_TRUNC('month', CURRENT_DATE)) AS downloads_this_month,
  COUNT(*) AS total_downloads
FROM downloads
GROUP BY user_id;

-- ============================================================================
-- USER ANALYTICS
-- ============================================================================

-- Track design views for analytics
CREATE TABLE IF NOT EXISTS design_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  design_id UUID NOT NULL REFERENCES designs(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  session_id TEXT, -- For anonymous tracking
  ip_address INET,
  user_agent TEXT,
  referrer TEXT,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for design_views
CREATE INDEX IF NOT EXISTS idx_design_views_design_id ON design_views(design_id);
CREATE INDEX IF NOT EXISTS idx_design_views_user_id ON design_views(user_id);
CREATE INDEX IF NOT EXISTS idx_design_views_viewed_at ON design_views(viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_design_views_session ON design_views(session_id) WHERE session_id IS NOT NULL;

-- Daily view aggregates (for dashboard performance)
CREATE TABLE IF NOT EXISTS design_view_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  design_id UUID NOT NULL REFERENCES designs(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  view_count INTEGER NOT NULL DEFAULT 0,
  unique_visitors INTEGER NOT NULL DEFAULT 0,
  UNIQUE(design_id, date)
);

CREATE INDEX IF NOT EXISTS idx_design_view_stats_date ON design_view_stats(date DESC);
CREATE INDEX IF NOT EXISTS idx_design_view_stats_design ON design_view_stats(design_id);

-- ============================================================================
-- USER ACTIVITY LOG
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activity_type VARCHAR(50) NOT NULL, -- login, download, favorite, view, collection_create, etc.
  entity_type VARCHAR(50), -- design, collection, etc.
  entity_id UUID,
  metadata JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_activity_user_id ON user_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_type ON user_activity(activity_type);
CREATE INDEX IF NOT EXISTS idx_user_activity_created_at ON user_activity(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_activity_entity ON user_activity(entity_type, entity_id);

-- ============================================================================
-- SUBSCRIPTION HISTORY
-- ============================================================================

CREATE TABLE IF NOT EXISTS subscription_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tier_id UUID NOT NULL REFERENCES access_tiers(id),
  action VARCHAR(20) NOT NULL, -- upgrade, downgrade, cancel, renew, grant, revoke
  previous_tier_id UUID REFERENCES access_tiers(id),
  reason TEXT,
  granted_by UUID REFERENCES users(id), -- Admin who granted/revoked
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_history_user ON subscription_history(user_id);
CREATE INDEX IF NOT EXISTS idx_subscription_history_created ON subscription_history(created_at DESC);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Access tiers (public read)
ALTER TABLE access_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active tiers"
  ON access_tiers FOR SELECT
  USING (is_active = TRUE);

CREATE POLICY "Admins can manage tiers"
  ON access_tiers FOR ALL
  USING (public.is_admin());

-- Design views (users can insert their own, admins can see all)
ALTER TABLE design_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can record views"
  ON design_views FOR INSERT
  WITH CHECK (TRUE);

CREATE POLICY "Users can see their own views"
  ON design_views FOR SELECT
  USING (user_id = auth.uid() OR public.is_admin());

-- Design view stats (public read)
ALTER TABLE design_view_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view stats"
  ON design_view_stats FOR SELECT
  USING (TRUE);

CREATE POLICY "Service role can update stats"
  ON design_view_stats FOR ALL
  USING (TRUE);

-- User activity (users see their own, admins see all)
ALTER TABLE user_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can see own activity"
  ON user_activity FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins can see all activity"
  ON user_activity FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Service role can insert activity"
  ON user_activity FOR INSERT
  WITH CHECK (TRUE);

-- Subscription history (users see their own, admins see all)
ALTER TABLE subscription_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can see own subscription history"
  ON subscription_history FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins can manage subscription history"
  ON subscription_history FOR ALL
  USING (public.is_admin());

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Check if user can access a design based on their tier
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

  -- Get user's tier
  SELECT t.* INTO user_tier
  FROM users u
  JOIN access_tiers t ON u.tier_id = t.id
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

-- Check if user has reached their download limit
CREATE OR REPLACE FUNCTION check_user_download_limit(user_uuid UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_tier RECORD;
  downloads_today INTEGER;
  downloads_month INTEGER;
  can_download BOOLEAN := TRUE;
  reason TEXT := NULL;
BEGIN
  -- Get user's tier
  SELECT t.* INTO user_tier
  FROM users u
  JOIN access_tiers t ON u.tier_id = t.id
  WHERE u.id = user_uuid;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('can_download', FALSE, 'reason', 'User not found');
  END IF;

  -- Get current download counts
  SELECT
    COUNT(*) FILTER (WHERE downloaded_at >= CURRENT_DATE),
    COUNT(*) FILTER (WHERE downloaded_at >= DATE_TRUNC('month', CURRENT_DATE))
  INTO downloads_today, downloads_month
  FROM downloads
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
    'downloads_today', downloads_today,
    'downloads_this_month', downloads_month,
    'daily_limit', user_tier.daily_download_limit,
    'monthly_limit', user_tier.monthly_download_limit
  );
END;
$$;

-- Get user dashboard stats
CREATE OR REPLACE FUNCTION get_user_dashboard_stats(user_uuid UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  stats JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_downloads', COALESCE((SELECT COUNT(*) FROM downloads WHERE user_id = user_uuid), 0),
    'downloads_today', COALESCE((SELECT COUNT(*) FROM downloads WHERE user_id = user_uuid AND downloaded_at >= CURRENT_DATE), 0),
    'downloads_this_month', COALESCE((SELECT COUNT(*) FROM downloads WHERE user_id = user_uuid AND downloaded_at >= DATE_TRUNC('month', CURRENT_DATE)), 0),
    'total_favorites', COALESCE((SELECT COUNT(*) FROM user_favorites WHERE user_id = user_uuid), 0),
    'total_collections', COALESCE((SELECT COUNT(*) FROM collections WHERE user_id = user_uuid), 0),
    'member_since', (SELECT created_at FROM users WHERE id = user_uuid),
    'last_login', (SELECT last_login_at FROM users WHERE id = user_uuid)
  ) INTO stats;

  RETURN stats;
END;
$$;

-- Update user's updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_user_timestamp();

-- Update access_tiers timestamp
CREATE TRIGGER access_tiers_updated_at
  BEFORE UPDATE ON access_tiers
  FOR EACH ROW
  EXECUTE FUNCTION update_user_timestamp();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE access_tiers IS 'Subscription/access tier definitions';
COMMENT ON TABLE design_views IS 'Individual design view tracking';
COMMENT ON TABLE design_view_stats IS 'Aggregated daily view statistics';
COMMENT ON TABLE user_activity IS 'User activity log for dashboard and analytics';
COMMENT ON TABLE subscription_history IS 'History of subscription changes';
COMMENT ON COLUMN users.tier_id IS 'Current subscription tier';
COMMENT ON COLUMN users.tier_expires_at IS 'When the current tier expires (NULL = no expiration)';
COMMENT ON COLUMN users.status IS 'Account status: active, suspended, banned';
COMMENT ON COLUMN designs.access_level IS 'Required tier: free, premium, exclusive';
COMMENT ON FUNCTION can_user_access_design IS 'Check if a user can access a design based on their tier';
COMMENT ON FUNCTION check_user_download_limit IS 'Check if user has remaining downloads';
COMMENT ON FUNCTION get_user_dashboard_stats IS 'Get aggregated stats for user dashboard';
