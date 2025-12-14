-- Add expires_at column to user_sessions for explicit session expiration
-- This allows configurable session lifetime beyond just cookie expiration

ALTER TABLE user_sessions
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Set default expiration for existing sessions (30 days from last_active_at)
UPDATE user_sessions
SET expires_at = last_active_at + INTERVAL '30 days'
WHERE expires_at IS NULL;

-- Create index for efficient expiration queries
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at
ON user_sessions(expires_at)
WHERE expires_at IS NOT NULL;

-- Update the validate_session_with_role function to also check expiration
CREATE OR REPLACE FUNCTION validate_session_with_role(
  p_session_token TEXT,
  p_user_id UUID
)
RETURNS TABLE (
  is_valid BOOLEAN,
  user_role TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    (s.user_id = p_user_id AND (s.expires_at IS NULL OR s.expires_at > NOW())) AS is_valid,
    u.role::TEXT AS user_role
  FROM user_sessions s
  JOIN users u ON s.user_id = u.id
  WHERE s.session_token = p_session_token
  LIMIT 1;
END;
$$;

-- Create a function to clean up expired sessions (can be called via cron)
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM user_sessions
  WHERE expires_at IS NOT NULL AND expires_at < NOW();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION cleanup_expired_sessions IS
'Deletes expired sessions. Call periodically via cron or pg_cron.
Example: SELECT cleanup_expired_sessions();';
