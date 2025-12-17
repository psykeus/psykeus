/**
 * Email service exports
 */

export * from "./types";
export * from "./unsubscribe";
export {
  isEmailEnabled,
  sendWelcomeEmail,
  sendSubscriptionConfirmationEmail,
  sendSubscriptionExpiringEmail,
  sendDownloadLimitWarningEmail,
  sendAccountStatusChangeEmail,
  sendImportCompletionEmail,
  sendAdminBroadcastEmail,
  verifySmtpConnection,
} from "./email-service";
