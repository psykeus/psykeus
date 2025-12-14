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
