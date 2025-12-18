 -- 1. Create the users table (from 0001_init.sql)
  CREATE TABLE IF NOT EXISTS public.users (
    id uuid PRIMARY KEY,
    email text UNIQUE NOT NULL,
    name text,
    role text DEFAULT 'user',
    created_at timestamptz DEFAULT now()
  );

  -- 2. Add columns from later migrations (0013, 0021)
  ALTER TABLE public.users ADD COLUMN IF NOT EXISTS tier_id uuid;
  ALTER TABLE public.users ADD COLUMN IF NOT EXISTS tier_expires_at timestamptz;
  ALTER TABLE public.users ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';
  ALTER TABLE public.users ADD COLUMN IF NOT EXISTS subscription_status text;
  ALTER TABLE public.users ADD COLUMN IF NOT EXISTS suspended_reason text;
  ALTER TABLE public.users ADD COLUMN IF NOT EXISTS suspended_at timestamptz;
  ALTER TABLE public.users ADD COLUMN IF NOT EXISTS suspended_by uuid;
  ALTER TABLE public.users ADD COLUMN IF NOT EXISTS paused_reason text;
  ALTER TABLE public.users ADD COLUMN IF NOT EXISTS paused_at timestamptz;
  ALTER TABLE public.users ADD COLUMN IF NOT EXISTS paused_by uuid;
  ALTER TABLE public.users ADD COLUMN IF NOT EXISTS disabled_reason text;
  ALTER TABLE public.users ADD COLUMN IF NOT EXISTS disabled_at timestamptz;
  ALTER TABLE public.users ADD COLUMN IF NOT EXISTS disabled_by uuid;
  ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_login_at timestamptz;
  ALTER TABLE public.users ADD COLUMN IF NOT EXISTS login_count integer DEFAULT 0;
  ALTER TABLE public.users ADD COLUMN IF NOT EXISTS profile_image_url text;
  ALTER TABLE public.users ADD COLUMN IF NOT EXISTS bio text;
  ALTER TABLE public.users ADD COLUMN IF NOT EXISTS website text;
  ALTER TABLE public.users ADD COLUMN IF NOT EXISTS updated_at timestamptz;

  -- 3. Enable RLS
  ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

  -- 4. Create the handle_new_user function
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
  $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

  -- 5. Create the trigger on auth.users
  DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
  CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

  -- 6. Create RLS policy to allow inserts from trigger
  DROP POLICY IF EXISTS "users_insert_system" ON public.users;
  CREATE POLICY "users_insert_system" ON public.users
    FOR INSERT WITH CHECK (true);

  -- 7. Create RLS policy for users to see themselves
  DROP POLICY IF EXISTS "users_select_own" ON public.users;
  CREATE POLICY "users_select_own" ON public.users
    FOR SELECT USING (id = (SELECT auth.uid()));
