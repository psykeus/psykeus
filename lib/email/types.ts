/**
 * Email service types and interfaces
 */

export type EmailType =
  | "welcome"
  | "subscription_confirmation"
  | "subscription_expiring"
  | "download_limit_warning"
  | "account_status_change"
  | "import_completion"
  | "admin_broadcast";

export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  fromName: string;
  fromEmail: string;
}

export interface EmailRecipient {
  userId: string;
  email: string;
  name?: string;
}

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface SendEmailOptions {
  recipient: EmailRecipient;
  type: EmailType;
  subject: string;
  html: string;
  text?: string;
  skipPreferenceCheck?: boolean; // For critical emails like password reset
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// Template data types
export interface WelcomeEmailData {
  userName: string;
  loginUrl: string;
}

export interface SubscriptionConfirmationData {
  userName: string;
  tierName: string;
  tierDescription?: string;
  amount?: string;
  nextBillingDate?: string;
  manageSubscriptionUrl: string;
}

export interface SubscriptionExpiringData {
  userName: string;
  tierName: string;
  expirationDate: string;
  renewUrl: string;
}

export interface DownloadLimitWarningData {
  userName: string;
  currentUsage: number;
  limit: number;
  percentUsed: number;
  upgradeUrl: string;
}

export interface AccountStatusChangeData {
  userName: string;
  status: "suspended" | "reactivated" | "role_changed";
  reason?: string;
  newRole?: string;
  contactEmail: string;
}

export interface ImportCompletionData {
  userName: string;
  jobName: string;
  totalItems: number;
  successCount: number;
  failedCount: number;
  skippedCount: number;
  viewJobUrl: string;
}

export interface AdminBroadcastData {
  title: string;
  message: string;
  actionUrl?: string;
  actionLabel?: string;
}

export type EmailTemplateData =
  | WelcomeEmailData
  | SubscriptionConfirmationData
  | SubscriptionExpiringData
  | DownloadLimitWarningData
  | AccountStatusChangeData
  | ImportCompletionData
  | AdminBroadcastData;
