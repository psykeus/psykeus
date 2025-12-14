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
