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
