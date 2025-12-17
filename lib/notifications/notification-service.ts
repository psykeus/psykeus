/**
 * Notification service - CRUD operations for user notifications
 */

import { createServiceClient } from "@/lib/supabase/server";
import type {
  Notification,
  CreateNotificationInput,
  ListNotificationsOptions,
  NotificationListResult,
} from "./types";

/**
 * Map database row to Notification type
 */
function mapToNotification(row: Record<string, unknown>): Notification {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    type: row.type as Notification["type"],
    priority: row.priority as Notification["priority"],
    title: row.title as string,
    message: row.message as string,
    actionUrl: row.action_url as string | undefined,
    actionLabel: row.action_label as string | undefined,
    isRead: row.is_read as boolean,
    readAt: row.read_at as string | undefined,
    expiresAt: row.expires_at as string | undefined,
    metadata: row.metadata as Record<string, unknown> | undefined,
    broadcastId: row.broadcast_id as string | undefined,
    createdAt: row.created_at as string,
  };
}

/**
 * Create a new notification for a user
 */
export async function createNotification(
  input: CreateNotificationInput
): Promise<Notification | null> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("notifications")
    .insert({
      user_id: input.userId,
      type: input.type,
      priority: input.priority || "normal",
      title: input.title,
      message: input.message,
      action_url: input.actionUrl || null,
      action_label: input.actionLabel || null,
      expires_at: input.expiresAt || null,
      metadata: input.metadata || {},
      broadcast_id: input.broadcastId || null,
    })
    .select()
    .single();

  if (error) {
    console.error("[Notifications] Error creating notification:", error);
    return null;
  }

  return mapToNotification(data);
}

/**
 * Create notifications for multiple users
 */
export async function createNotificationsForUsers(
  userIds: string[],
  input: Omit<CreateNotificationInput, "userId">
): Promise<number> {
  if (userIds.length === 0) return 0;

  const supabase = createServiceClient();

  const notifications = userIds.map((userId) => ({
    user_id: userId,
    type: input.type,
    priority: input.priority || "normal",
    title: input.title,
    message: input.message,
    action_url: input.actionUrl || null,
    action_label: input.actionLabel || null,
    expires_at: input.expiresAt || null,
    metadata: input.metadata || {},
    broadcast_id: input.broadcastId || null,
  }));

  const { error, data } = await supabase
    .from("notifications")
    .insert(notifications)
    .select("id");

  if (error) {
    console.error("[Notifications] Error creating bulk notifications:", error);
    return 0;
  }

  return data?.length ?? notifications.length;
}

/**
 * Get notifications for a user
 */
export async function listNotifications(
  options: ListNotificationsOptions
): Promise<NotificationListResult> {
  const supabase = createServiceClient();
  const { userId, limit = 20, offset = 0, unreadOnly = false, type } = options;

  // Build query
  let query = supabase
    .from("notifications")
    .select("*", { count: "exact" })
    .eq("user_id", userId)
    .or("expires_at.is.null,expires_at.gt.now()")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (unreadOnly) {
    query = query.eq("is_read", false);
  }

  if (type) {
    query = query.eq("type", type);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error("[Notifications] Error listing notifications:", error);
    return { notifications: [], total: 0, unreadCount: 0 };
  }

  // Get unread count separately
  const { count: unreadCount } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_read", false)
    .or("expires_at.is.null,expires_at.gt.now()");

  return {
    notifications: (data || []).map(mapToNotification),
    total: count || 0,
    unreadCount: unreadCount || 0,
  };
}

/**
 * Get a single notification by ID
 */
export async function getNotification(
  notificationId: string,
  userId: string
): Promise<Notification | null> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("id", notificationId)
    .eq("user_id", userId)
    .single();

  if (error) {
    console.error("[Notifications] Error getting notification:", error);
    return null;
  }

  return mapToNotification(data);
}

/**
 * Mark a notification as read
 */
export async function markNotificationAsRead(
  notificationId: string,
  userId: string
): Promise<boolean> {
  const supabase = createServiceClient();

  const { error } = await supabase
    .from("notifications")
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
    })
    .eq("id", notificationId)
    .eq("user_id", userId);

  if (error) {
    console.error("[Notifications] Error marking as read:", error);
    return false;
  }

  return true;
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllNotificationsAsRead(userId: string): Promise<number> {
  const supabase = createServiceClient();

  const { data, error } = await supabase.rpc("mark_all_notifications_read", {
    user_uuid: userId,
  });

  if (error) {
    console.error("[Notifications] Error marking all as read:", error);
    return 0;
  }

  return data || 0;
}

/**
 * Delete a notification
 */
export async function deleteNotification(
  notificationId: string,
  userId: string
): Promise<boolean> {
  const supabase = createServiceClient();

  const { error } = await supabase
    .from("notifications")
    .delete()
    .eq("id", notificationId)
    .eq("user_id", userId);

  if (error) {
    console.error("[Notifications] Error deleting notification:", error);
    return false;
  }

  return true;
}

/**
 * Get unread notification count for a user
 */
export async function getUnreadCount(userId: string): Promise<number> {
  const supabase = createServiceClient();

  const { data, error } = await supabase.rpc("get_unread_notification_count", {
    user_uuid: userId,
  });

  if (error) {
    console.error("[Notifications] Error getting unread count:", error);
    return 0;
  }

  return data || 0;
}

/**
 * Delete expired notifications (for cleanup jobs)
 */
export async function cleanupExpiredNotifications(): Promise<number> {
  const supabase = createServiceClient();

  const { data, error } = await supabase.rpc("cleanup_expired_notifications");

  if (error) {
    console.error("[Notifications] Error cleaning up expired:", error);
    return 0;
  }

  return data || 0;
}
