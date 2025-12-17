/**
 * Email service using Nodemailer with SMTP
 * Supports both database-stored settings and environment variable fallback
 */

import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { createServiceClient } from "@/lib/supabase/server";
import { getUnsubscribeUrl } from "./unsubscribe";
import { getEmailSettings, clearEmailSettingsCache } from "./email-settings-service";
import {
  welcomeEmail,
  welcomeEmailText,
  subscriptionConfirmationEmail,
  subscriptionConfirmationEmailText,
  subscriptionExpiringEmail,
  subscriptionExpiringEmailText,
  downloadLimitWarningEmail,
  downloadLimitWarningEmailText,
  accountStatusChangeEmail,
  accountStatusChangeEmailText,
  importCompletionEmail,
  importCompletionEmailText,
  adminBroadcastEmail,
  adminBroadcastEmailText,
} from "./templates";
import type {
  EmailType,
  EmailConfig,
  EmailRecipient,
  SendEmailResult,
  WelcomeEmailData,
  SubscriptionConfirmationData,
  SubscriptionExpiringData,
  DownloadLimitWarningData,
  AccountStatusChangeData,
  ImportCompletionData,
  AdminBroadcastData,
} from "./types";

// Cache for email config
let cachedConfig: EmailConfig | null = null;
let configCacheTime = 0;
const CONFIG_CACHE_TTL = 300000; // 5 minutes

/**
 * Get email configuration - tries database first, falls back to environment variables
 */
async function getEmailConfigAsync(): Promise<EmailConfig | null> {
  const now = Date.now();

  // Return cached config if valid
  if (cachedConfig && now - configCacheTime < CONFIG_CACHE_TTL) {
    return cachedConfig;
  }

  // Try to get settings from database
  try {
    const dbSettings = await getEmailSettings();
    if (dbSettings) {
      cachedConfig = {
        host: dbSettings.smtp_host,
        port: dbSettings.smtp_port,
        secure: dbSettings.smtp_secure,
        auth: {
          user: dbSettings.smtp_user,
          pass: dbSettings.smtp_password,
        },
        fromName: dbSettings.smtp_from_name,
        fromEmail: dbSettings.smtp_from_email,
      };
      configCacheTime = now;
      return cachedConfig;
    }
  } catch (error) {
    console.warn("[Email] Failed to load settings from database, using env vars:", error);
  }

  // Fallback to environment variables
  return getEmailConfigFromEnv();
}

/**
 * Get email configuration from environment variables (synchronous fallback)
 */
function getEmailConfigFromEnv(): EmailConfig | null {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  const fromName = process.env.SMTP_FROM_NAME || "CNC Design Library";
  const fromEmail = process.env.SMTP_FROM_EMAIL;

  if (!host || !user || !pass || !fromEmail) {
    return null;
  }

  return {
    host,
    port,
    secure: process.env.SMTP_SECURE === "true",
    auth: { user, pass },
    fromName,
    fromEmail,
  };
}

/**
 * Clear the email config cache (call when settings are updated)
 */
export function clearEmailConfigCache(): void {
  cachedConfig = null;
  configCacheTime = 0;
  transporter = null;
  clearEmailSettingsCache();
}

let transporter: Transporter | null = null;
let transporterConfigHash: string | null = null;

/**
 * Get or create the Nodemailer transporter
 */
async function getTransporterAsync(): Promise<Transporter | null> {
  const config = await getEmailConfigAsync();
  if (!config) {
    console.warn("[Email] SMTP not configured - emails will be skipped");
    return null;
  }

  // Create a hash of config to detect changes
  const configHash = `${config.host}:${config.port}:${config.auth.user}:${config.secure}`;

  // Recreate transporter if config changed
  if (transporter && transporterConfigHash === configHash) {
    return transporter;
  }

  transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth,
  });
  transporterConfigHash = configHash;

  return transporter;
}

/**
 * Check if email is enabled (async version)
 */
export async function isEmailEnabledAsync(): Promise<boolean> {
  const config = await getEmailConfigAsync();
  return config !== null;
}

/**
 * Check if email is enabled (sync version for backwards compatibility)
 */
export function isEmailEnabled(): boolean {
  // Check cached config or env vars synchronously
  if (cachedConfig) return true;
  return getEmailConfigFromEnv() !== null;
}

/**
 * Check if user has opted into receiving a specific email type
 */
async function canSendToUser(
  userId: string,
  emailType: EmailType
): Promise<boolean> {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase.rpc("can_send_email", {
      user_uuid: userId,
      email_type_name: emailType,
    });

    if (error) {
      console.error("[Email] Error checking email preferences:", error);
      return true; // Default to allowing if check fails
    }

    return data ?? true;
  } catch (err) {
    console.error("[Email] Error checking email preferences:", err);
    return true;
  }
}

/**
 * Log email to database
 */
async function logEmail(params: {
  userId?: string;
  recipientEmail: string;
  emailType: EmailType;
  subject: string;
  status: "pending" | "sent" | "failed";
  messageId?: string;
  error?: string;
}): Promise<void> {
  try {
    const supabase = createServiceClient();
    await supabase.from("email_logs").insert({
      user_id: params.userId || null,
      recipient_email: params.recipientEmail,
      email_type: params.emailType,
      subject: params.subject,
      status: params.status,
      smtp_message_id: params.messageId || null,
      error_message: params.error || null,
      sent_at: params.status === "sent" ? new Date().toISOString() : null,
    });
  } catch (err) {
    console.error("[Email] Failed to log email:", err);
  }
}

/**
 * Send an email
 */
async function sendEmail(params: {
  recipient: EmailRecipient;
  type: EmailType;
  subject: string;
  html: string;
  text?: string;
  skipPreferenceCheck?: boolean;
}): Promise<SendEmailResult> {
  const { recipient, type, subject, html, text, skipPreferenceCheck } = params;
  const config = await getEmailConfigAsync();
  const transport = await getTransporterAsync();

  if (!config || !transport) {
    console.warn(`[Email] Skipping email to ${recipient.email} - SMTP not configured`);
    return { success: false, error: "SMTP not configured" };
  }

  // Check user preferences
  if (!skipPreferenceCheck && recipient.userId) {
    const canSend = await canSendToUser(recipient.userId, type);
    if (!canSend) {
      console.log(`[Email] User ${recipient.userId} has opted out of ${type} emails`);
      return { success: false, error: "User opted out" };
    }
  }

  // Log as pending
  await logEmail({
    userId: recipient.userId,
    recipientEmail: recipient.email,
    emailType: type,
    subject,
    status: "pending",
  });

  try {
    const result = await transport.sendMail({
      from: `"${config.fromName}" <${config.fromEmail}>`,
      to: recipient.name
        ? `"${recipient.name}" <${recipient.email}>`
        : recipient.email,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, ""), // Fallback to stripped HTML
    });

    // Log as sent
    await logEmail({
      userId: recipient.userId,
      recipientEmail: recipient.email,
      emailType: type,
      subject,
      status: "sent",
      messageId: result.messageId,
    });

    console.log(`[Email] Sent ${type} email to ${recipient.email}`);
    return { success: true, messageId: result.messageId };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";

    // Log as failed
    await logEmail({
      userId: recipient.userId,
      recipientEmail: recipient.email,
      emailType: type,
      subject,
      status: "failed",
      error: errorMessage,
    });

    console.error(`[Email] Failed to send ${type} email to ${recipient.email}:`, err);
    return { success: false, error: errorMessage };
  }
}

// ============================================================================
// Public API - Send specific email types
// ============================================================================

export async function sendWelcomeEmail(
  recipient: EmailRecipient,
  data: WelcomeEmailData
): Promise<SendEmailResult> {
  const unsubscribeUrl = getUnsubscribeUrl(recipient.userId);
  return sendEmail({
    recipient,
    type: "welcome",
    subject: "Welcome to CNC Design Library!",
    html: welcomeEmail(data, unsubscribeUrl),
    text: welcomeEmailText(data),
  });
}

export async function sendSubscriptionConfirmationEmail(
  recipient: EmailRecipient,
  data: SubscriptionConfirmationData
): Promise<SendEmailResult> {
  const unsubscribeUrl = getUnsubscribeUrl(recipient.userId);
  return sendEmail({
    recipient,
    type: "subscription_confirmation",
    subject: `Subscription Confirmed - ${data.tierName}`,
    html: subscriptionConfirmationEmail(data, unsubscribeUrl),
    text: subscriptionConfirmationEmailText(data),
  });
}

export async function sendSubscriptionExpiringEmail(
  recipient: EmailRecipient,
  data: SubscriptionExpiringData
): Promise<SendEmailResult> {
  const unsubscribeUrl = getUnsubscribeUrl(recipient.userId);
  return sendEmail({
    recipient,
    type: "subscription_expiring",
    subject: "Your Subscription is Expiring Soon",
    html: subscriptionExpiringEmail(data, unsubscribeUrl),
    text: subscriptionExpiringEmailText(data),
  });
}

export async function sendDownloadLimitWarningEmail(
  recipient: EmailRecipient,
  data: DownloadLimitWarningData
): Promise<SendEmailResult> {
  const unsubscribeUrl = getUnsubscribeUrl(recipient.userId);
  return sendEmail({
    recipient,
    type: "download_limit_warning",
    subject: `Download Limit Warning - ${data.percentUsed}% Used`,
    html: downloadLimitWarningEmail(data, unsubscribeUrl),
    text: downloadLimitWarningEmailText(data),
  });
}

export async function sendAccountStatusChangeEmail(
  recipient: EmailRecipient,
  data: AccountStatusChangeData
): Promise<SendEmailResult> {
  const unsubscribeUrl = getUnsubscribeUrl(recipient.userId);

  let subject: string;
  switch (data.status) {
    case "suspended":
      subject = "Account Suspended";
      break;
    case "reactivated":
      subject = "Account Reactivated";
      break;
    case "role_changed":
      subject = "Account Role Updated";
      break;
    default:
      subject = "Account Update";
  }

  return sendEmail({
    recipient,
    type: "account_status_change",
    subject,
    html: accountStatusChangeEmail(data, unsubscribeUrl),
    text: accountStatusChangeEmailText(data),
    skipPreferenceCheck: data.status === "suspended", // Always send suspension emails
  });
}

export async function sendImportCompletionEmail(
  recipient: EmailRecipient,
  data: ImportCompletionData
): Promise<SendEmailResult> {
  const unsubscribeUrl = getUnsubscribeUrl(recipient.userId);
  return sendEmail({
    recipient,
    type: "import_completion",
    subject: `Import Complete: ${data.jobName}`,
    html: importCompletionEmail(data, unsubscribeUrl),
    text: importCompletionEmailText(data),
  });
}

export async function sendAdminBroadcastEmail(
  recipient: EmailRecipient,
  data: AdminBroadcastData
): Promise<SendEmailResult> {
  const unsubscribeUrl = getUnsubscribeUrl(recipient.userId);
  return sendEmail({
    recipient,
    type: "admin_broadcast",
    subject: data.title,
    html: adminBroadcastEmail(data, unsubscribeUrl),
    text: adminBroadcastEmailText(data),
  });
}

/**
 * Verify SMTP connection (for health checks)
 */
export async function verifySmtpConnection(): Promise<boolean> {
  const transport = await getTransporterAsync();
  if (!transport) return false;

  try {
    await transport.verify();
    return true;
  } catch {
    return false;
  }
}
