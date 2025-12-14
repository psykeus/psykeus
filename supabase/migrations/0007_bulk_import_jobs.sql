-- 0007_bulk_import_jobs.sql
-- Bulk import job tracking for processing 10,000+ files

-- Import Jobs (batch operations)
CREATE TABLE public.import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid REFERENCES public.users(id),

  -- Source configuration
  source_type text NOT NULL CHECK (source_type IN ('folder', 'zip', 'upload')),
  source_path text,
  total_files int NOT NULL DEFAULT 0,

  -- Processing options
  generate_previews boolean DEFAULT true,
  generate_ai_metadata boolean DEFAULT false,
  detect_duplicates boolean DEFAULT true,
  auto_publish boolean DEFAULT false,

  -- Status tracking
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'scanning', 'processing', 'paused', 'completed', 'failed', 'cancelled')),

  -- Progress counters
  files_scanned int DEFAULT 0,
  files_processed int DEFAULT 0,
  files_succeeded int DEFAULT 0,
  files_failed int DEFAULT 0,
  files_skipped int DEFAULT 0,

  -- Timing
  started_at timestamptz,
  completed_at timestamptz,
  estimated_completion timestamptz,

  -- Error handling
  error_message text,
  error_details jsonb,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Detected Projects (groupings found during scan)
CREATE TABLE public.import_detected_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES public.import_jobs(id) ON DELETE CASCADE,

  inferred_name text NOT NULL,
  file_count int NOT NULL,
  detection_reason text, -- 'folder', 'prefix', 'variant', 'manifest', 'layer'
  confidence float DEFAULT 1.0,
  user_confirmed boolean DEFAULT false,
  user_name_override text,
  should_merge boolean DEFAULT true,

  created_at timestamptz DEFAULT now()
);

-- Import Items (individual files within a job)
CREATE TABLE public.import_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES public.import_jobs(id) ON DELETE CASCADE,

  -- File identification
  source_path text NOT NULL,
  filename text NOT NULL,
  file_type text NOT NULL,
  file_size bigint,
  content_hash text,

  -- Project grouping
  detected_project_id uuid REFERENCES public.import_detected_projects(id) ON DELETE SET NULL,
  project_role text CHECK (project_role IN ('primary', 'variant', 'component')),

  -- Processing status
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'skipped', 'duplicate')),

  -- Processing flags
  preview_generated boolean DEFAULT false,
  ai_metadata_generated boolean DEFAULT false,
  ai_metadata_requested boolean DEFAULT false, -- Whether AI was requested for this item

  -- Results
  design_id uuid REFERENCES public.designs(id) ON DELETE SET NULL,
  design_file_id uuid REFERENCES public.design_files(id) ON DELETE SET NULL,
  duplicate_of_design_id uuid REFERENCES public.designs(id) ON DELETE SET NULL,
  near_duplicate_similarity float, -- 0-100 similarity percentage

  -- Error handling
  error_message text,
  retry_count int DEFAULT 0,
  last_retry_at timestamptz,

  -- Timing
  processing_started_at timestamptz,
  processing_completed_at timestamptz,

  created_at timestamptz DEFAULT now()
);

-- Add import tracking to designs table
ALTER TABLE public.designs
  ADD COLUMN IF NOT EXISTS import_job_id uuid REFERENCES public.import_jobs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS import_source_path text;

-- Indexes for performance
CREATE INDEX idx_import_jobs_status ON public.import_jobs(status);
CREATE INDEX idx_import_jobs_user ON public.import_jobs(created_by);
CREATE INDEX idx_import_jobs_created ON public.import_jobs(created_at DESC);

CREATE INDEX idx_import_items_job ON public.import_items(job_id);
CREATE INDEX idx_import_items_status ON public.import_items(job_id, status);
CREATE INDEX idx_import_items_project ON public.import_items(detected_project_id);
CREATE INDEX idx_import_items_hash ON public.import_items(content_hash);
CREATE INDEX idx_import_items_design ON public.import_items(design_id);

CREATE INDEX idx_import_projects_job ON public.import_detected_projects(job_id);

CREATE INDEX idx_designs_import ON public.designs(import_job_id);

-- Trigger to update updated_at on import_jobs
CREATE OR REPLACE FUNCTION update_import_job_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER import_jobs_updated_at
  BEFORE UPDATE ON public.import_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_import_job_updated_at();

-- RLS policies for import tables
ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_detected_projects ENABLE ROW LEVEL SECURITY;

-- Admins can manage import jobs
CREATE POLICY "Admins can manage import jobs"
  ON public.import_jobs
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can manage import items"
  ON public.import_items
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can manage import projects"
  ON public.import_detected_projects
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );
