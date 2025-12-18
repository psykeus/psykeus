-- Migration: 0025_user_download_history_view
-- Description: Create user_download_history view for download limit checking
-- The check_user_download_limit function references this table, but it was never created.
-- This view aliases the existing downloads table to fix the missing relation error.

-- Create view that aliases downloads table for the download limit function
CREATE OR REPLACE VIEW public.user_download_history AS
SELECT
  id,
  user_id,
  design_id,
  design_file_id,
  downloaded_at,
  ip_address,
  user_agent
FROM public.downloads;

-- Add comment explaining the view
COMMENT ON VIEW public.user_download_history IS 'View aliasing downloads table for download limit checking functions';

-- Enable RLS on the view (inherits from downloads table)
-- Note: Views inherit RLS from their base tables, so no additional policies needed
