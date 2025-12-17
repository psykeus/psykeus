/**
 * Email Settings Service
 * Manages SMTP configuration stored in the database
 */

import { createServiceClient } from "@/lib/supabase/server";
import { encrypt, decrypt, maskPassword } from "./encryption";
import nodemailer from "nodemailer";

// Types
export interface EmailSettings {
  id: string;
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_password: string; // Encrypted in DB, decrypted when returned
  smtp_from_email: string;
  smtp_from_name: string;
  smtp_secure: boolean;
  is_active: boolean;
  last_tested_at: string | null;
  last_test_success: boolean | null;
  last_test_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmailSettingsPublic {
  id: string;
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_password_masked: string; // Masked for display
  smtp_from_email: string;
  smtp_from_name: string;
  smtp_secure: boolean;
  is_active: boolean;
  last_tested_at: string | null;
  last_test_success: boolean | null;
  last_test_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface UpdateEmailSettingsInput {
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_password?: string; // Only provided when changing password
  smtp_from_email: string;
  smtp_from_name: string;
  smtp_secure: boolean;
}

export interface TestConnectionResult {
  success: boolean;
  message: string;
  details?: Record<string, unknown>;
}

export interface SendTestEmailResult {
  success: boolean;
  message: string;
  messageId?: string;
}

// Cache for settings
let settingsCache: EmailSettings | null = null;
let settingsCacheTime = 0;
const CACHE_TTL = 300000; // 5 minutes

/**
 * Clear the settings cache
 */
export function clearEmailSettingsCache(): void {
  settingsCache = null;
  settingsCacheTime = 0;
}

/**
 * Get email settings from database (with decrypted password)
 * Falls back to environment variables if no DB settings exist
 */
export async function getEmailSettings(): Promise<EmailSettings | null> {
  const now = Date.now();

  // Return cached if valid
  if (settingsCache && now - settingsCacheTime < CACHE_TTL) {
    return settingsCache;
  }

  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("email_settings")
    .select("*")
    .eq("is_active", true)
    .single();

  if (error || !data) {
    // Fall back to environment variables
    const envSettings = getEnvSettings();
    if (envSettings) {
      settingsCache = envSettings;
      settingsCacheTime = now;
      return envSettings;
    }
    return null;
  }

  // Decrypt the password
  const settings: EmailSettings = {
    ...data,
    smtp_password: decrypt(data.smtp_password),
  };

  settingsCache = settings;
  settingsCacheTime = now;

  return settings;
}

/**
 * Get settings from environment variables (fallback)
 */
function getEnvSettings(): EmailSettings | null {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const password = process.env.SMTP_PASSWORD;
  const fromEmail = process.env.SMTP_FROM;

  if (!host || !user || !password || !fromEmail) {
    return null;
  }

  return {
    id: "env-fallback",
    smtp_host: host,
    smtp_port: parseInt(process.env.SMTP_PORT || "587", 10),
    smtp_user: user,
    smtp_password: password,
    smtp_from_email: fromEmail,
    smtp_from_name: process.env.SMTP_FROM_NAME || "CNC Design Library",
    smtp_secure: process.env.SMTP_SECURE === "true",
    is_active: true,
    last_tested_at: null,
    last_test_success: null,
    last_test_error: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

/**
 * Get email settings for public display (with masked password)
 */
export async function getEmailSettingsPublic(): Promise<EmailSettingsPublic | null> {
  const settings = await getEmailSettings();

  if (!settings) {
    return null;
  }

  return {
    ...settings,
    smtp_password_masked: maskPassword(settings.smtp_password),
  };
}

/**
 * Check if settings are from environment (not database)
 */
export async function isUsingEnvSettings(): Promise<boolean> {
  const settings = await getEmailSettings();
  return settings?.id === "env-fallback";
}

/**
 * Update or create email settings
 */
export async function updateEmailSettings(
  input: UpdateEmailSettingsInput
): Promise<EmailSettings> {
  const supabase = createServiceClient();

  // Get existing settings
  const existing = await getEmailSettings();

  // Prepare the data
  const settingsData = {
    smtp_host: input.smtp_host,
    smtp_port: input.smtp_port,
    smtp_user: input.smtp_user,
    smtp_from_email: input.smtp_from_email,
    smtp_from_name: input.smtp_from_name,
    smtp_secure: input.smtp_secure,
    is_active: true,
    // Only update password if provided
    ...(input.smtp_password && {
      smtp_password: encrypt(input.smtp_password),
    }),
  };

  let result;

  if (existing && existing.id !== "env-fallback") {
    // Update existing
    const { data, error } = await supabase
      .from("email_settings")
      .update(settingsData)
      .eq("id", existing.id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update email settings: ${error.message}`);
    }
    result = data;
  } else {
    // Insert new - need password for new settings
    if (!input.smtp_password) {
      throw new Error("Password is required for new email settings");
    }

    const { data, error } = await supabase
      .from("email_settings")
      .insert({
        ...settingsData,
        smtp_password: encrypt(input.smtp_password),
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create email settings: ${error.message}`);
    }
    result = data;
  }

  // Clear cache
  clearEmailSettingsCache();

  // Return with decrypted password
  return {
    ...result,
    smtp_password: decrypt(result.smtp_password),
  };
}

/**
 * Test SMTP connection with given or stored settings
 */
export async function testSmtpConnection(
  settings?: UpdateEmailSettingsInput
): Promise<TestConnectionResult> {
  let smtp: {
    host: string;
    port: number;
    user: string;
    password: string;
    secure: boolean;
  };

  if (settings) {
    // Use provided settings
    if (!settings.smtp_password) {
      // Try to get existing password
      const existing = await getEmailSettings();
      if (!existing) {
        return {
          success: false,
          message: "Password is required to test connection",
        };
      }
      smtp = {
        host: settings.smtp_host,
        port: settings.smtp_port,
        user: settings.smtp_user,
        password: existing.smtp_password,
        secure: settings.smtp_secure,
      };
    } else {
      smtp = {
        host: settings.smtp_host,
        port: settings.smtp_port,
        user: settings.smtp_user,
        password: settings.smtp_password,
        secure: settings.smtp_secure,
      };
    }
  } else {
    // Use stored settings
    const stored = await getEmailSettings();
    if (!stored) {
      return {
        success: false,
        message: "No email settings configured",
      };
    }
    smtp = {
      host: stored.smtp_host,
      port: stored.smtp_port,
      user: stored.smtp_user,
      password: stored.smtp_password,
      secure: stored.smtp_secure,
    };
  }

  // Create transporter
  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: {
      user: smtp.user,
      pass: smtp.password,
    },
    connectionTimeout: 10000,
    socketTimeout: 10000,
  });

  try {
    // Verify connection
    await transporter.verify();

    // Update last test status in database
    await updateTestStatus(true, null);

    return {
      success: true,
      message: "SMTP connection successful",
      details: {
        host: smtp.host,
        port: smtp.port,
        secure: smtp.secure,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    // Update last test status in database
    await updateTestStatus(false, errorMessage);

    return {
      success: false,
      message: `SMTP connection failed: ${errorMessage}`,
      details: {
        host: smtp.host,
        port: smtp.port,
        secure: smtp.secure,
      },
    };
  } finally {
    transporter.close();
  }
}

/**
 * Update the last test status in the database
 */
async function updateTestStatus(
  success: boolean,
  error: string | null
): Promise<void> {
  const supabase = createServiceClient();

  const { error: updateError } = await supabase
    .from("email_settings")
    .update({
      last_tested_at: new Date().toISOString(),
      last_test_success: success,
      last_test_error: error,
    })
    .eq("is_active", true);

  if (updateError) {
    console.error("Failed to update test status:", updateError);
  }

  // Clear cache to reflect new test status
  clearEmailSettingsCache();
}

/**
 * Send a test email to verify the configuration
 */
export async function sendTestEmail(
  toEmail: string,
  settings?: UpdateEmailSettingsInput
): Promise<SendTestEmailResult> {
  let smtp: EmailSettings;

  if (settings) {
    // Use provided settings
    const existing = await getEmailSettings();
    const password = settings.smtp_password || existing?.smtp_password;

    if (!password) {
      return {
        success: false,
        message: "Password is required to send test email",
      };
    }

    smtp = {
      id: "test",
      smtp_host: settings.smtp_host,
      smtp_port: settings.smtp_port,
      smtp_user: settings.smtp_user,
      smtp_password: password,
      smtp_from_email: settings.smtp_from_email,
      smtp_from_name: settings.smtp_from_name,
      smtp_secure: settings.smtp_secure,
      is_active: true,
      last_tested_at: null,
      last_test_success: null,
      last_test_error: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  } else {
    // Use stored settings
    const stored = await getEmailSettings();
    if (!stored) {
      return {
        success: false,
        message: "No email settings configured",
      };
    }
    smtp = stored;
  }

  // Create transporter
  const transporter = nodemailer.createTransport({
    host: smtp.smtp_host,
    port: smtp.smtp_port,
    secure: smtp.smtp_secure,
    auth: {
      user: smtp.smtp_user,
      pass: smtp.smtp_password,
    },
  });

  try {
    const info = await transporter.sendMail({
      from: `"${smtp.smtp_from_name}" <${smtp.smtp_from_email}>`,
      to: toEmail,
      subject: "Test Email from CNC Design Library",
      text: `This is a test email from CNC Design Library.

If you received this email, your SMTP settings are configured correctly.

Sent at: ${new Date().toISOString()}
SMTP Host: ${smtp.smtp_host}
From: ${smtp.smtp_from_email}`,
      html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    h1 { color: #2563eb; margin-top: 0; }
    .success { color: #22c55e; font-weight: bold; }
    .info { background: #f0f9ff; border-left: 4px solid #2563eb; padding: 16px; margin: 20px 0; border-radius: 4px; }
    .footer { color: #6b7280; font-size: 14px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Test Email Successful!</h1>
    <p class="success">Your SMTP settings are configured correctly.</p>
    <div class="info">
      <strong>Configuration Details:</strong><br>
      SMTP Host: ${smtp.smtp_host}<br>
      Port: ${smtp.smtp_port}<br>
      From: ${smtp.smtp_from_email}
    </div>
    <div class="footer">
      Sent at: ${new Date().toLocaleString()}<br>
      CNC Design Library Email Test
    </div>
  </div>
</body>
</html>`,
    });

    return {
      success: true,
      message: `Test email sent successfully to ${toEmail}`,
      messageId: info.messageId,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    return {
      success: false,
      message: `Failed to send test email: ${errorMessage}`,
    };
  } finally {
    transporter.close();
  }
}

/**
 * Delete email settings (revert to environment variables)
 */
export async function deleteEmailSettings(): Promise<void> {
  const supabase = createServiceClient();

  const { error } = await supabase
    .from("email_settings")
    .delete()
    .eq("is_active", true);

  if (error) {
    throw new Error(`Failed to delete email settings: ${error.message}`);
  }

  clearEmailSettingsCache();
}
