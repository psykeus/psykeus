-- 0006_multi_file_support.sql
-- Add support for multiple files per design (format variants and project components)

-- Add new columns to design_files for multi-file support
ALTER TABLE public.design_files
  ADD COLUMN IF NOT EXISTS file_role TEXT DEFAULT 'primary',
  ADD COLUMN IF NOT EXISTS file_group TEXT,
  ADD COLUMN IF NOT EXISTS original_filename TEXT,
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS file_description TEXT,
  ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- Add primary_file_id to designs (for preview/AI analysis)
ALTER TABLE public.designs
  ADD COLUMN IF NOT EXISTS primary_file_id UUID REFERENCES public.design_files(id);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_design_files_role ON public.design_files(design_id, file_role);
CREATE INDEX IF NOT EXISTS idx_design_files_sort ON public.design_files(design_id, sort_order);

-- Add constraint to ensure valid file_role values
ALTER TABLE public.design_files
  ADD CONSTRAINT chk_file_role CHECK (file_role IN ('primary', 'variant', 'component'));

-- Migrate existing data: set all existing files as primary
UPDATE public.design_files
SET
  file_role = 'primary',
  file_group = 'main',
  sort_order = 0
WHERE file_role IS NULL OR file_role = 'primary';

-- Set primary_file_id on designs to match current_version_id
UPDATE public.designs d
SET primary_file_id = d.current_version_id
WHERE d.current_version_id IS NOT NULL
  AND d.primary_file_id IS NULL;

-- Comment on columns for documentation
COMMENT ON COLUMN public.design_files.file_role IS 'primary=main file for preview/AI, variant=same content different format, component=related files';
COMMENT ON COLUMN public.design_files.file_group IS 'Groups related files together (e.g., main, assembly, cutting)';
COMMENT ON COLUMN public.design_files.original_filename IS 'Original filename as uploaded';
COMMENT ON COLUMN public.design_files.display_name IS 'User-friendly display name for UI';
COMMENT ON COLUMN public.design_files.file_description IS 'Optional description of this specific file';
COMMENT ON COLUMN public.design_files.sort_order IS 'Order in file list display';
COMMENT ON COLUMN public.designs.primary_file_id IS 'Primary file for preview generation and AI metadata';
