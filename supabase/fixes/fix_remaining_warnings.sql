-- =============================================================================
-- FIX REMAINING 16 WARNINGS
-- Issue: FOR ALL policies overlap with SELECT policies
-- Fix: Change FOR ALL to specific operations (INSERT, UPDATE, DELETE)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. access_tiers: Change admin_write from FOR ALL to specific operations
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "access_tiers_admin_write" ON public.access_tiers;

CREATE POLICY "access_tiers_admin_insert" ON public.access_tiers
  FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "access_tiers_admin_update" ON public.access_tiers
  FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "access_tiers_admin_delete" ON public.access_tiers
  FOR DELETE
  USING (public.is_admin());

-- -----------------------------------------------------------------------------
-- 2. design_view_stats: Change write from FOR ALL to specific operations
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "design_view_stats_write" ON public.design_view_stats;

CREATE POLICY "design_view_stats_insert" ON public.design_view_stats
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "design_view_stats_update" ON public.design_view_stats
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "design_view_stats_delete" ON public.design_view_stats
  FOR DELETE
  USING (true);

-- -----------------------------------------------------------------------------
-- 3. payment_history: Change write from FOR ALL to specific operations
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "payment_history_write" ON public.payment_history;

CREATE POLICY "payment_history_insert" ON public.payment_history
  FOR INSERT
  WITH CHECK ((SELECT auth.jwt()) ->> 'role' = 'service_role');

CREATE POLICY "payment_history_update" ON public.payment_history
  FOR UPDATE
  USING ((SELECT auth.jwt()) ->> 'role' = 'service_role')
  WITH CHECK ((SELECT auth.jwt()) ->> 'role' = 'service_role');

CREATE POLICY "payment_history_delete" ON public.payment_history
  FOR DELETE
  USING ((SELECT auth.jwt()) ->> 'role' = 'service_role');

-- -----------------------------------------------------------------------------
-- 4. subscription_history: Change admin_write from FOR ALL to specific ops
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "subscription_history_admin_write" ON public.subscription_history;

CREATE POLICY "subscription_history_admin_insert" ON public.subscription_history
  FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "subscription_history_admin_update" ON public.subscription_history
  FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "subscription_history_admin_delete" ON public.subscription_history
  FOR DELETE
  USING (public.is_admin());

-- =============================================================================
-- DONE! Should now have 0 warnings.
-- =============================================================================
