-- Migration: Notifications and Email System
-- Date: 2025-12-16
-- Adds tables for notifications, email preferences, admin broadcasts, and email logs

-- ============================================================================
-- NOTIFICATION TYPES ENUM
-- ============================================================================

CREATE TYPE notification_type AS ENUM (
  'system',           -- System-wide announcements
  'account',          -- Account-related (suspension, role change)
  'subscription',     -- Tier changes, expiration warnings
  'download',         -- Download limit warnings
  'import',           -- Import job completions
  'admin_broadcast'   -- Admin-initiated broadcasts
);

CREATE TYPE notification_priority AS ENUM (
  'low',
  'normal',
  'high',
  'urgent'
);

-- ============================================================================
-- USER EMAIL PREFERENCES
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_email_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Global opt-out
  email_unsubscribed BOOLEAN NOT NULL DEFAULT FALSE,
  unsubscribed_at TIMESTAMPTZ,

  -- Individual email type preferences (all default to true = opted in)
  email_welcome BOOLEAN NOT NULL DEFAULT TRUE,
  email_subscription_confirmation BOOLEAN NOT NULL DEFAULT TRUE,
  email_subscription_expiring BOOLEAN NOT NULL DEFAULT TRUE,
  email_download_limit_warning BOOLEAN NOT NULL DEFAULT TRUE,
  email_account_status_change BOOLEAN NOT NULL DEFAULT TRUE,
  email_import_completion BOOLEAN NOT NULL DEFAULT TRUE,
  email_admin_broadcast BOOLEAN NOT NULL DEFAULT TRUE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(user_id)
);

-- Indexes
CREATE INDEX idx_user_email_preferences_user_id ON user_email_preferences(user_id);
CREATE INDEX idx_user_email_preferences_unsubscribed ON user_email_preferences(email_unsubscribed)
  WHERE email_unsubscribed = TRUE;

-- RLS policies
ALTER TABLE user_email_preferences ENABLE ROW LEVEL SECURITY;

-- Users can view their own preferences
CREATE POLICY "user_email_preferences_select_own"
  ON user_email_preferences FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

-- Users can update their own preferences
CREATE POLICY "user_email_preferences_update_own"
  ON user_email_preferences FOR UPDATE
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- Users can insert their own preferences (on first access)
CREATE POLICY "user_email_preferences_insert_own"
  ON user_email_preferences FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- Admins can view all preferences
CREATE POLICY "user_email_preferences_admin_select"
  ON user_email_preferences FOR SELECT
  USING (public.is_admin());

-- Service role can manage all (for backend operations)
CREATE POLICY "user_email_preferences_service_all"
  ON user_email_preferences FOR ALL
  USING ((SELECT auth.jwt()) ->> 'role' = 'service_role')
  WITH CHECK ((SELECT auth.jwt()) ->> 'role' = 'service_role');

-- ============================================================================
-- NOTIFICATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  type notification_type NOT NULL DEFAULT 'system',
  priority notification_priority NOT NULL DEFAULT 'normal',

  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,

  -- Optional action button
  action_url TEXT,
  action_label VARCHAR(100),

  -- Read status
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  read_at TIMESTAMPTZ,

  -- Optional expiration
  expires_at TIMESTAMPTZ,

  -- Additional context (e.g., related entity IDs)
  metadata JSONB DEFAULT '{}',

  -- Reference to broadcast if this came from one
  broadcast_id UUID,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX idx_notifications_user_created ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_broadcast_id ON notifications(broadcast_id) WHERE broadcast_id IS NOT NULL;
CREATE INDEX idx_notifications_expires ON notifications(expires_at) WHERE expires_at IS NOT NULL;

-- RLS policies
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can view their own notifications
CREATE POLICY "notifications_select_own"
  ON notifications FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

-- Users can update their own notifications (mark as read)
CREATE POLICY "notifications_update_own"
  ON notifications FOR UPDATE
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- Users can delete their own notifications
CREATE POLICY "notifications_delete_own"
  ON notifications FOR DELETE
  USING ((SELECT auth.uid()) = user_id);

-- Admins can view all notifications (for debugging)
CREATE POLICY "notifications_admin_select"
  ON notifications FOR SELECT
  USING (public.is_admin());

-- Service role can insert/manage (for backend notification creation)
CREATE POLICY "notifications_service_insert"
  ON notifications FOR INSERT
  WITH CHECK ((SELECT auth.jwt()) ->> 'role' = 'service_role');

CREATE POLICY "notifications_service_all"
  ON notifications FOR ALL
  USING ((SELECT auth.jwt()) ->> 'role' = 'service_role')
  WITH CHECK ((SELECT auth.jwt()) ->> 'role' = 'service_role');

-- ============================================================================
-- ADMIN BROADCASTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS admin_broadcasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,

  -- Target audience
  target_audience VARCHAR(50) NOT NULL DEFAULT 'all', -- 'all', 'admins', 'subscribers', 'free'
  target_tier_ids UUID[], -- Optional: specific tier IDs

  -- Scheduling
  scheduled_at TIMESTAMPTZ, -- NULL = send immediately
  sent_at TIMESTAMPTZ,

  -- Tracking
  recipients_count INTEGER DEFAULT 0,
  read_count INTEGER DEFAULT 0,

  -- Optional action
  action_url TEXT,
  action_label VARCHAR(100),

  -- Priority
  priority notification_priority NOT NULL DEFAULT 'normal',

  -- Creator
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_admin_broadcasts_scheduled ON admin_broadcasts(scheduled_at)
  WHERE scheduled_at IS NOT NULL AND sent_at IS NULL;
CREATE INDEX idx_admin_broadcasts_created_by ON admin_broadcasts(created_by);
CREATE INDEX idx_admin_broadcasts_created_at ON admin_broadcasts(created_at DESC);

-- RLS policies
ALTER TABLE admin_broadcasts ENABLE ROW LEVEL SECURITY;

-- Only admins can manage broadcasts
CREATE POLICY "admin_broadcasts_admin_select"
  ON admin_broadcasts FOR SELECT
  USING (public.is_admin());

CREATE POLICY "admin_broadcasts_admin_insert"
  ON admin_broadcasts FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "admin_broadcasts_admin_update"
  ON admin_broadcasts FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "admin_broadcasts_admin_delete"
  ON admin_broadcasts FOR DELETE
  USING (public.is_admin());

-- Add foreign key from notifications to admin_broadcasts
ALTER TABLE notifications
  ADD CONSTRAINT fk_notifications_broadcast
  FOREIGN KEY (broadcast_id) REFERENCES admin_broadcasts(id) ON DELETE SET NULL;

-- ============================================================================
-- EMAIL LOGS
-- ============================================================================

CREATE TYPE email_status AS ENUM (
  'pending',
  'sent',
  'failed',
  'bounced'
);

CREATE TABLE IF NOT EXISTS email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Recipient
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  recipient_email VARCHAR(255) NOT NULL,

  -- Email details
  email_type VARCHAR(50) NOT NULL, -- 'welcome', 'subscription_confirmation', etc.
  subject VARCHAR(500) NOT NULL,

  -- Status tracking
  status email_status NOT NULL DEFAULT 'pending',
  error_message TEXT,

  -- SMTP response
  smtp_message_id VARCHAR(255),
  smtp_response TEXT,

  -- Timing
  sent_at TIMESTAMPTZ,

  -- Context
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_email_logs_user_id ON email_logs(user_id);
CREATE INDEX idx_email_logs_status ON email_logs(status);
CREATE INDEX idx_email_logs_email_type ON email_logs(email_type);
CREATE INDEX idx_email_logs_created_at ON email_logs(created_at DESC);
CREATE INDEX idx_email_logs_recipient ON email_logs(recipient_email);

-- RLS policies
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view email logs
CREATE POLICY "email_logs_admin_select"
  ON email_logs FOR SELECT
  USING (public.is_admin());

-- Service role can insert/update (for backend)
CREATE POLICY "email_logs_service_insert"
  ON email_logs FOR INSERT
  WITH CHECK ((SELECT auth.jwt()) ->> 'role' = 'service_role');

CREATE POLICY "email_logs_service_update"
  ON email_logs FOR UPDATE
  USING ((SELECT auth.jwt()) ->> 'role' = 'service_role')
  WITH CHECK ((SELECT auth.jwt()) ->> 'role' = 'service_role');

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Get unread notification count for a user
CREATE OR REPLACE FUNCTION get_unread_notification_count(user_uuid UUID)
RETURNS INTEGER
LANGUAGE SQL
STABLE
SET search_path = ''
AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.notifications
  WHERE user_id = user_uuid
    AND is_read = FALSE
    AND (expires_at IS NULL OR expires_at > NOW());
$$;

-- Get user's email preference (creates default if doesn't exist)
CREATE OR REPLACE FUNCTION get_or_create_email_preferences(user_uuid UUID)
RETURNS user_email_preferences
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  prefs public.user_email_preferences;
BEGIN
  SELECT * INTO prefs
  FROM public.user_email_preferences
  WHERE user_id = user_uuid;

  IF NOT FOUND THEN
    INSERT INTO public.user_email_preferences (user_id)
    VALUES (user_uuid)
    RETURNING * INTO prefs;
  END IF;

  RETURN prefs;
END;
$$;

-- Check if user has opted into a specific email type
CREATE OR REPLACE FUNCTION can_send_email(user_uuid UUID, email_type_name TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
  prefs public.user_email_preferences;
  can_send BOOLEAN;
BEGIN
  SELECT * INTO prefs
  FROM public.user_email_preferences
  WHERE user_id = user_uuid;

  -- If no preferences exist, default to allowing emails
  IF NOT FOUND THEN
    RETURN TRUE;
  END IF;

  -- Check global unsubscribe
  IF prefs.email_unsubscribed THEN
    RETURN FALSE;
  END IF;

  -- Check specific email type
  CASE email_type_name
    WHEN 'welcome' THEN can_send := prefs.email_welcome;
    WHEN 'subscription_confirmation' THEN can_send := prefs.email_subscription_confirmation;
    WHEN 'subscription_expiring' THEN can_send := prefs.email_subscription_expiring;
    WHEN 'download_limit_warning' THEN can_send := prefs.email_download_limit_warning;
    WHEN 'account_status_change' THEN can_send := prefs.email_account_status_change;
    WHEN 'import_completion' THEN can_send := prefs.email_import_completion;
    WHEN 'admin_broadcast' THEN can_send := prefs.email_admin_broadcast;
    ELSE can_send := TRUE; -- Unknown types default to true
  END CASE;

  RETURN can_send;
END;
$$;

-- Mark all notifications as read for a user
CREATE OR REPLACE FUNCTION mark_all_notifications_read(user_uuid UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE public.notifications
  SET is_read = TRUE, read_at = NOW()
  WHERE user_id = user_uuid AND is_read = FALSE;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

-- Clean up expired notifications (for scheduled job)
CREATE OR REPLACE FUNCTION cleanup_expired_notifications()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.notifications
  WHERE expires_at IS NOT NULL AND expires_at < NOW();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update user_email_preferences.updated_at on change
CREATE TRIGGER user_email_preferences_updated_at
  BEFORE UPDATE ON user_email_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Update admin_broadcasts.updated_at on change
CREATE TRIGGER admin_broadcasts_updated_at
  BEFORE UPDATE ON admin_broadcasts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- REALTIME SUBSCRIPTIONS
-- ============================================================================

-- Enable realtime for notifications table (for live updates)
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE user_email_preferences IS 'User preferences for email notifications';
COMMENT ON TABLE notifications IS 'In-app notifications for users';
COMMENT ON TABLE admin_broadcasts IS 'Admin-created broadcast messages';
COMMENT ON TABLE email_logs IS 'Log of all sent emails for debugging and tracking';

COMMENT ON TYPE notification_type IS 'Types of notifications';
COMMENT ON TYPE notification_priority IS 'Priority levels for notifications';
COMMENT ON TYPE email_status IS 'Status of email delivery';

COMMENT ON FUNCTION get_unread_notification_count IS 'Returns count of unread, non-expired notifications for a user';
COMMENT ON FUNCTION get_or_create_email_preferences IS 'Gets or creates default email preferences for a user';
COMMENT ON FUNCTION can_send_email IS 'Checks if a user has opted into receiving a specific email type';
COMMENT ON FUNCTION mark_all_notifications_read IS 'Marks all unread notifications as read for a user';
COMMENT ON FUNCTION cleanup_expired_notifications IS 'Deletes expired notifications - run via scheduled job';
