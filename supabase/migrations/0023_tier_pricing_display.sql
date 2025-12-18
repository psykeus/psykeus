-- Migration: Add lifetime pricing and custom display text fields
-- Allows freeform text for pricing display (e.g., "Included in Lifetime", "$99/year")

-- Add lifetime price column
ALTER TABLE access_tiers
ADD COLUMN IF NOT EXISTS price_lifetime DECIMAL(10,2);

-- Add display text fields for custom pricing display
ALTER TABLE access_tiers
ADD COLUMN IF NOT EXISTS price_yearly_display TEXT,
ADD COLUMN IF NOT EXISTS price_lifetime_display TEXT;

-- Add comments
COMMENT ON COLUMN access_tiers.price_lifetime IS 'Lifetime one-time price (numeric)';
COMMENT ON COLUMN access_tiers.price_yearly_display IS 'Custom display text for yearly price (e.g., "$99/year", "Included in Lifetime")';
COMMENT ON COLUMN access_tiers.price_lifetime_display IS 'Custom display text for lifetime price (e.g., "$299", "One-time payment")';

-- Update existing tiers with default lifetime prices
UPDATE access_tiers
SET price_lifetime = 299.99, price_yearly_display = '$99.99/year', price_lifetime_display = '$299.99'
WHERE slug = 'premium' AND price_lifetime IS NULL;

UPDATE access_tiers
SET price_lifetime = 599.99, price_yearly_display = '$199.99/year', price_lifetime_display = '$599.99'
WHERE slug = 'pro' AND price_lifetime IS NULL;

UPDATE access_tiers
SET price_yearly_display = '$0', price_lifetime_display = '$0'
WHERE slug = 'free' AND price_yearly_display IS NULL;
