-- Migration: Email Management System
-- Add email settings and editable templates

-- ============================================================================
-- Email Settings Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS email_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  smtp_host TEXT NOT NULL,
  smtp_port INTEGER NOT NULL DEFAULT 587,
  smtp_user TEXT NOT NULL,
  smtp_password TEXT NOT NULL, -- Encrypted with AES-256-GCM in application layer
  smtp_from_email TEXT NOT NULL,
  smtp_from_name TEXT NOT NULL DEFAULT 'CNC Design Library',
  smtp_secure BOOLEAN DEFAULT false, -- true for SSL/TLS
  is_active BOOLEAN DEFAULT true,
  last_tested_at TIMESTAMPTZ,
  last_test_success BOOLEAN,
  last_test_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Only allow one active settings row
CREATE UNIQUE INDEX IF NOT EXISTS email_settings_single_row
  ON email_settings (is_active) WHERE is_active = true;

-- ============================================================================
-- Email Templates Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  subject TEXT NOT NULL,
  html_content TEXT NOT NULL,
  text_content TEXT NOT NULL,
  variables JSONB DEFAULT '[]'::jsonb, -- List of available template variables
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_email_templates_key ON email_templates(template_key);

-- ============================================================================
-- Triggers for updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_email_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER email_settings_updated_at
  BEFORE UPDATE ON email_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_email_settings_updated_at();

CREATE OR REPLACE FUNCTION update_email_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER email_templates_updated_at
  BEFORE UPDATE ON email_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_email_templates_updated_at();

-- ============================================================================
-- RLS Policies (Admin only)
-- ============================================================================

ALTER TABLE email_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

-- Email Settings: Admin only
CREATE POLICY "Admins can view email settings"
  ON email_settings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can insert email settings"
  ON email_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can update email settings"
  ON email_settings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can delete email settings"
  ON email_settings FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'super_admin')
    )
  );

-- Email Templates: Admin only
CREATE POLICY "Admins can view email templates"
  ON email_templates FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can insert email templates"
  ON email_templates FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can update email templates"
  ON email_templates FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can delete email templates"
  ON email_templates FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'super_admin')
    )
  );

-- Service role can access for sending emails
CREATE POLICY "Service role can view email settings"
  ON email_settings FOR SELECT
  TO service_role
  USING (true);

CREATE POLICY "Service role can view email templates"
  ON email_templates FOR SELECT
  TO service_role
  USING (true);

-- ============================================================================
-- Seed Default Email Templates
-- ============================================================================

INSERT INTO email_templates (template_key, name, description, subject, html_content, text_content, variables) VALUES

-- Welcome Email
('welcome', 'Welcome Email', 'Sent when a user creates a new account',
'Welcome to CNC Design Library, {{userName}}!',
E'<h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600;">
  Welcome to CNC Design Library!
</h2>

<p style="margin: 0 0 16px 0;">
  Hi {{userName}},
</p>

<p style="margin: 0 0 16px 0;">
  Thank you for joining CNC Design Library! We''re excited to have you as part of our community.
</p>

<p style="margin: 0 0 16px 0;">
  With your account, you can:
</p>

<ul style="margin: 0 0 16px 0; padding-left: 24px;">
  <li style="margin-bottom: 8px;">Browse thousands of CNC and laser cutting designs</li>
  <li style="margin-bottom: 8px;">Download files in multiple formats (SVG, DXF, STL, and more)</li>
  <li style="margin-bottom: 8px;">Save your favorite designs to collections</li>
  <li style="margin-bottom: 8px;">Track your download history</li>
</ul>

{{buttonStartBrowsing}}

<p style="margin: 24px 0 0 0; color: #6b7280; font-size: 14px;">
  If you have any questions, feel free to reach out to our support team.
</p>',
E'Welcome to CNC Design Library!

Hi {{userName}},

Thank you for joining CNC Design Library! We''re excited to have you as part of our community.

With your account, you can:
- Browse thousands of CNC and laser cutting designs
- Download files in multiple formats (SVG, DXF, STL, and more)
- Save your favorite designs to collections
- Track your download history

Start Browsing: {{loginUrl}}

If you have any questions, feel free to reach out to our support team.',
'["userName", "loginUrl"]'::jsonb),

-- Subscription Confirmation
('subscription_confirmation', 'Subscription Confirmation', 'Payment receipt and subscription confirmation',
'Subscription Confirmed - {{tierName}} Plan',
E'<h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600;">
  Subscription Confirmed!
</h2>

<p style="margin: 0 0 16px 0;">
  Hi {{userName}},
</p>

<p style="margin: 0 0 24px 0;">
  Your subscription to the <strong>{{tierName}}</strong> plan has been confirmed. Thank you for your support!
</p>

{{tierDescriptionBox}}

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0; border: 1px solid #e5e7eb; border-radius: 8px;">
  <tr>
    <td style="padding: 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; font-weight: 600;">Subscription Details</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;"></td>
        </tr>
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">Plan</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">{{tierName}}</td>
        </tr>
        {{amountRow}}
        {{nextBillingRow}}
      </table>
    </td>
  </tr>
</table>

{{buttonManageSubscription}}

<p style="margin: 24px 0 0 0; color: #6b7280; font-size: 14px;">
  You can manage or cancel your subscription at any time from your account settings.
</p>',
E'Subscription Confirmed!

Hi {{userName}},

Your subscription to the {{tierName}} plan has been confirmed. Thank you for your support!

{{tierDescription}}

--- Subscription Details ---
Plan: {{tierName}}
{{amount}}
{{nextBillingDate}}

Manage your subscription: {{manageSubscriptionUrl}}

You can manage or cancel your subscription at any time from your account settings.',
'["userName", "tierName", "tierDescription", "amount", "nextBillingDate", "manageSubscriptionUrl"]'::jsonb),

-- Subscription Expiring
('subscription_expiring', 'Subscription Expiring', 'Reminder before subscription expires',
'Your {{tierName}} Subscription is Expiring Soon',
E'<h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600;">
  Your Subscription is Expiring Soon
</h2>

<p style="margin: 0 0 16px 0;">
  Hi {{userName}},
</p>

<p style="margin: 0 0 16px 0;">
  This is a friendly reminder that your <strong>{{tierName}}</strong> subscription will expire on <strong>{{expirationDate}}</strong>.
</p>

{{warningBox}}

<p style="margin: 16px 0;">
  To continue enjoying uninterrupted access to all features, please renew your subscription before the expiration date.
</p>

{{buttonRenew}}

<p style="margin: 24px 0 0 0; color: #6b7280; font-size: 14px;">
  If you have any questions about your subscription or need assistance, please contact our support team.
</p>',
E'Your Subscription is Expiring Soon

Hi {{userName}},

This is a friendly reminder that your {{tierName}} subscription will expire on {{expirationDate}}.

What happens after expiration:
You''ll lose access to premium features including unlimited downloads and exclusive designs.
Your favorites and collections will be saved, but some features may be limited.

To continue enjoying uninterrupted access to all features, please renew your subscription before the expiration date.

Renew Subscription: {{renewUrl}}

If you have any questions about your subscription or need assistance, please contact our support team.',
'["userName", "tierName", "expirationDate", "renewUrl"]'::jsonb),

-- Download Limit Warning
('download_limit_warning', 'Download Limit Warning', 'Alert when user is near download limit',
'Download Limit Warning - {{percentUsed}}% Used',
E'<h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600;">
  Download Limit Warning
</h2>

<p style="margin: 0 0 16px 0;">
  Hi {{userName}},
</p>

<p style="margin: 0 0 24px 0;">
  You''ve used <strong style="color: {{percentColor}};">{{percentUsed}}%</strong> of your monthly download limit.
</p>

{{progressBar}}

{{infoBox}}

{{buttonUpgrade}}

<p style="margin: 24px 0 0 0; color: #6b7280; font-size: 14px;">
  Need more downloads right now? Upgrading your plan takes effect immediately.
</p>',
E'Download Limit Warning

Hi {{userName}},

You''ve used {{percentUsed}}% of your monthly download limit.

{{currentUsage}} of {{limit}} downloads used this month.

Your download limit resets at the beginning of each billing cycle.
Consider upgrading to a higher tier for more downloads.

Upgrade Your Plan: {{upgradeUrl}}

Need more downloads right now? Upgrading your plan takes effect immediately.',
'["userName", "percentUsed", "currentUsage", "limit", "upgradeUrl"]'::jsonb),

-- Account Status Change
('account_status_change', 'Account Status Change', 'Important account status notifications',
'Account Update - {{statusTitle}}',
E'<h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600;">
  {{statusTitle}}
</h2>

<p style="margin: 0 0 16px 0;">
  Hi {{userName}},
</p>

<p style="margin: 0 0 16px 0;">
  {{statusMessage}}
</p>

{{statusBox}}

<p style="margin: 24px 0 0 0;">
  If you have any questions or believe this was done in error, please contact us at
  <a href="mailto:{{contactEmail}}" style="color: #2563eb;">{{contactEmail}}</a>.
</p>',
E'Account Update

Hi {{userName}},

{{statusMessage}}

{{statusInfo}}

If you have any questions or believe this was done in error, please contact us at {{contactEmail}}.',
'["userName", "statusTitle", "statusMessage", "statusInfo", "contactEmail"]'::jsonb),

-- Import Completion
('import_completion', 'Import Completion', 'Notification when bulk import jobs finish',
'Import Job Complete - {{jobName}}',
E'<h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600;">
  Import Job Complete
</h2>

<p style="margin: 0 0 16px 0;">
  Hi {{userName}},
</p>

<p style="margin: 0 0 16px 0;">
  Your import job "<strong>{{jobName}}</strong>" has finished processing.
</p>

{{statusBox}}

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0; border: 1px solid #e5e7eb; border-radius: 8px;">
  <tr>
    <td style="padding: 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; font-weight: 600;">Import Summary</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;"></td>
        </tr>
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">Total Items</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">{{totalItems}}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
            <span style="color: #22c55e;">&#10003;</span> Successful
          </td>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right; color: #22c55e; font-weight: 600;">{{successCount}}</td>
        </tr>
        {{failedRow}}
        {{skippedRow}}
      </table>
    </td>
  </tr>
</table>

{{buttonViewDetails}}

<p style="margin: 24px 0 0 0; color: #6b7280; font-size: 14px;">
  {{footerMessage}}
</p>',
E'Import Job Complete

Hi {{userName}},

Your import job "{{jobName}}" has finished processing.

{{statusMessage}}

--- Import Summary ---
Total Items: {{totalItems}}
Successful: {{successCount}}
{{failedCount}}
{{skippedCount}}

View Import Details: {{viewJobUrl}}

{{footerMessage}}',
'["userName", "jobName", "statusMessage", "totalItems", "successCount", "failedCount", "skippedCount", "viewJobUrl"]'::jsonb),

-- Admin Broadcast
('admin_broadcast', 'Admin Broadcast', 'Platform-wide announcements from administrators',
'{{title}}',
E'<h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600;">
  {{title}}
</h2>

<div style="margin: 0 0 16px 0;">
  {{message}}
</div>

{{actionButton}}

<p style="margin: 24px 0 0 0; color: #6b7280; font-size: 14px;">
  This message was sent to all members of CNC Design Library.
</p>',
E'{{title}}

{{message}}

{{actionLink}}
---
This message was sent to all members of CNC Design Library.',
'["title", "message", "actionLabel", "actionUrl"]'::jsonb)

ON CONFLICT (template_key) DO NOTHING;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE email_settings IS 'SMTP configuration for sending emails. Password is encrypted in application layer.';
COMMENT ON TABLE email_templates IS 'Editable email templates with variable substitution support.';
COMMENT ON COLUMN email_templates.variables IS 'JSON array of variable names that can be used in this template (e.g., ["userName", "loginUrl"])';
