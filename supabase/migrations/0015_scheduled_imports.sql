-- 0015_scheduled_imports.sql
-- Add scheduling support for import jobs

-- Add scheduling columns to import_jobs table
ALTER TABLE public.import_jobs
  ADD COLUMN IF NOT EXISTS scheduled_start_at timestamptz,
  ADD COLUMN IF NOT EXISTS schedule_type text CHECK (schedule_type IN ('datetime', 'delay'));

-- Index for efficient queries of pending scheduled jobs
CREATE INDEX IF NOT EXISTS idx_import_jobs_scheduled
  ON public.import_jobs(scheduled_start_at)
  WHERE status = 'pending' AND scheduled_start_at IS NOT NULL;

-- Comments for documentation
COMMENT ON COLUMN public.import_jobs.scheduled_start_at IS 'When the job should start processing. If NULL, job starts immediately when started.';
COMMENT ON COLUMN public.import_jobs.schedule_type IS 'How the job was scheduled: datetime (specific time) or delay (relative time from creation)';
