-- seed.sql
-- Sample data for development/testing

-- Insert some sample tags
INSERT INTO public.tags (name) VALUES
  ('dragon'),
  ('mandala'),
  ('geometric'),
  ('floral'),
  ('animal'),
  ('holiday'),
  ('christmas'),
  ('halloween'),
  ('mechanical'),
  ('puzzle'),
  ('coaster'),
  ('sign'),
  ('ornament'),
  ('box'),
  ('art')
ON CONFLICT (name) DO NOTHING;

-- Note: To seed sample designs, you'll need to:
-- 1. First upload preview images to the 'previews' bucket
-- 2. Then insert design records with the correct preview_path
-- 3. Upload design files to the 'designs' bucket
-- 4. Insert design_file records with the correct storage_path
-- 5. Update designs.current_version_id to point to the active file

-- Example (commented out - uncomment and modify paths as needed):
/*
-- Insert a sample design
INSERT INTO public.designs (
  slug,
  title,
  description,
  preview_path,
  project_type,
  difficulty,
  materials,
  categories,
  style
) VALUES (
  'dragon-coaster',
  'Dragon Coaster',
  'A beautiful dragon design perfect for coasters. Works great with wood or acrylic.',
  'previews/dragon-coaster.png',
  'coaster',
  'medium',
  ARRAY['wood', 'acrylic'],
  ARRAY['coaster', 'art'],
  'detailed'
) RETURNING id;

-- Insert a design file for it
INSERT INTO public.design_files (
  design_id,
  storage_path,
  file_type,
  size_bytes,
  content_hash,
  version_number,
  is_active
) VALUES (
  '<design_id_from_above>',
  'designs/dragon-coaster-v1.svg',
  'svg',
  45000,
  'sha256hashhere',
  1,
  true
) RETURNING id;

-- Update the design with the current version
UPDATE public.designs
SET current_version_id = '<file_id_from_above>'
WHERE slug = 'dragon-coaster';

-- Link tags to the design
INSERT INTO public.design_tags (design_id, tag_id)
SELECT
  d.id,
  t.id
FROM public.designs d
CROSS JOIN public.tags t
WHERE d.slug = 'dragon-coaster'
AND t.name IN ('dragon', 'coaster', 'art');
*/
