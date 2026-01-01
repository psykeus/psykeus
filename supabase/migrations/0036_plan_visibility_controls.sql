-- Migration: Plan Visibility Controls
-- Date: 2025-12-31
-- Model: Claude Opus 4.5
-- Purpose: Add ability to show/hide Lifetime, Annual, and Monthly plans per tier

-- ============================================================================
-- ADD MONTHLY PRICE SUPPORT
-- ============================================================================

-- Add monthly price ID column to access_tiers
ALTER TABLE access_tiers
ADD COLUMN IF NOT EXISTS stripe_price_id_monthly VARCHAR(255);

-- ============================================================================
-- ADD PLAN VISIBILITY FLAGS
-- ============================================================================

-- Add visibility control columns for each plan type
-- These control whether the plan type is shown on the pricing page
ALTER TABLE access_tiers
ADD COLUMN IF NOT EXISTS show_monthly_plan BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS show_annual_plan BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS show_lifetime_plan BOOLEAN NOT NULL DEFAULT TRUE;

-- ============================================================================
-- ADD MONTHLY PRICE DISPLAY TEXT
-- ============================================================================

-- Add display text for monthly pricing (matches existing yearly/lifetime pattern)
ALTER TABLE access_tiers
ADD COLUMN IF NOT EXISTS price_monthly_display TEXT;

-- ============================================================================
-- UPDATE USERS TABLE FOR MONTHLY SUBSCRIPTIONS
-- ============================================================================

-- Update subscription_type to allow 'monthly' value
-- (subscription_type already allows varchar(20), so 'monthly' is valid)
-- Just add a comment for clarity
COMMENT ON COLUMN users.subscription_type IS 'Subscription billing interval: monthly, yearly, or lifetime';

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Index for filtering by plan visibility (useful for pricing page queries)
CREATE INDEX IF NOT EXISTS idx_access_tiers_plan_visibility
  ON access_tiers(show_on_pricing, show_monthly_plan, show_annual_plan, show_lifetime_plan)
  WHERE is_active = TRUE;
