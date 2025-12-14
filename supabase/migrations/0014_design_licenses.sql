-- Migration: Add license tracking to designs
-- Date: 2024-12-11
-- Description: Adds license_type and license_notes fields to track copyright/usage rights per design

-- Create enum type for license types
DO $$ BEGIN
    CREATE TYPE design_license_type AS ENUM (
        'unknown',        -- License not confirmed, use at own risk
        'public_domain',  -- No copyright, free for any use
        'cc0',           -- Creative Commons Zero (no rights reserved)
        'cc_by',         -- Creative Commons Attribution (credit required)
        'cc_by_sa',      -- Creative Commons Attribution-ShareAlike
        'cc_by_nc',      -- Creative Commons Non-Commercial
        'cc_by_nc_sa',   -- Creative Commons Non-Commercial ShareAlike
        'personal_only', -- Personal/non-commercial use only
        'custom'         -- Custom license, see license_notes
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add license fields to designs table
ALTER TABLE designs
ADD COLUMN IF NOT EXISTS license_type design_license_type DEFAULT 'unknown',
ADD COLUMN IF NOT EXISTS license_notes text,
ADD COLUMN IF NOT EXISTS license_url text,
ADD COLUMN IF NOT EXISTS attribution_required boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS commercial_use_allowed boolean,
ADD COLUMN IF NOT EXISTS modification_allowed boolean DEFAULT true;

-- Add index for filtering by license type
CREATE INDEX IF NOT EXISTS idx_designs_license_type ON designs(license_type);

-- Add comment explaining the fields
COMMENT ON COLUMN designs.license_type IS 'The license type for this design (unknown if not verified)';
COMMENT ON COLUMN designs.license_notes IS 'Additional notes about the license or attribution requirements';
COMMENT ON COLUMN designs.license_url IS 'URL to the full license text if applicable';
COMMENT ON COLUMN designs.attribution_required IS 'Whether attribution is required when using this design';
COMMENT ON COLUMN designs.commercial_use_allowed IS 'Whether commercial use is allowed (null = unknown)';
COMMENT ON COLUMN designs.modification_allowed IS 'Whether modifications are allowed';

-- Update existing designs to have unknown license (already default, but be explicit)
UPDATE designs SET license_type = 'unknown' WHERE license_type IS NULL;
