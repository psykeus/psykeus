-- Stripe Payment Integration Migration
-- Date: 2025-12-14
-- Model: Claude Opus 4.5

-- Add Stripe columns to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255) UNIQUE,
ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(50),
ADD COLUMN IF NOT EXISTS subscription_type VARCHAR(20), -- yearly, lifetime
ADD COLUMN IF NOT EXISTS subscription_period_end TIMESTAMPTZ;

-- Add Stripe price IDs to access_tiers table
ALTER TABLE access_tiers
ADD COLUMN IF NOT EXISTS stripe_price_id_yearly VARCHAR(255),
ADD COLUMN IF NOT EXISTS stripe_price_id_lifetime VARCHAR(255);

-- Payment history table for tracking all payments
CREATE TABLE IF NOT EXISTS payment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stripe_payment_intent_id VARCHAR(255),
  stripe_invoice_id VARCHAR(255),
  stripe_checkout_session_id VARCHAR(255),
  amount_cents INTEGER NOT NULL,
  currency VARCHAR(3) DEFAULT 'usd',
  payment_type VARCHAR(20) NOT NULL, -- subscription, one_time
  tier_id UUID REFERENCES access_tiers(id),
  status VARCHAR(50) NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Webhook event log for idempotency (prevent duplicate processing)
CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id VARCHAR(255) NOT NULL UNIQUE,
  event_type VARCHAR(100) NOT NULL,
  processed BOOLEAN DEFAULT FALSE,
  processing_error TEXT,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer ON users(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_users_subscription_status ON users(subscription_status);
CREATE INDEX IF NOT EXISTS idx_payment_history_user ON payment_history(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_history_created ON payment_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stripe_events_event_id ON stripe_webhook_events(stripe_event_id);
CREATE INDEX IF NOT EXISTS idx_stripe_events_processed ON stripe_webhook_events(processed) WHERE NOT processed;

-- RLS policies for payment_history
ALTER TABLE payment_history ENABLE ROW LEVEL SECURITY;

-- Users can only view their own payment history
CREATE POLICY "Users can view own payment history"
  ON payment_history
  FOR SELECT
  USING (auth.uid() = user_id);

-- Only service role can insert/update payment history
CREATE POLICY "Service role can manage payment history"
  ON payment_history
  FOR ALL
  USING (auth.role() = 'service_role');

-- RLS policies for stripe_webhook_events (service role only)
ALTER TABLE stripe_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage webhook events"
  ON stripe_webhook_events
  FOR ALL
  USING (auth.role() = 'service_role');

-- Comment on new columns
COMMENT ON COLUMN users.stripe_customer_id IS 'Stripe customer ID for this user';
COMMENT ON COLUMN users.stripe_subscription_id IS 'Active Stripe subscription ID';
COMMENT ON COLUMN users.subscription_status IS 'Subscription status: active, past_due, canceled, etc.';
COMMENT ON COLUMN users.subscription_type IS 'Type of subscription: yearly or lifetime';
COMMENT ON COLUMN users.subscription_period_end IS 'When the current subscription period ends';

COMMENT ON TABLE payment_history IS 'Record of all Stripe payments made by users';
COMMENT ON TABLE stripe_webhook_events IS 'Log of processed Stripe webhook events for idempotency';
