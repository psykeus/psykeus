-- Stripe Settings Migration
-- Date: 2025-12-14
-- Model: Claude Opus 4.5
-- Purpose: Store Stripe API credentials and app settings securely

-- App settings table for storing configuration (including Stripe keys)
CREATE TABLE IF NOT EXISTS app_settings (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT,
  is_secret BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES users(id)
);

-- RLS: Only service role can access settings
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage settings"
  ON app_settings
  FOR ALL
  USING (auth.role() = 'service_role');

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_app_settings_key ON app_settings(key);

-- Comments
COMMENT ON TABLE app_settings IS 'Application settings including Stripe API keys';
COMMENT ON COLUMN app_settings.key IS 'Setting key (e.g., stripe_secret_key)';
COMMENT ON COLUMN app_settings.value IS 'Setting value (encrypted for secrets)';
COMMENT ON COLUMN app_settings.is_secret IS 'Whether this value should be masked in UI';
