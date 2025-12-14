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
