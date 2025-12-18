-- Migration: Tier Features for Pricing Display
-- Purpose: Store custom marketing features for each pricing tier
-- Also adds display settings to access_tiers

-- ============================================================================
-- TIER FEATURES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS tier_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_id UUID NOT NULL REFERENCES access_tiers(id) ON DELETE CASCADE,
  feature_text VARCHAR(255) NOT NULL,
  icon VARCHAR(50),  -- Optional icon identifier (e.g., "check", "star", "shield")
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_highlighted BOOLEAN NOT NULL DEFAULT FALSE,  -- For emphasizing key features
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for tier_features
CREATE INDEX IF NOT EXISTS idx_tier_features_tier ON tier_features(tier_id);
CREATE INDEX IF NOT EXISTS idx_tier_features_sort ON tier_features(tier_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_tier_features_active ON tier_features(tier_id, is_active);

-- ============================================================================
-- ENHANCE ACCESS_TIERS TABLE
-- ============================================================================

-- Add visibility and display columns to access_tiers
ALTER TABLE access_tiers
ADD COLUMN IF NOT EXISTS show_on_pricing BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS highlight_label VARCHAR(50),  -- e.g., "Most Popular", "Best Value"
ADD COLUMN IF NOT EXISTS cta_text VARCHAR(100) DEFAULT 'Get Started';  -- Button text

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update trigger for tier_features updated_at
CREATE TRIGGER tier_features_updated_at
  BEFORE UPDATE ON tier_features
  FOR EACH ROW
  EXECUTE FUNCTION update_user_timestamp();

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE tier_features ENABLE ROW LEVEL SECURITY;

-- Anyone can view active tier features (for pricing page)
CREATE POLICY "Anyone can view active tier features"
  ON tier_features FOR SELECT
  USING (is_active = TRUE);

-- Admins can manage all tier features
CREATE POLICY "Admins can manage tier features"
  ON tier_features FOR ALL
  USING (public.is_admin());

-- ============================================================================
-- SEED DEFAULT FEATURES FOR EXISTING TIERS
-- ============================================================================

-- Free tier features
INSERT INTO tier_features (tier_id, feature_text, icon, sort_order, is_highlighted)
SELECT id, '5 downloads per day', 'download', 0, FALSE
FROM access_tiers WHERE slug = 'free'
ON CONFLICT DO NOTHING;

INSERT INTO tier_features (tier_id, feature_text, icon, sort_order, is_highlighted)
SELECT id, '50 downloads per month', 'calendar', 1, FALSE
FROM access_tiers WHERE slug = 'free'
ON CONFLICT DO NOTHING;

INSERT INTO tier_features (tier_id, feature_text, icon, sort_order, is_highlighted)
SELECT id, 'Access to free designs', 'check', 2, FALSE
FROM access_tiers WHERE slug = 'free'
ON CONFLICT DO NOTHING;

INSERT INTO tier_features (tier_id, feature_text, icon, sort_order, is_highlighted)
SELECT id, 'Up to 10 collections', 'folder', 3, FALSE
FROM access_tiers WHERE slug = 'free'
ON CONFLICT DO NOTHING;

INSERT INTO tier_features (tier_id, feature_text, icon, sort_order, is_highlighted)
SELECT id, 'Up to 100 favorites', 'heart', 4, FALSE
FROM access_tiers WHERE slug = 'free'
ON CONFLICT DO NOTHING;

-- Premium tier features
INSERT INTO tier_features (tier_id, feature_text, icon, sort_order, is_highlighted)
SELECT id, 'Unlimited downloads', 'infinity', 0, TRUE
FROM access_tiers WHERE slug = 'premium'
ON CONFLICT DO NOTHING;

INSERT INTO tier_features (tier_id, feature_text, icon, sort_order, is_highlighted)
SELECT id, 'Access to Premium designs', 'star', 1, TRUE
FROM access_tiers WHERE slug = 'premium'
ON CONFLICT DO NOTHING;

INSERT INTO tier_features (tier_id, feature_text, icon, sort_order, is_highlighted)
SELECT id, 'Unlimited collections', 'folder', 2, FALSE
FROM access_tiers WHERE slug = 'premium'
ON CONFLICT DO NOTHING;

INSERT INTO tier_features (tier_id, feature_text, icon, sort_order, is_highlighted)
SELECT id, 'Unlimited favorites', 'heart', 3, FALSE
FROM access_tiers WHERE slug = 'premium'
ON CONFLICT DO NOTHING;

INSERT INTO tier_features (tier_id, feature_text, icon, sort_order, is_highlighted)
SELECT id, 'Priority support', 'headphones', 4, FALSE
FROM access_tiers WHERE slug = 'premium'
ON CONFLICT DO NOTHING;

-- Pro tier features
INSERT INTO tier_features (tier_id, feature_text, icon, sort_order, is_highlighted)
SELECT id, 'Unlimited downloads', 'infinity', 0, TRUE
FROM access_tiers WHERE slug = 'pro'
ON CONFLICT DO NOTHING;

INSERT INTO tier_features (tier_id, feature_text, icon, sort_order, is_highlighted)
SELECT id, 'Access to ALL designs', 'crown', 1, TRUE
FROM access_tiers WHERE slug = 'pro'
ON CONFLICT DO NOTHING;

INSERT INTO tier_features (tier_id, feature_text, icon, sort_order, is_highlighted)
SELECT id, 'Exclusive designs access', 'sparkles', 2, TRUE
FROM access_tiers WHERE slug = 'pro'
ON CONFLICT DO NOTHING;

INSERT INTO tier_features (tier_id, feature_text, icon, sort_order, is_highlighted)
SELECT id, 'Unlimited collections', 'folder', 3, FALSE
FROM access_tiers WHERE slug = 'pro'
ON CONFLICT DO NOTHING;

INSERT INTO tier_features (tier_id, feature_text, icon, sort_order, is_highlighted)
SELECT id, 'Unlimited favorites', 'heart', 4, FALSE
FROM access_tiers WHERE slug = 'pro'
ON CONFLICT DO NOTHING;

INSERT INTO tier_features (tier_id, feature_text, icon, sort_order, is_highlighted)
SELECT id, 'Priority support', 'headphones', 5, FALSE
FROM access_tiers WHERE slug = 'pro'
ON CONFLICT DO NOTHING;

INSERT INTO tier_features (tier_id, feature_text, icon, sort_order, is_highlighted)
SELECT id, 'Early access to new designs', 'clock', 6, FALSE
FROM access_tiers WHERE slug = 'pro'
ON CONFLICT DO NOTHING;

-- Update highlight labels for existing tiers
UPDATE access_tiers SET highlight_label = 'Most Popular' WHERE slug = 'premium';

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE tier_features IS 'Custom display features for pricing tiers';
COMMENT ON COLUMN tier_features.feature_text IS 'The text displayed in the feature list';
COMMENT ON COLUMN tier_features.icon IS 'Optional icon name for the feature (e.g., check, star, crown)';
COMMENT ON COLUMN tier_features.is_highlighted IS 'Whether to visually emphasize this feature';
COMMENT ON COLUMN access_tiers.show_on_pricing IS 'Whether to display this tier on the public pricing page';
COMMENT ON COLUMN access_tiers.highlight_label IS 'Badge text like "Most Popular" shown on pricing card';
COMMENT ON COLUMN access_tiers.cta_text IS 'Call-to-action button text';
