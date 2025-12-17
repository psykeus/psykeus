-- =============================================================================
-- SUPABASE SECURITY & PERFORMANCE FIXES
-- Run this file in Supabase SQL Editor
-- Date: 2025-12-16
-- =============================================================================

-- =============================================================================
-- SECTION 1: DROP FUNCTIONS WITH RETURN TYPE CONFLICTS (no dependencies)
-- Only dropping functions that have no dependent triggers/policies
-- =============================================================================

-- get_import_log_reasons has different return type, must DROP first (no dependents)
DROP FUNCTION IF EXISTS public.get_import_log_reasons(uuid);

-- =============================================================================
-- SECTION 1b: NOTES
-- We use CREATE OR REPLACE for all other functions.
-- Since we're only adding "SET search_path = ''" without changing return types,
-- CREATE OR REPLACE will successfully update all existing functions.
-- This avoids breaking triggers and policies that depend on these functions.
-- =============================================================================

-- =============================================================================
-- SECTION 2: RECREATE ALL FUNCTIONS WITH search_path = ''
-- =============================================================================

-- is_admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = (SELECT auth.uid())
    AND role IN ('admin', 'super_admin')
  )
$$;

-- is_super_admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = (SELECT auth.uid())
    AND role = 'super_admin'
  )
$$;

-- update_updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
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
$$;

-- get_next_version_number
CREATE OR REPLACE FUNCTION public.get_next_version_number(p_design_id uuid)
RETURNS int
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  max_version int;
BEGIN
  SELECT COALESCE(MAX(version_number), 0)
  INTO max_version
  FROM public.design_files
  WHERE design_id = p_design_id;
  RETURN max_version + 1;
END;
$$;

-- check_duplicate_hash
CREATE OR REPLACE FUNCTION public.check_duplicate_hash(p_hash text)
RETURNS TABLE(design_file_id uuid, design_id uuid, version_number int)
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT df.id, df.design_id, df.version_number
  FROM public.design_files df
  WHERE df.content_hash = p_hash
  LIMIT 1;
END;
$$;

-- find_by_source_path
CREATE OR REPLACE FUNCTION public.find_by_source_path(p_source_path text)
RETURNS TABLE(design_file_id uuid, design_id uuid, content_hash text, version_number int)
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT df.id, df.design_id, df.content_hash, df.version_number
  FROM public.design_files df
  WHERE df.source_path = p_source_path
  ORDER BY df.version_number DESC
  LIMIT 1;
END;
$$;

-- search_designs
CREATE OR REPLACE FUNCTION public.search_designs(
  p_query text,
  p_limit int DEFAULT 30,
  p_offset int DEFAULT 0
)
RETURNS TABLE(id uuid, slug text, title text, preview_path text, difficulty text, materials text[], categories text[], style text, rank real)
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id, d.slug, d.title, d.preview_path, d.difficulty, d.materials, d.categories, d.style,
    ts_rank(
      to_tsvector('english', coalesce(d.title,'') || ' ' || coalesce(d.description,'')),
      plainto_tsquery('english', p_query)
    ) AS rank
  FROM public.designs d
  WHERE d.is_public = true
    AND (p_query = '' OR to_tsvector('english', coalesce(d.title,'') || ' ' || coalesce(d.description,'')) @@ plainto_tsquery('english', p_query))
  ORDER BY rank DESC, d.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

-- get_download_stats
CREATE OR REPLACE FUNCTION public.get_download_stats()
RETURNS TABLE(total_downloads bigint, unique_users bigint, downloads_today bigint, downloads_this_week bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::bigint,
    COUNT(DISTINCT user_id)::bigint,
    COUNT(*) FILTER (WHERE downloaded_at >= CURRENT_DATE)::bigint,
    COUNT(*) FILTER (WHERE downloaded_at >= CURRENT_DATE - INTERVAL '7 days')::bigint
  FROM public.downloads;
END;
$$;

-- get_popular_designs
CREATE OR REPLACE FUNCTION public.get_popular_designs(
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_limit INT DEFAULT 10
)
RETURNS TABLE (id UUID, title TEXT, slug TEXT, preview_path TEXT, categories TEXT[], download_count BIGINT)
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT d.id, d.title, d.slug, d.preview_path, d.categories, COUNT(dl.id) as download_count
  FROM public.designs d
  LEFT JOIN public.downloads dl ON dl.design_id = d.id AND (p_start_date IS NULL OR dl.downloaded_at >= p_start_date)
  GROUP BY d.id, d.title, d.slug, d.preview_path, d.categories
  HAVING COUNT(dl.id) > 0
  ORDER BY download_count DESC
  LIMIT p_limit;
END;
$$;

-- get_designs_by_tag
CREATE OR REPLACE FUNCTION public.get_designs_by_tag(p_tag_name TEXT)
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT DISTINCT dt.design_id
  FROM public.design_tags dt
  JOIN public.tags t ON t.id = dt.tag_id
  WHERE t.name = p_tag_name;
$$;

-- validate_session_with_role
CREATE OR REPLACE FUNCTION public.validate_session_with_role(p_session_token TEXT, p_user_id UUID)
RETURNS TABLE (is_valid BOOLEAN, user_role TEXT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT (s.user_id IS NOT NULL AND s.user_id = p_user_id), COALESCE(u.role, 'user')
  FROM public.user_sessions s
  LEFT JOIN public.users u ON u.id = s.user_id
  WHERE s.session_token = p_session_token
  LIMIT 1;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'user'::TEXT;
  END IF;
END;
$$;

-- cleanup_old_sessions
CREATE OR REPLACE FUNCTION public.cleanup_old_sessions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE deleted_count INTEGER;
BEGIN
  DELETE FROM public.user_sessions WHERE expires_at < NOW();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- cleanup_expired_sessions
CREATE OR REPLACE FUNCTION public.cleanup_expired_sessions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE deleted_count INTEGER;
BEGIN
  DELETE FROM public.user_sessions WHERE expires_at < NOW();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- update_import_job_updated_at
CREATE OR REPLACE FUNCTION public.update_import_job_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- get_favorite_count
CREATE OR REPLACE FUNCTION public.get_favorite_count(design_uuid UUID)
RETURNS INTEGER
LANGUAGE SQL
STABLE
SET search_path = ''
AS $$
  SELECT COUNT(*)::INTEGER FROM public.user_favorites WHERE design_id = design_uuid;
$$;

-- is_favorited
CREATE OR REPLACE FUNCTION public.is_favorited(design_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_favorites WHERE design_id = design_uuid AND user_id = user_uuid);
$$;

-- get_user_collection_count
CREATE OR REPLACE FUNCTION public.get_user_collection_count(user_uuid UUID)
RETURNS INTEGER
LANGUAGE SQL
STABLE
SET search_path = ''
AS $$
  SELECT COUNT(*)::INTEGER FROM public.collections WHERE user_id = user_uuid;
$$;

-- get_designs_to_publish
CREATE OR REPLACE FUNCTION public.get_designs_to_publish()
RETURNS SETOF public.designs
LANGUAGE SQL
STABLE
SET search_path = ''
AS $$
  SELECT * FROM public.designs WHERE publish_at IS NOT NULL AND publish_at <= NOW() AND is_public = FALSE;
$$;

-- get_designs_to_unpublish
CREATE OR REPLACE FUNCTION public.get_designs_to_unpublish()
RETURNS SETOF public.designs
LANGUAGE SQL
STABLE
SET search_path = ''
AS $$
  SELECT * FROM public.designs WHERE unpublish_at IS NOT NULL AND unpublish_at <= NOW() AND is_public = TRUE;
$$;

-- update_collection_timestamp
CREATE OR REPLACE FUNCTION public.update_collection_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- get_related_designs
CREATE OR REPLACE FUNCTION public.get_related_designs(p_design_slug TEXT, p_limit INT DEFAULT 4)
RETURNS TABLE (id UUID, slug TEXT, title TEXT, preview_path TEXT, difficulty TEXT, categories TEXT[], style TEXT, relevance_score FLOAT)
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
  v_design_id UUID;
  v_categories TEXT[];
  v_style TEXT;
  v_difficulty TEXT;
BEGIN
  SELECT d.id, d.categories, d.style, d.difficulty INTO v_design_id, v_categories, v_style, v_difficulty
  FROM public.designs d WHERE d.slug = p_design_slug AND d.is_public = true;
  IF v_design_id IS NULL THEN RETURN; END IF;
  RETURN QUERY
  SELECT d.id, d.slug, d.title, d.preview_path, d.difficulty, d.categories, d.style,
    (CASE WHEN d.categories && v_categories THEN 2.0 ELSE 0 END +
     CASE WHEN d.style = v_style THEN 1.0 ELSE 0 END +
     CASE WHEN d.difficulty = v_difficulty THEN 0.5 ELSE 0 END)::FLOAT as relevance_score
  FROM public.designs d
  WHERE d.is_public = true AND d.id != v_design_id
    AND (d.categories && v_categories OR d.style = v_style OR d.difficulty = v_difficulty)
  ORDER BY relevance_score DESC, d.created_at DESC
  LIMIT p_limit;
END;
$$;

-- get_import_log_reasons (matches original 3-column return type from 0011_import_logs.sql)
CREATE OR REPLACE FUNCTION public.get_import_log_reasons(p_job_id uuid)
RETURNS TABLE (status TEXT, reason TEXT, count BIGINT)
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT l.status::TEXT, l.reason::TEXT, COUNT(*)::BIGINT as count
  FROM public.import_logs l
  WHERE l.job_id = p_job_id AND l.reason IS NOT NULL
  GROUP BY l.status, l.reason
  ORDER BY count DESC;
END;
$$;

-- can_user_access_design
CREATE OR REPLACE FUNCTION public.can_user_access_design(user_uuid UUID, design_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_design_access TEXT;
  v_user_tier_level INT;
BEGIN
  SELECT access_level INTO v_design_access FROM public.designs WHERE id = design_uuid;
  IF v_design_access IS NULL OR v_design_access = 'free' THEN RETURN TRUE; END IF;
  SELECT COALESCE(at.tier_level, 0) INTO v_user_tier_level
  FROM public.users u LEFT JOIN public.access_tiers at ON at.id = u.tier_id WHERE u.id = user_uuid;
  IF v_design_access = 'premium' AND v_user_tier_level >= 1 THEN RETURN TRUE;
  ELSIF v_design_access = 'exclusive' AND v_user_tier_level >= 2 THEN RETURN TRUE;
  END IF;
  RETURN FALSE;
END;
$$;

-- check_user_download_limit
CREATE OR REPLACE FUNCTION public.check_user_download_limit(user_uuid UUID)
RETURNS TABLE (can_download BOOLEAN, downloads_used INT, downloads_limit INT, reset_date TIMESTAMPTZ)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tier_limit INT;
  v_current_downloads INT;
  v_period_start TIMESTAMPTZ;
BEGIN
  SELECT COALESCE(at.monthly_download_limit, -1), date_trunc('month', NOW())
  INTO v_tier_limit, v_period_start
  FROM public.users u LEFT JOIN public.access_tiers at ON at.id = u.tier_id WHERE u.id = user_uuid;
  IF v_tier_limit = -1 THEN RETURN QUERY SELECT TRUE, 0, -1, NULL::TIMESTAMPTZ; RETURN; END IF;
  SELECT COUNT(*)::INT INTO v_current_downloads FROM public.user_download_history
  WHERE user_id = user_uuid AND downloaded_at >= v_period_start;
  RETURN QUERY SELECT v_current_downloads < v_tier_limit, v_current_downloads, v_tier_limit, v_period_start + INTERVAL '1 month';
END;
$$;

-- get_user_dashboard_stats
CREATE OR REPLACE FUNCTION public.get_user_dashboard_stats(user_uuid UUID)
RETURNS TABLE (total_downloads BIGINT, downloads_this_month BIGINT, favorite_count BIGINT, collection_count BIGINT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM public.downloads WHERE user_id = user_uuid)::BIGINT,
    (SELECT COUNT(*) FROM public.downloads WHERE user_id = user_uuid AND downloaded_at >= date_trunc('month', NOW()))::BIGINT,
    (SELECT COUNT(*) FROM public.user_favorites WHERE user_id = user_uuid)::BIGINT,
    (SELECT COUNT(*) FROM public.collections WHERE user_id = user_uuid)::BIGINT;
END;
$$;

-- update_user_timestamp
CREATE OR REPLACE FUNCTION public.update_user_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- =============================================================================
-- SECTION 3: FIX RLS POLICIES - Replace auth.uid() with (SELECT auth.uid())
-- =============================================================================

-- Users table
DROP POLICY IF EXISTS "users_select_own" ON public.users;
CREATE POLICY "users_select_own" ON public.users FOR SELECT USING (id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "users_update_own" ON public.users;
CREATE POLICY "users_update_own" ON public.users FOR UPDATE USING (id = (SELECT auth.uid())) WITH CHECK (id = (SELECT auth.uid()));

-- Downloads table
DROP POLICY IF EXISTS "downloads_select_own" ON public.downloads;
CREATE POLICY "downloads_select_own" ON public.downloads FOR SELECT USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "downloads_insert_auth" ON public.downloads;
CREATE POLICY "downloads_insert_auth" ON public.downloads FOR INSERT WITH CHECK ((SELECT auth.uid()) IS NOT NULL AND user_id = (SELECT auth.uid()));

-- User favorites table
DROP POLICY IF EXISTS "Users can view own favorites" ON public.user_favorites;
CREATE POLICY "Users can view own favorites" ON public.user_favorites FOR SELECT USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can add favorites" ON public.user_favorites;
CREATE POLICY "Users can add favorites" ON public.user_favorites FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can remove own favorites" ON public.user_favorites;
CREATE POLICY "Users can remove own favorites" ON public.user_favorites FOR DELETE USING ((SELECT auth.uid()) = user_id);

-- Collections table
DROP POLICY IF EXISTS "Users can view own collections" ON public.collections;
CREATE POLICY "Users can view own collections" ON public.collections FOR SELECT USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can create collections" ON public.collections;
CREATE POLICY "Users can create collections" ON public.collections FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own collections" ON public.collections;
CREATE POLICY "Users can update own collections" ON public.collections FOR UPDATE USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own collections" ON public.collections;
CREATE POLICY "Users can delete own collections" ON public.collections FOR DELETE USING ((SELECT auth.uid()) = user_id);

-- Collection items table
DROP POLICY IF EXISTS "Users can view own collection items" ON public.collection_items;
CREATE POLICY "Users can view own collection items" ON public.collection_items FOR SELECT
USING (EXISTS (SELECT 1 FROM public.collections c WHERE c.id = collection_items.collection_id AND c.user_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS "Users can add items to own collections" ON public.collection_items;
CREATE POLICY "Users can add items to own collections" ON public.collection_items FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM public.collections c WHERE c.id = collection_items.collection_id AND c.user_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS "Users can update own collection items" ON public.collection_items;
CREATE POLICY "Users can update own collection items" ON public.collection_items FOR UPDATE
USING (EXISTS (SELECT 1 FROM public.collections c WHERE c.id = collection_items.collection_id AND c.user_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS "Users can remove items from own collections" ON public.collection_items;
CREATE POLICY "Users can remove items from own collections" ON public.collection_items FOR DELETE
USING (EXISTS (SELECT 1 FROM public.collections c WHERE c.id = collection_items.collection_id AND c.user_id = (SELECT auth.uid())));

-- User sessions table
DROP POLICY IF EXISTS "Users can view own sessions" ON public.user_sessions;
CREATE POLICY "Users can view own sessions" ON public.user_sessions FOR SELECT USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own sessions" ON public.user_sessions;
CREATE POLICY "Users can delete own sessions" ON public.user_sessions FOR DELETE USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Service role full access" ON public.user_sessions;
CREATE POLICY "Service role full access" ON public.user_sessions FOR ALL USING ((SELECT auth.jwt()) ->> 'role' = 'service_role');

-- Import jobs tables
DROP POLICY IF EXISTS "Admins can manage import jobs" ON public.import_jobs;
CREATE POLICY "Admins can manage import jobs" ON public.import_jobs FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'super_admin')));

DROP POLICY IF EXISTS "Admins can manage import items" ON public.import_items;
CREATE POLICY "Admins can manage import items" ON public.import_items FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'super_admin')));

DROP POLICY IF EXISTS "Admins can manage import projects" ON public.import_detected_projects;
CREATE POLICY "Admins can manage import projects" ON public.import_detected_projects FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'super_admin')));

-- =============================================================================
-- SECTION 4: FIX REMAINING POLICIES (conditional - only if tables exist)
-- =============================================================================

-- design_views
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'design_views') THEN
    DROP POLICY IF EXISTS "Users can see their own views" ON public.design_views;
    CREATE POLICY "Users can see their own views" ON public.design_views FOR SELECT USING (user_id = (SELECT auth.uid()) OR public.is_admin());
  END IF;
END $$;

-- user_activity
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_activity') THEN
    DROP POLICY IF EXISTS "Users can see own activity" ON public.user_activity;
    CREATE POLICY "Users can see own activity" ON public.user_activity FOR SELECT USING (user_id = (SELECT auth.uid()));
  END IF;
END $$;

-- subscription_history
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'subscription_history') THEN
    DROP POLICY IF EXISTS "Users can see own subscription history" ON public.subscription_history;
    CREATE POLICY "Users can see own subscription history" ON public.subscription_history FOR SELECT USING (user_id = (SELECT auth.uid()));
  END IF;
END $$;

-- payment_history
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payment_history') THEN
    DROP POLICY IF EXISTS "Users can view own payment history" ON public.payment_history;
    CREATE POLICY "Users can view own payment history" ON public.payment_history FOR SELECT USING ((SELECT auth.uid()) = user_id);
  END IF;
END $$;

-- stripe_subscriptions
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'stripe_subscriptions') THEN
    DROP POLICY IF EXISTS "Users can view own subscription" ON public.stripe_subscriptions;
    CREATE POLICY "Users can view own subscription" ON public.stripe_subscriptions FOR SELECT USING ((SELECT auth.uid()) = user_id);
  END IF;
END $$;

-- user_tier_history
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_tier_history') THEN
    DROP POLICY IF EXISTS "Users can view own tier history" ON public.user_tier_history;
    CREATE POLICY "Users can view own tier history" ON public.user_tier_history FOR SELECT USING (user_id = (SELECT auth.uid()) OR public.is_admin());
  END IF;
END $$;

-- user_download_history
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_download_history') THEN
    DROP POLICY IF EXISTS "Users can view own download history" ON public.user_download_history;
    CREATE POLICY "Users can view own download history" ON public.user_download_history FOR SELECT USING (user_id = (SELECT auth.uid()));
    DROP POLICY IF EXISTS "Users can insert own downloads" ON public.user_download_history;
    CREATE POLICY "Users can insert own downloads" ON public.user_download_history FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));
  END IF;
END $$;

-- =============================================================================
-- SECTION 5: FIX SERVICE ROLE POLICIES - Replace auth.role() with (SELECT auth.role())
-- =============================================================================

-- payment_history service role policy
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payment_history') THEN
    DROP POLICY IF EXISTS "Service role can manage payment history" ON public.payment_history;
    CREATE POLICY "Service role can manage payment history" ON public.payment_history FOR ALL USING ((SELECT auth.role()) = 'service_role');
  END IF;
END $$;

-- stripe_webhook_events service role policy
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'stripe_webhook_events') THEN
    DROP POLICY IF EXISTS "Service role can manage webhook events" ON public.stripe_webhook_events;
    CREATE POLICY "Service role can manage webhook events" ON public.stripe_webhook_events FOR ALL USING ((SELECT auth.role()) = 'service_role');
  END IF;
END $$;

-- app_settings service role policy
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'app_settings') THEN
    DROP POLICY IF EXISTS "Service role can manage settings" ON public.app_settings;
    CREATE POLICY "Service role can manage settings" ON public.app_settings FOR ALL USING ((SELECT auth.role()) = 'service_role');
  END IF;
END $$;

-- =============================================================================
-- DONE! Refresh the Supabase Linter to verify fixes.
-- =============================================================================
