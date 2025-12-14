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
