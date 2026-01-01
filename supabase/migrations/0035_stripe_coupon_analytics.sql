-- Migration: 0035_stripe_coupon_analytics.sql
-- Purpose: Add coupon tracking columns to payment_history for analytics
-- Created: 2025-01-01
-- AI Model: Claude Opus 4.5 (claude-opus-4-5-20251101)
--
-- This migration adds columns to track coupon/promo code usage during checkout,
-- enabling analytics on discount redemptions, revenue impact, and code effectiveness.

-- ============================================================================
-- ADD COUPON TRACKING COLUMNS TO payment_history
-- ============================================================================

-- Add coupon code (the user-facing promo code like "SAVE20")
ALTER TABLE payment_history
ADD COLUMN IF NOT EXISTS coupon_code VARCHAR(100);

-- Add coupon ID (Stripe's internal coupon ID)
ALTER TABLE payment_history
ADD COLUMN IF NOT EXISTS coupon_id VARCHAR(100);

-- Add discount amount in cents (actual discount applied)
ALTER TABLE payment_history
ADD COLUMN IF NOT EXISTS discount_amount_cents INTEGER DEFAULT 0;

-- Add discount percentage (if percent-based coupon, e.g., 20.00 for 20%)
ALTER TABLE payment_history
ADD COLUMN IF NOT EXISTS discount_percentage DECIMAL(5,2);

-- ============================================================================
-- ADD INDEXES FOR ANALYTICS QUERIES
-- ============================================================================

-- Index for querying payments by coupon code
CREATE INDEX IF NOT EXISTS idx_payment_history_coupon_code
  ON payment_history(coupon_code)
  WHERE coupon_code IS NOT NULL;

-- Index for querying payments by coupon ID
CREATE INDEX IF NOT EXISTS idx_payment_history_coupon_id
  ON payment_history(coupon_id)
  WHERE coupon_id IS NOT NULL;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON COLUMN payment_history.coupon_code IS
'User-facing promo code used at checkout (e.g., SAVE20, LAUNCH50)';

COMMENT ON COLUMN payment_history.coupon_id IS
'Stripe coupon ID that was applied to this payment';

COMMENT ON COLUMN payment_history.discount_amount_cents IS
'Total discount amount in cents applied to this payment';

COMMENT ON COLUMN payment_history.discount_percentage IS
'Discount percentage if percent-based coupon (e.g., 20.00 for 20% off)';
