/**
 * Notification service types
 */

export type NotificationType =
  | "system"
  | "account"
  | "subscription"
  | "download"
  | "import"
  | "admin_broadcast";

export type NotificationPriority = "low" | "normal" | "high" | "urgent";

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  actionUrl?: string;
  actionLabel?: string;
  isRead: boolean;
  readAt?: string;
  expiresAt?: string;
  metadata?: Record<string, unknown>;
  broadcastId?: string;
  createdAt: string;
}

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  priority?: NotificationPriority;
  title: string;
  message: string;
  actionUrl?: string;
  actionLabel?: string;
  expiresAt?: string;
  metadata?: Record<string, unknown>;
  broadcastId?: string;
}

export interface ListNotificationsOptions {
  userId: string;
  limit?: number;
  offset?: number;
  unreadOnly?: boolean;
  type?: NotificationType;
}

export interface NotificationListResult {
  notifications: Notification[];
  total: number;
  unreadCount: number;
}

export interface AdminBroadcast {
  id: string;
  title: string;
  message: string;
  targetAudience: "all" | "admins" | "subscribers" | "free";
  targetTierIds?: string[];
  scheduledAt?: string;
  sentAt?: string;
  recipientsCount: number;
  readCount: number;
  actionUrl?: string;
  actionLabel?: string;
  priority: NotificationPriority;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBroadcastInput {
  title: string;
  message: string;
  targetAudience?: "all" | "admins" | "subscribers" | "free";
  targetTierIds?: string[];
  scheduledAt?: string;
  actionUrl?: string;
  actionLabel?: string;
  priority?: NotificationPriority;
  createdBy: string;
  sendEmail?: boolean;
}

export interface BroadcastResult {
  broadcastId: string;
  recipientsCount: number;
  emailsSent?: number;
}
