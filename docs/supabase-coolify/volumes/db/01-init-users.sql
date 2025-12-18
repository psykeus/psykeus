-- =============================================================================
-- Database Initialization: public.users table and auth trigger
-- =============================================================================
-- This script runs automatically when the database is first created.
-- It sets up the public.users table that mirrors auth.users.
-- =============================================================================

-- Create the public users table
CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY,
  email text UNIQUE NOT NULL,
  name text,
  role text DEFAULT 'user' CHECK (role IN ('user', 'admin', 'super_admin')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz,

  -- Tier/Subscription fields
  tier_id uuid,
  tier_expires_at timestamptz,
  status text DEFAULT 'active' CHECK (status IN ('active', 'paused', 'disabled', 'suspended', 'banned')),
  subscription_status text,

  -- Suspended state tracking
  suspended_reason text,
  suspended_at timestamptz,
  suspended_by uuid REFERENCES public.users(id),

  -- Paused state tracking (user-requested)
  paused_reason text,
  paused_at timestamptz,
  paused_by uuid REFERENCES public.users(id),

  -- Disabled state tracking (admin-disabled)
  disabled_reason text,
  disabled_at timestamptz,
  disabled_by uuid REFERENCES public.users(id),

  -- Activity tracking
  last_login_at timestamptz,
  login_count integer DEFAULT 0,

  -- Profile fields
  profile_image_url text,
  bio text,
  website text
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON public.users(status);
CREATE INDEX IF NOT EXISTS idx_users_tier_id ON public.users(tier_id);

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- Trigger function to sync auth.users -> public.users
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name, role, status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NULL),
    'user',
    'active'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't block signup
  RAISE WARNING 'handle_new_user failed for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Create the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- =============================================================================
-- RLS Policies
-- =============================================================================

-- Allow system to insert users (via auth trigger)
DROP POLICY IF EXISTS "users_insert_system" ON public.users;
CREATE POLICY "users_insert_system" ON public.users
  FOR INSERT WITH CHECK (true);

-- Users can view their own record
DROP POLICY IF EXISTS "users_select_own" ON public.users;
CREATE POLICY "users_select_own" ON public.users
  FOR SELECT USING (id = (SELECT auth.uid()));

-- Users can update their own record (except role)
DROP POLICY IF EXISTS "users_update_own" ON public.users;
CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

-- =============================================================================
-- Helper function to check if current user is admin
-- =============================================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = (SELECT auth.uid())
    AND role IN ('admin', 'super_admin')
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '';

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = (SELECT auth.uid())
    AND role = 'super_admin'
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '';

-- Admins can view all users
DROP POLICY IF EXISTS "users_select_admin" ON public.users;
CREATE POLICY "users_select_admin" ON public.users
  FOR SELECT USING (public.is_admin());

-- Super admins can update any user
DROP POLICY IF EXISTS "users_update_super_admin" ON public.users;
CREATE POLICY "users_update_super_admin" ON public.users
  FOR UPDATE USING (public.is_super_admin());

-- =============================================================================
-- Function to update updated_at timestamp
-- =============================================================================

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- =============================================================================
-- Comments
-- =============================================================================

COMMENT ON TABLE public.users IS 'Application users - synced from auth.users via trigger';
COMMENT ON FUNCTION public.handle_new_user() IS 'Creates public.users record when auth.users record is created';
COMMENT ON FUNCTION public.is_admin() IS 'Check if current user has admin or super_admin role';
COMMENT ON FUNCTION public.is_super_admin() IS 'Check if current user has super_admin role';
