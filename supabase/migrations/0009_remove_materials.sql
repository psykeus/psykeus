-- 0009_remove_materials.sql
-- Remove materials column from designs table

-- Drop the GIN index first
DROP INDEX IF EXISTS idx_designs_materials;

-- Drop the materials column
ALTER TABLE public.designs DROP COLUMN IF EXISTS materials;
