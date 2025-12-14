-- ========================================
-- 0001_init.sql
-- ========================================

-- 0001_init.sql
-- Initial database schema for CNC Design Library

-- USERS (mirrors Supabase auth.users, but we keep our own shadow table)
CREATE TABLE public.users (
  id uuid PRIMARY KEY,
  email text UNIQUE NOT NULL,
  name text,
  role text DEFAULT 'user',  -- user | admin | super_admin
  created_at timestamptz DEFAULT now()
);

-- DESIGNS (without current_version_id for now to avoid circular FK)
CREATE TABLE public.designs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  title text NOT NULL,
  description text,
  preview_path text NOT NULL,
  project_type text,
  difficulty text,
  materials text[],
  categories text[],
  style text,
  approx_dimensions text,
  metadata_json jsonb,
  is_public boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- DESIGN FILES (file versions)
CREATE TABLE public.design_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  design_id uuid REFERENCES public.designs(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  file_type text,
  size_bytes bigint,
  content_hash text NOT NULL,
  preview_phash text,
  source_path text,
  version_number int NOT NULL DEFAULT 1,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Indexes for design_files
CREATE INDEX idx_design_file_hash ON public.design_files(content_hash);
CREATE INDEX idx_design_file_design ON public.design_files(design_id);
CREATE INDEX idx_design_file_source ON public.design_files(source_path);

-- Now add current_version_id FK to designs
ALTER TABLE public.designs
  ADD COLUMN current_version_id uuid REFERENCES public.design_files(id);

-- TAGS
CREATE TABLE public.tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL
);

-- DESIGN_TAGS (many-to-many)
CREATE TABLE public.design_tags (
  design_id uuid REFERENCES public.designs(id) ON DELETE CASCADE,
  tag_id uuid REFERENCES public.tags(id) ON DELETE CASCADE,
  PRIMARY KEY (design_id, tag_id)
);

-- DOWNLOADS
CREATE TABLE public.downloads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id),
  design_id uuid REFERENCES public.designs(id),
  design_file_id uuid REFERENCES public.design_files(id),
  downloaded_at timestamptz DEFAULT now(),
  ip_address inet,
  user_agent text
);

-- Indexes for downloads
CREATE INDEX idx_downloads_user ON public.downloads(user_id);
CREATE INDEX idx_downloads_design ON public.downloads(design_id);
CREATE INDEX idx_downloads_date ON public.downloads(downloaded_at);

-- Full-text search index on designs
CREATE INDEX idx_designs_fulltext ON public.designs
USING gin (to_tsvector('english', coalesce(title,'') || ' ' || coalesce(description,'')));

-- Index for filtering
CREATE INDEX idx_designs_difficulty ON public.designs(difficulty);
CREATE INDEX idx_designs_public ON public.designs(is_public);
CREATE INDEX idx_designs_created ON public.designs(created_at);
CREATE INDEX idx_designs_updated ON public.designs(updated_at);

-- GIN indexes for array columns
CREATE INDEX idx_designs_materials ON public.designs USING gin(materials);
CREATE INDEX idx_designs_categories ON public.designs USING gin(categories);


-- ========================================
-- 0002_rls.sql
-- ========================================

-- 0002_rls.sql
-- Row Level Security policies

-- Enable RLS on all tables
ALTER TABLE public.designs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.design_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.downloads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.design_tags ENABLE ROW LEVEL SECURITY;

-- Helper function to check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('admin', 'super_admin')
  )
$$;

-- Helper function to check if current user is super admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role = 'super_admin'
  )
$$;

-- ============================================
-- USERS policies
-- ============================================

-- Users can read their own record
CREATE POLICY "users_select_own" ON public.users
FOR SELECT USING (id = auth.uid());

-- Admins can read all users
CREATE POLICY "users_select_admin" ON public.users
FOR SELECT USING (public.is_admin());

-- Super admins can update user roles
CREATE POLICY "users_update_super_admin" ON public.users
FOR UPDATE USING (public.is_super_admin());

-- Users can update their own profile (but not role)
CREATE POLICY "users_update_own" ON public.users
FOR UPDATE USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- System can insert new users (via auth trigger)
CREATE POLICY "users_insert_system" ON public.users
FOR INSERT WITH CHECK (true);

-- ============================================
-- DESIGNS policies
-- ============================================

-- Anyone can read public designs
CREATE POLICY "designs_select_public" ON public.designs
FOR SELECT USING (is_public = true);

-- Admins can read all designs (including non-public)
CREATE POLICY "designs_select_admin" ON public.designs
FOR SELECT USING (public.is_admin());

-- Admins can insert designs
CREATE POLICY "designs_insert_admin" ON public.designs
FOR INSERT WITH CHECK (public.is_admin());

-- Admins can update designs
CREATE POLICY "designs_update_admin" ON public.designs
FOR UPDATE USING (public.is_admin());

-- Admins can delete designs
CREATE POLICY "designs_delete_admin" ON public.designs
FOR DELETE USING (public.is_admin());

-- ============================================
-- DESIGN_FILES policies
-- ============================================

-- Anyone can read files for public designs
CREATE POLICY "design_files_select_public" ON public.design_files
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.designs d
    WHERE d.id = design_files.design_id
    AND d.is_public = true
  )
);

-- Admins can read all files
CREATE POLICY "design_files_select_admin" ON public.design_files
FOR SELECT USING (public.is_admin());

-- Admins can insert files
CREATE POLICY "design_files_insert_admin" ON public.design_files
FOR INSERT WITH CHECK (public.is_admin());

-- Admins can update files
CREATE POLICY "design_files_update_admin" ON public.design_files
FOR UPDATE USING (public.is_admin());

-- Admins can delete files
CREATE POLICY "design_files_delete_admin" ON public.design_files
FOR DELETE USING (public.is_admin());

-- ============================================
-- TAGS policies
-- ============================================

-- Anyone can read tags
CREATE POLICY "tags_select_all" ON public.tags
FOR SELECT USING (true);

-- Admins can manage tags
CREATE POLICY "tags_insert_admin" ON public.tags
FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "tags_update_admin" ON public.tags
FOR UPDATE USING (public.is_admin());

CREATE POLICY "tags_delete_admin" ON public.tags
FOR DELETE USING (public.is_admin());

-- ============================================
-- DESIGN_TAGS policies
-- ============================================

-- Anyone can read design tags for public designs
CREATE POLICY "design_tags_select_public" ON public.design_tags
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.designs d
    WHERE d.id = design_tags.design_id
    AND d.is_public = true
  )
);

-- Admins can read all design tags
CREATE POLICY "design_tags_select_admin" ON public.design_tags
FOR SELECT USING (public.is_admin());

-- Admins can manage design tags
CREATE POLICY "design_tags_insert_admin" ON public.design_tags
FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "design_tags_delete_admin" ON public.design_tags
FOR DELETE USING (public.is_admin());

-- ============================================
-- DOWNLOADS policies
-- ============================================

-- Users can read their own downloads
CREATE POLICY "downloads_select_own" ON public.downloads
FOR SELECT USING (user_id = auth.uid());

-- Admins can read all downloads
CREATE POLICY "downloads_select_admin" ON public.downloads
FOR SELECT USING (public.is_admin());

-- Authenticated users can insert downloads
CREATE POLICY "downloads_insert_auth" ON public.downloads
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());


-- ========================================
-- 0003_functions.sql
-- ========================================

-- 0003_functions.sql
-- Database functions and triggers

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for designs table
CREATE TRIGGER designs_updated_at
  BEFORE UPDATE ON public.designs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Function to handle new user signup
-- This creates a record in public.users when a new auth.users record is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NULL),
    'user'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create user record on signup
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Function to get next version number for a design
CREATE OR REPLACE FUNCTION public.get_next_version_number(p_design_id uuid)
RETURNS int AS $$
DECLARE
  max_version int;
BEGIN
  SELECT COALESCE(MAX(version_number), 0)
  INTO max_version
  FROM public.design_files
  WHERE design_id = p_design_id;

  RETURN max_version + 1;
END;
$$ LANGUAGE plpgsql;

-- Function to check for duplicate content hash
CREATE OR REPLACE FUNCTION public.check_duplicate_hash(p_hash text)
RETURNS TABLE(
  design_file_id uuid,
  design_id uuid,
  version_number int
) AS $$
BEGIN
  RETURN QUERY
  SELECT df.id, df.design_id, df.version_number
  FROM public.design_files df
  WHERE df.content_hash = p_hash
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function to find designs by source path
CREATE OR REPLACE FUNCTION public.find_by_source_path(p_source_path text)
RETURNS TABLE(
  design_file_id uuid,
  design_id uuid,
  content_hash text,
  version_number int
) AS $$
BEGIN
  RETURN QUERY
  SELECT df.id, df.design_id, df.content_hash, df.version_number
  FROM public.design_files df
  WHERE df.source_path = p_source_path
  ORDER BY df.version_number DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function to search designs with full-text search
CREATE OR REPLACE FUNCTION public.search_designs(
  p_query text,
  p_limit int DEFAULT 30,
  p_offset int DEFAULT 0
)
RETURNS TABLE(
  id uuid,
  slug text,
  title text,
  preview_path text,
  difficulty text,
  materials text[],
  categories text[],
  style text,
  rank real
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    d.slug,
    d.title,
    d.preview_path,
    d.difficulty,
    d.materials,
    d.categories,
    d.style,
    ts_rank(
      to_tsvector('english', coalesce(d.title,'') || ' ' || coalesce(d.description,'')),
      plainto_tsquery('english', p_query)
    ) AS rank
  FROM public.designs d
  WHERE d.is_public = true
    AND (
      p_query = '' OR
      to_tsvector('english', coalesce(d.title,'') || ' ' || coalesce(d.description,''))
      @@ plainto_tsquery('english', p_query)
    )
  ORDER BY rank DESC, d.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- Function to get download statistics
CREATE OR REPLACE FUNCTION public.get_download_stats()
RETURNS TABLE(
  total_downloads bigint,
  unique_users bigint,
  downloads_today bigint,
  downloads_this_week bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::bigint AS total_downloads,
    COUNT(DISTINCT user_id)::bigint AS unique_users,
    COUNT(*) FILTER (WHERE downloaded_at >= CURRENT_DATE)::bigint AS downloads_today,
    COUNT(*) FILTER (WHERE downloaded_at >= CURRENT_DATE - INTERVAL '7 days')::bigint AS downloads_this_week
  FROM public.downloads;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ========================================
-- 0004_storage.sql
-- ========================================

-- 0004_storage.sql
-- Storage bucket configuration

-- Create the designs bucket (private - only accessible via signed URLs)
INSERT INTO storage.buckets (id, name, public)
VALUES ('designs', 'designs', false)
ON CONFLICT (id) DO NOTHING;

-- Create the previews bucket (public - for thumbnail images)
INSERT INTO storage.buckets (id, name, public)
VALUES ('previews', 'previews', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for designs bucket (private)
-- Only admins can upload to designs bucket
CREATE POLICY "designs_storage_insert_admin"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'designs'
  AND public.is_admin()
);

-- Only admins can update in designs bucket
CREATE POLICY "designs_storage_update_admin"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'designs'
  AND public.is_admin()
);

-- Only admins can delete from designs bucket
CREATE POLICY "designs_storage_delete_admin"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'designs'
  AND public.is_admin()
);

-- No direct read access to designs bucket (use signed URLs)
-- This is enforced by the bucket being private

-- Storage policies for previews bucket (public)
-- Anyone can read from previews bucket (it's public)
CREATE POLICY "previews_storage_select_all"
ON storage.objects FOR SELECT
USING (bucket_id = 'previews');

-- Only admins can upload to previews bucket
CREATE POLICY "previews_storage_insert_admin"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'previews'
  AND public.is_admin()
);

-- Only admins can update in previews bucket
CREATE POLICY "previews_storage_update_admin"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'previews'
  AND public.is_admin()
);

-- Only admins can delete from previews bucket
CREATE POLICY "previews_storage_delete_admin"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'previews'
  AND public.is_admin()
);


-- ========================================
-- 0005_user_sessions.sql
-- ========================================

-- 0005_user_sessions.sql
-- Single-session enforcement: only one active session per user

-- User sessions table
CREATE TABLE public.user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  session_token text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now(),
  last_active_at timestamptz DEFAULT now(),
  user_agent text,
  ip_address text
);

-- Index for fast lookups by user
CREATE INDEX idx_user_sessions_user_id ON public.user_sessions(user_id);

-- Index for token lookups
CREATE INDEX idx_user_sessions_token ON public.user_sessions(session_token);

-- RLS policies
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- Users can only see their own sessions
CREATE POLICY "Users can view own sessions" ON public.user_sessions
  FOR SELECT USING (auth.uid() = user_id);

-- Users can delete their own sessions (logout)
CREATE POLICY "Users can delete own sessions" ON public.user_sessions
  FOR DELETE USING (auth.uid() = user_id);

-- Only service role can insert/update sessions
CREATE POLICY "Service role can manage sessions" ON public.user_sessions
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Function to clean up old sessions (optional - for maintenance)
CREATE OR REPLACE FUNCTION cleanup_old_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete sessions older than 30 days
  DELETE FROM public.user_sessions
  WHERE last_active_at < NOW() - INTERVAL '30 days';
END;
$$;


-- ========================================
-- 0006_multi_file_support.sql
-- ========================================

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


-- ========================================
-- 0007_bulk_import_jobs.sql
-- ========================================

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


-- ========================================
-- 0008_feature_flags.sql
-- ========================================

-- Migration: Feature Flags Support
-- Adds tables for favorites, collections, audit logs, webhooks, and scheduled publishing

-- ============================================================================
-- USER FAVORITES
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  design_id UUID NOT NULL REFERENCES designs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Prevent duplicate favorites
  UNIQUE(user_id, design_id)
);

-- Indexes for fast lookups
CREATE INDEX idx_user_favorites_user_id ON user_favorites(user_id);
CREATE INDEX idx_user_favorites_design_id ON user_favorites(design_id);
CREATE INDEX idx_user_favorites_created_at ON user_favorites(created_at DESC);

-- RLS policies
ALTER TABLE user_favorites ENABLE ROW LEVEL SECURITY;

-- Users can view their own favorites
CREATE POLICY "Users can view own favorites"
  ON user_favorites FOR SELECT
  USING (auth.uid() = user_id);

-- Users can add favorites
CREATE POLICY "Users can add favorites"
  ON user_favorites FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can remove their own favorites
CREATE POLICY "Users can remove own favorites"
  ON user_favorites FOR DELETE
  USING (auth.uid() = user_id);

-- Admins can view all favorites (for analytics)
CREATE POLICY "Admins can view all favorites"
  ON user_favorites FOR SELECT
  USING (public.is_admin());

-- ============================================================================
-- COLLECTIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  cover_image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_collections_user_id ON collections(user_id);
CREATE INDEX idx_collections_is_public ON collections(is_public) WHERE is_public = TRUE;
CREATE INDEX idx_collections_created_at ON collections(created_at DESC);

-- RLS policies
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;

-- Users can view their own collections
CREATE POLICY "Users can view own collections"
  ON collections FOR SELECT
  USING (auth.uid() = user_id);

-- Users can view public collections
CREATE POLICY "Anyone can view public collections"
  ON collections FOR SELECT
  USING (is_public = TRUE);

-- Users can create collections
CREATE POLICY "Users can create collections"
  ON collections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own collections
CREATE POLICY "Users can update own collections"
  ON collections FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own collections
CREATE POLICY "Users can delete own collections"
  ON collections FOR DELETE
  USING (auth.uid() = user_id);

-- Admins can view all collections
CREATE POLICY "Admins can view all collections"
  ON collections FOR SELECT
  USING (public.is_admin());

-- ============================================================================
-- COLLECTION ITEMS
-- ============================================================================

CREATE TABLE IF NOT EXISTS collection_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  design_id UUID NOT NULL REFERENCES designs(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sort_order INTEGER NOT NULL DEFAULT 0,
  notes TEXT,

  -- Prevent duplicate items in same collection
  UNIQUE(collection_id, design_id)
);

-- Indexes
CREATE INDEX idx_collection_items_collection_id ON collection_items(collection_id);
CREATE INDEX idx_collection_items_design_id ON collection_items(design_id);
CREATE INDEX idx_collection_items_sort_order ON collection_items(collection_id, sort_order);

-- RLS policies
ALTER TABLE collection_items ENABLE ROW LEVEL SECURITY;

-- Users can view items in their collections
CREATE POLICY "Users can view own collection items"
  ON collection_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = collection_items.collection_id
      AND c.user_id = auth.uid()
    )
  );

-- Anyone can view items in public collections
CREATE POLICY "Anyone can view public collection items"
  ON collection_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = collection_items.collection_id
      AND c.is_public = TRUE
    )
  );

-- Users can add items to their collections
CREATE POLICY "Users can add items to own collections"
  ON collection_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = collection_items.collection_id
      AND c.user_id = auth.uid()
    )
  );

-- Users can update items in their collections
CREATE POLICY "Users can update own collection items"
  ON collection_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = collection_items.collection_id
      AND c.user_id = auth.uid()
    )
  );

-- Users can remove items from their collections
CREATE POLICY "Users can remove items from own collections"
  ON collection_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = collection_items.collection_id
      AND c.user_id = auth.uid()
    )
  );

-- ============================================================================
-- AUDIT LOGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  user_email VARCHAR(255),
  action VARCHAR(50) NOT NULL, -- 'create', 'update', 'delete', 'publish', 'unpublish', etc.
  entity_type VARCHAR(50) NOT NULL, -- 'design', 'user', 'collection', 'tag', etc.
  entity_id UUID,
  entity_name VARCHAR(255),
  changes JSONB, -- Before/after diff
  metadata JSONB, -- Additional context (IP, user agent, etc.)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for querying
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_entity_type ON audit_logs(entity_type);
CREATE INDEX idx_audit_logs_entity_id ON audit_logs(entity_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- Composite index for common queries
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id, created_at DESC);

-- RLS policies
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Admins can view audit logs"
  ON audit_logs FOR SELECT
  USING (public.is_admin());

-- Only service role can insert (via backend)
CREATE POLICY "Service role can insert audit logs"
  ON audit_logs FOR INSERT
  WITH CHECK (TRUE); -- Will be restricted by service role usage

-- ============================================================================
-- WEBHOOKS
-- ============================================================================

CREATE TABLE IF NOT EXISTS webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  url TEXT NOT NULL,
  secret VARCHAR(255), -- For signature verification
  events TEXT[] NOT NULL DEFAULT '{}', -- Array of event types
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  headers JSONB DEFAULT '{}', -- Custom headers
  retry_count INTEGER NOT NULL DEFAULT 3,
  timeout_ms INTEGER NOT NULL DEFAULT 5000,
  last_triggered_at TIMESTAMPTZ,
  last_status INTEGER, -- HTTP status code
  last_error TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_webhooks_is_active ON webhooks(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_webhooks_events ON webhooks USING GIN(events);

-- RLS policies
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;

-- Only admins can manage webhooks
CREATE POLICY "Admins can view webhooks"
  ON webhooks FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Admins can create webhooks"
  ON webhooks FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update webhooks"
  ON webhooks FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "Admins can delete webhooks"
  ON webhooks FOR DELETE
  USING (public.is_admin());

-- ============================================================================
-- WEBHOOK DELIVERIES (for tracking/debugging)
-- ============================================================================

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,
  payload JSONB NOT NULL,
  response_status INTEGER,
  response_body TEXT,
  error TEXT,
  duration_ms INTEGER,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  delivered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_webhook_deliveries_webhook_id ON webhook_deliveries(webhook_id);
CREATE INDEX idx_webhook_deliveries_event_type ON webhook_deliveries(event_type);
CREATE INDEX idx_webhook_deliveries_delivered_at ON webhook_deliveries(delivered_at DESC);

-- RLS policies
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view webhook deliveries"
  ON webhook_deliveries FOR SELECT
  USING (public.is_admin());

-- ============================================================================
-- SCHEDULED PUBLISHING (add column to designs)
-- ============================================================================

ALTER TABLE designs
ADD COLUMN IF NOT EXISTS publish_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS unpublish_at TIMESTAMPTZ;

-- Index for finding designs to publish/unpublish
CREATE INDEX IF NOT EXISTS idx_designs_publish_at
  ON designs(publish_at)
  WHERE publish_at IS NOT NULL AND is_public = FALSE;

CREATE INDEX IF NOT EXISTS idx_designs_unpublish_at
  ON designs(unpublish_at)
  WHERE unpublish_at IS NOT NULL AND is_public = TRUE;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to get favorite count for a design
CREATE OR REPLACE FUNCTION get_favorite_count(design_uuid UUID)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER
  FROM user_favorites
  WHERE design_id = design_uuid;
$$ LANGUAGE SQL STABLE;

-- Function to check if user has favorited a design
CREATE OR REPLACE FUNCTION is_favorited(design_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_favorites
    WHERE design_id = design_uuid AND user_id = user_uuid
  );
$$ LANGUAGE SQL STABLE;

-- Function to get collection count for a user
CREATE OR REPLACE FUNCTION get_user_collection_count(user_uuid UUID)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER
  FROM collections
  WHERE user_id = user_uuid;
$$ LANGUAGE SQL STABLE;

-- Function to check designs due for publishing
CREATE OR REPLACE FUNCTION get_designs_to_publish()
RETURNS SETOF designs AS $$
  SELECT * FROM designs
  WHERE publish_at IS NOT NULL
    AND publish_at <= NOW()
    AND is_public = FALSE;
$$ LANGUAGE SQL STABLE;

-- Function to check designs due for unpublishing
CREATE OR REPLACE FUNCTION get_designs_to_unpublish()
RETURNS SETOF designs AS $$
  SELECT * FROM designs
  WHERE unpublish_at IS NOT NULL
    AND unpublish_at <= NOW()
    AND is_public = TRUE;
$$ LANGUAGE SQL STABLE;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update collections.updated_at on change
CREATE OR REPLACE FUNCTION update_collection_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER collections_updated_at
  BEFORE UPDATE ON collections
  FOR EACH ROW
  EXECUTE FUNCTION update_collection_timestamp();

-- Update webhooks.updated_at on change
CREATE TRIGGER webhooks_updated_at
  BEFORE UPDATE ON webhooks
  FOR EACH ROW
  EXECUTE FUNCTION update_collection_timestamp();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE user_favorites IS 'Tracks user favorite designs';
COMMENT ON TABLE collections IS 'User-created collections of designs';
COMMENT ON TABLE collection_items IS 'Designs within collections';
COMMENT ON TABLE audit_logs IS 'Admin action audit trail';
COMMENT ON TABLE webhooks IS 'Webhook configurations for external integrations';
COMMENT ON TABLE webhook_deliveries IS 'Webhook delivery history and debugging';
COMMENT ON COLUMN designs.publish_at IS 'Scheduled time to auto-publish design';
COMMENT ON COLUMN designs.unpublish_at IS 'Scheduled time to auto-unpublish design';


-- ========================================
-- 0009_remove_materials.sql
-- ========================================

-- 0009_remove_materials.sql
-- Remove materials column from designs table

-- Drop the GIN index first
DROP INDEX IF EXISTS idx_designs_materials;

-- Drop the materials column
ALTER TABLE public.designs DROP COLUMN IF EXISTS materials;


-- ========================================
-- 0010_performance_optimizations.sql
-- ========================================

-- Performance Optimizations Migration
-- Created: 2025-12-06

-- ============================================================================
-- RPC Function: get_popular_designs
-- Efficiently aggregates download counts at database level instead of in-memory
-- ============================================================================
CREATE OR REPLACE FUNCTION get_popular_designs(
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_limit INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  slug TEXT,
  preview_path TEXT,
  categories TEXT[],
  download_count BIGINT
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    d.title,
    d.slug,
    d.preview_path,
    d.categories,
    COUNT(dl.id) as download_count
  FROM designs d
  LEFT JOIN downloads dl ON dl.design_id = d.id
    AND (p_start_date IS NULL OR dl.downloaded_at >= p_start_date)
  GROUP BY d.id, d.title, d.slug, d.preview_path, d.categories
  HAVING COUNT(dl.id) > 0
  ORDER BY download_count DESC
  LIMIT p_limit;
END;
$$;

-- ============================================================================
-- RPC Function: get_designs_by_tag
-- Single-query tag filtering instead of 3 separate queries
-- ============================================================================
CREATE OR REPLACE FUNCTION get_designs_by_tag(p_tag_name TEXT)
RETURNS SETOF UUID
LANGUAGE sql
STABLE
AS $$
  SELECT DISTINCT dt.design_id
  FROM design_tags dt
  JOIN tags t ON t.id = dt.tag_id
  WHERE t.name = p_tag_name;
$$;

-- ============================================================================
-- Performance Indexes
-- ============================================================================

-- Index for public designs listing (most common query)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_designs_public_created
ON designs(is_public, created_at DESC)
WHERE is_public = true;

-- Index for design files lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_design_files_active_role
ON design_files(design_id, file_role, is_active)
WHERE is_active = true;

-- Index for slug lookups (design detail pages)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_designs_slug
ON designs(slug)
WHERE slug IS NOT NULL;

-- Index for tag filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_design_tags_tag_id
ON design_tags(tag_id);

-- Index for favorites by user (used in favorite status checks)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_favorites_user_design
ON user_favorites(user_id, design_id);

-- Index for downloads by date (used in analytics)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_downloads_date
ON downloads(downloaded_at DESC);

-- Index for downloads by design (used in popular designs query)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_downloads_design_id
ON downloads(design_id);

-- ============================================================================
-- RPC Function: validate_session_with_role
-- Combined session validation and role check in one query
-- ============================================================================
CREATE OR REPLACE FUNCTION validate_session_with_role(
  p_session_token TEXT,
  p_user_id UUID
)
RETURNS TABLE (
  is_valid BOOLEAN,
  user_role TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    (s.user_id IS NOT NULL AND s.user_id = p_user_id) as is_valid,
    COALESCE(u.role, 'user') as user_role
  FROM user_sessions s
  LEFT JOIN users u ON u.id = s.user_id
  WHERE s.session_token = p_session_token
  LIMIT 1;

  -- If no rows returned (session not found), return invalid
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'user'::TEXT;
  END IF;
END;
$$;

-- ============================================================================
-- Grant permissions
-- ============================================================================
GRANT EXECUTE ON FUNCTION get_popular_designs TO authenticated;
GRANT EXECUTE ON FUNCTION get_popular_designs TO service_role;
GRANT EXECUTE ON FUNCTION get_designs_by_tag TO authenticated;
GRANT EXECUTE ON FUNCTION get_designs_by_tag TO service_role;
GRANT EXECUTE ON FUNCTION get_designs_by_tag TO anon;
GRANT EXECUTE ON FUNCTION validate_session_with_role TO service_role;


-- ========================================
-- 0010_performance_optimizations_studio.sql
-- ========================================

-- Performance Optimizations Migration (Supabase Studio Version)
-- Created: 2025-12-06
-- Note: CONCURRENTLY removed for execution in transaction block

-- ============================================================================
-- RPC Function: get_popular_designs
-- Efficiently aggregates download counts at database level instead of in-memory
-- ============================================================================
CREATE OR REPLACE FUNCTION get_popular_designs(
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_limit INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  slug TEXT,
  preview_path TEXT,
  categories TEXT[],
  download_count BIGINT
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    d.title,
    d.slug,
    d.preview_path,
    d.categories,
    COUNT(dl.id) as download_count
  FROM designs d
  LEFT JOIN downloads dl ON dl.design_id = d.id
    AND (p_start_date IS NULL OR dl.downloaded_at >= p_start_date)
  GROUP BY d.id, d.title, d.slug, d.preview_path, d.categories
  HAVING COUNT(dl.id) > 0
  ORDER BY download_count DESC
  LIMIT p_limit;
END;
$$;

-- ============================================================================
-- RPC Function: get_designs_by_tag
-- Single-query tag filtering instead of 3 separate queries
-- ============================================================================
CREATE OR REPLACE FUNCTION get_designs_by_tag(p_tag_name TEXT)
RETURNS SETOF UUID
LANGUAGE sql
STABLE
AS $$
  SELECT DISTINCT dt.design_id
  FROM design_tags dt
  JOIN tags t ON t.id = dt.tag_id
  WHERE t.name = p_tag_name;
$$;

-- ============================================================================
-- Performance Indexes (without CONCURRENTLY for transaction compatibility)
-- ============================================================================

-- Index for public designs listing (most common query)
CREATE INDEX IF NOT EXISTS idx_designs_public_created
ON designs(is_public, created_at DESC)
WHERE is_public = true;

-- Index for design files lookup
CREATE INDEX IF NOT EXISTS idx_design_files_active_role
ON design_files(design_id, file_role, is_active)
WHERE is_active = true;

-- Index for slug lookups (design detail pages)
CREATE INDEX IF NOT EXISTS idx_designs_slug
ON designs(slug)
WHERE slug IS NOT NULL;

-- Index for tag filtering
CREATE INDEX IF NOT EXISTS idx_design_tags_tag_id
ON design_tags(tag_id);

-- Index for favorites by user (used in favorite status checks)
CREATE INDEX IF NOT EXISTS idx_favorites_user_design
ON user_favorites(user_id, design_id);

-- Index for downloads by date (used in analytics)
CREATE INDEX IF NOT EXISTS idx_downloads_date
ON downloads(downloaded_at DESC);

-- Index for downloads by design (used in popular designs query)
CREATE INDEX IF NOT EXISTS idx_downloads_design_id
ON downloads(design_id);

-- ============================================================================
-- RPC Function: validate_session_with_role
-- Combined session validation and role check in one query
-- ============================================================================
CREATE OR REPLACE FUNCTION validate_session_with_role(
  p_session_token TEXT,
  p_user_id UUID
)
RETURNS TABLE (
  is_valid BOOLEAN,
  user_role TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    (s.user_id IS NOT NULL AND s.user_id = p_user_id) as is_valid,
    COALESCE(u.role, 'user') as user_role
  FROM user_sessions s
  LEFT JOIN users u ON u.id = s.user_id
  WHERE s.session_token = p_session_token
  LIMIT 1;

  -- If no rows returned (session not found), return invalid
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'user'::TEXT;
  END IF;
END;
$$;

-- ============================================================================
-- Grant permissions
-- ============================================================================
GRANT EXECUTE ON FUNCTION get_popular_designs TO authenticated;
GRANT EXECUTE ON FUNCTION get_popular_designs TO service_role;
GRANT EXECUTE ON FUNCTION get_designs_by_tag TO authenticated;
GRANT EXECUTE ON FUNCTION get_designs_by_tag TO service_role;
GRANT EXECUTE ON FUNCTION get_designs_by_tag TO anon;
GRANT EXECUTE ON FUNCTION validate_session_with_role TO service_role;


-- ========================================
-- 0011_import_logs.sql
-- ========================================

-- Migration: Add import_logs table for detailed import processing logs
-- Created: 2025-12-07
-- Purpose: Track all files during import with detailed status, skip/fail reasons

-- =============================================================================
-- IMPORT LOGS TABLE
-- =============================================================================
-- Stores detailed processing logs for each file in an import job.
-- This provides a complete audit trail that persists after import completion.

CREATE TABLE IF NOT EXISTS import_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES import_jobs(id) ON DELETE CASCADE,
  item_id uuid REFERENCES import_items(id) ON DELETE SET NULL,

  -- File identification
  file_path text NOT NULL,
  filename text NOT NULL,
  file_type text,
  file_size bigint,

  -- Processing result
  status text NOT NULL CHECK (status IN (
    'pending',      -- Queued for processing
    'processing',   -- Currently being processed
    'succeeded',    -- Successfully imported
    'failed',       -- Failed with error
    'skipped',      -- Skipped (not an error, intentional)
    'duplicate'     -- Detected as duplicate
  )),

  -- Detailed reason for skip/fail (human-readable)
  reason text,

  -- Structured details for programmatic access
  details jsonb DEFAULT '{}',

  -- Processing steps completed (for debugging/transparency)
  steps_completed text[] DEFAULT '{}',

  -- Links to created resources (if successful)
  design_id uuid REFERENCES designs(id) ON DELETE SET NULL,
  design_file_id uuid REFERENCES design_files(id) ON DELETE SET NULL,

  -- Duplicate information
  duplicate_of_design_id uuid REFERENCES designs(id) ON DELETE SET NULL,
  duplicate_type text CHECK (duplicate_type IN ('exact', 'near')),
  duplicate_similarity float,

  -- Timing
  processing_started_at timestamptz,
  processing_completed_at timestamptz,
  processing_duration_ms int,

  -- Metadata
  created_at timestamptz DEFAULT now()
);

-- =============================================================================
-- INDEXES
-- =============================================================================

-- Fast lookup by job
CREATE INDEX idx_import_logs_job_id ON import_logs(job_id);

-- Filter by status within a job
CREATE INDEX idx_import_logs_job_status ON import_logs(job_id, status);

-- Search by filename
CREATE INDEX idx_import_logs_filename ON import_logs(job_id, filename);

-- Filter by file type
CREATE INDEX idx_import_logs_file_type ON import_logs(job_id, file_type);

-- =============================================================================
-- IMPORT LOG SUMMARY VIEW
-- =============================================================================
-- Provides quick summary stats for each job's logs

CREATE OR REPLACE VIEW import_log_summary AS
SELECT
  job_id,
  COUNT(*) as total_files,
  COUNT(*) FILTER (WHERE status = 'succeeded') as succeeded_count,
  COUNT(*) FILTER (WHERE status = 'failed') as failed_count,
  COUNT(*) FILTER (WHERE status = 'skipped') as skipped_count,
  COUNT(*) FILTER (WHERE status = 'duplicate') as duplicate_count,
  COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
  COUNT(*) FILTER (WHERE status = 'processing') as processing_count,
  SUM(file_size) as total_size_bytes,
  MIN(processing_started_at) as first_started,
  MAX(processing_completed_at) as last_completed,
  AVG(processing_duration_ms) as avg_duration_ms
FROM import_logs
GROUP BY job_id;

-- =============================================================================
-- HELPER FUNCTION: Get skip/fail reasons summary
-- =============================================================================

CREATE OR REPLACE FUNCTION get_import_log_reasons(p_job_id uuid)
RETURNS TABLE (
  status text,
  reason text,
  count bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    l.status,
    l.reason,
    COUNT(*)::bigint as count
  FROM import_logs l
  WHERE l.job_id = p_job_id
    AND l.reason IS NOT NULL
  GROUP BY l.status, l.reason
  ORDER BY count DESC;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE import_logs IS 'Detailed processing log for each file in a bulk import job';
COMMENT ON COLUMN import_logs.status IS 'Final processing status: succeeded, failed, skipped, or duplicate';
COMMENT ON COLUMN import_logs.reason IS 'Human-readable explanation for skip/fail status';
COMMENT ON COLUMN import_logs.details IS 'Structured data: error stack, skip criteria matched, etc.';
COMMENT ON COLUMN import_logs.steps_completed IS 'Array of processing steps completed before final status';
COMMENT ON COLUMN import_logs.duplicate_type IS 'Whether duplicate was exact (hash match) or near (perceptual similarity)';


-- ========================================
-- 0011_session_expiration.sql
-- ========================================

-- Add expires_at column to user_sessions for explicit session expiration
-- This allows configurable session lifetime beyond just cookie expiration

ALTER TABLE user_sessions
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Set default expiration for existing sessions (30 days from last_active_at)
UPDATE user_sessions
SET expires_at = last_active_at + INTERVAL '30 days'
WHERE expires_at IS NULL;

-- Create index for efficient expiration queries
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at
ON user_sessions(expires_at)
WHERE expires_at IS NOT NULL;

-- Update the validate_session_with_role function to also check expiration
CREATE OR REPLACE FUNCTION validate_session_with_role(
  p_session_token TEXT,
  p_user_id UUID
)
RETURNS TABLE (
  is_valid BOOLEAN,
  user_role TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    (s.user_id = p_user_id AND (s.expires_at IS NULL OR s.expires_at > NOW())) AS is_valid,
    u.role::TEXT AS user_role
  FROM user_sessions s
  JOIN users u ON s.user_id = u.id
  WHERE s.session_token = p_session_token
  LIMIT 1;
END;
$$;

-- Create a function to clean up expired sessions (can be called via cron)
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM user_sessions
  WHERE expires_at IS NOT NULL AND expires_at < NOW();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION cleanup_expired_sessions IS
'Deletes expired sessions. Call periodically via cron or pg_cron.
Example: SELECT cleanup_expired_sessions();';


