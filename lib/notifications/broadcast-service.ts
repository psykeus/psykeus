/**
 * Broadcast service - Admin bulk notification system
 */

import { createServiceClient } from "@/lib/supabase/server";
import { createNotificationsForUsers } from "./notification-service";
import { sendAdminBroadcastEmail, isEmailEnabled } from "@/lib/email";
import type {
  AdminBroadcast,
  CreateBroadcastInput,
  BroadcastResult,
} from "./types";

/**
 * Map database row to AdminBroadcast type
 */
function mapToBroadcast(row: Record<string, unknown>): AdminBroadcast {
  return {
    id: row.id as string,
    title: row.title as string,
    message: row.message as string,
    targetAudience: row.target_audience as AdminBroadcast["targetAudience"],
    targetTierIds: row.target_tier_ids as string[] | undefined,
    scheduledAt: row.scheduled_at as string | undefined,
    sentAt: row.sent_at as string | undefined,
    recipientsCount: row.recipients_count as number,
    readCount: row.read_count as number,
    actionUrl: row.action_url as string | undefined,
    actionLabel: row.action_label as string | undefined,
    priority: row.priority as AdminBroadcast["priority"],
    createdBy: row.created_by as string | undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

/**
 * Get target user IDs based on audience criteria
 */
async function getTargetUserIds(
  targetAudience: "all" | "admins" | "subscribers" | "free",
  targetTierIds?: string[]
): Promise<{ id: string; email: string; name?: string }[]> {
  const supabase = createServiceClient();

  let query = supabase.from("users").select("id, email, name");

  switch (targetAudience) {
    case "admins":
      query = query.in("role", ["admin", "super_admin"]);
      break;
    case "subscribers":
      // Users with a paid tier (not free)
      if (targetTierIds && targetTierIds.length > 0) {
        query = query.in("access_tier_id", targetTierIds);
      } else {
        // Get all non-free tier users
        const { data: freeTier } = await supabase
          .from("access_tiers")
          .select("id")
          .eq("name", "Free")
          .single();

        if (freeTier) {
          query = query.not("access_tier_id", "eq", freeTier.id);
        }
      }
      break;
    case "free":
      // Users on free tier
      const { data: freeTierData } = await supabase
        .from("access_tiers")
        .select("id")
        .eq("name", "Free")
        .single();

      if (freeTierData) {
        query = query.or(`access_tier_id.eq.${freeTierData.id},access_tier_id.is.null`);
      }
      break;
    case "all":
    default:
      // No filter - all users
      break;
  }

  const { data, error } = await query;

  if (error) {
    console.error("[Broadcast] Error getting target users:", error);
    return [];
  }

  return (data || []) as { id: string; email: string; name?: string }[];
}

/**
 * Create a new broadcast
 */
export async function createBroadcast(
  input: CreateBroadcastInput
): Promise<AdminBroadcast | null> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("admin_broadcasts")
    .insert({
      title: input.title,
      message: input.message,
      target_audience: input.targetAudience || "all",
      target_tier_ids: input.targetTierIds || null,
      scheduled_at: input.scheduledAt || null,
      action_url: input.actionUrl || null,
      action_label: input.actionLabel || null,
      priority: input.priority || "normal",
      created_by: input.createdBy,
    })
    .select()
    .single();

  if (error) {
    console.error("[Broadcast] Error creating broadcast:", error);
    return null;
  }

  return mapToBroadcast(data);
}

/**
 * Send a broadcast immediately
 */
export async function sendBroadcast(
  broadcastId: string,
  sendEmails: boolean = false
): Promise<BroadcastResult | null> {
  const supabase = createServiceClient();

  // Get the broadcast
  const { data: broadcast, error: fetchError } = await supabase
    .from("admin_broadcasts")
    .select("*")
    .eq("id", broadcastId)
    .single();

  if (fetchError || !broadcast) {
    console.error("[Broadcast] Broadcast not found:", fetchError);
    return null;
  }

  // Get target users
  const targetUsers = await getTargetUserIds(
    broadcast.target_audience,
    broadcast.target_tier_ids
  );

  if (targetUsers.length === 0) {
    console.warn("[Broadcast] No target users found");
    return { broadcastId, recipientsCount: 0 };
  }

  // Create in-app notifications
  const notificationCount = await createNotificationsForUsers(
    targetUsers.map((u) => u.id),
    {
      type: "admin_broadcast",
      priority: broadcast.priority,
      title: broadcast.title,
      message: broadcast.message,
      actionUrl: broadcast.action_url,
      actionLabel: broadcast.action_label,
      broadcastId,
    }
  );

  // Send emails if requested and enabled
  let emailsSent = 0;
  if (sendEmails && isEmailEnabled()) {
    const emailPromises = targetUsers.map(async (user) => {
      try {
        const result = await sendAdminBroadcastEmail(
          {
            userId: user.id,
            email: user.email,
            name: user.name,
          },
          {
            title: broadcast.title,
            message: broadcast.message,
            actionUrl: broadcast.action_url,
            actionLabel: broadcast.action_label,
          }
        );
        return result.success ? 1 : 0;
      } catch {
        return 0;
      }
    });

    const results = await Promise.all(emailPromises);
    emailsSent = results.reduce<number>((sum, r) => sum + r, 0);
  }

  // Update broadcast record
  await supabase
    .from("admin_broadcasts")
    .update({
      sent_at: new Date().toISOString(),
      recipients_count: notificationCount,
    })
    .eq("id", broadcastId);

  console.log(
    `[Broadcast] Sent broadcast ${broadcastId} to ${notificationCount} users, ${emailsSent} emails`
  );

  return {
    broadcastId,
    recipientsCount: notificationCount,
    emailsSent,
  };
}

/**
 * List all broadcasts (for admin view)
 */
export async function listBroadcasts(
  limit: number = 20,
  offset: number = 0
): Promise<{ broadcasts: AdminBroadcast[]; total: number }> {
  const supabase = createServiceClient();

  const { data, error, count } = await supabase
    .from("admin_broadcasts")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("[Broadcast] Error listing broadcasts:", error);
    return { broadcasts: [], total: 0 };
  }

  return {
    broadcasts: (data || []).map(mapToBroadcast),
    total: count || 0,
  };
}

/**
 * Get a single broadcast by ID
 */
export async function getBroadcast(broadcastId: string): Promise<AdminBroadcast | null> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("admin_broadcasts")
    .select("*")
    .eq("id", broadcastId)
    .single();

  if (error) {
    console.error("[Broadcast] Error getting broadcast:", error);
    return null;
  }

  return mapToBroadcast(data);
}

/**
 * Delete a broadcast (only if not sent)
 */
export async function deleteBroadcast(broadcastId: string): Promise<boolean> {
  const supabase = createServiceClient();

  // Check if already sent
  const { data: broadcast } = await supabase
    .from("admin_broadcasts")
    .select("sent_at")
    .eq("id", broadcastId)
    .single();

  if (broadcast?.sent_at) {
    console.error("[Broadcast] Cannot delete already-sent broadcast");
    return false;
  }

  const { error } = await supabase
    .from("admin_broadcasts")
    .delete()
    .eq("id", broadcastId);

  if (error) {
    console.error("[Broadcast] Error deleting broadcast:", error);
    return false;
  }

  return true;
}

/**
 * Update broadcast read count (call when user reads notification)
 */
export async function incrementBroadcastReadCount(broadcastId: string): Promise<void> {
  const supabase = createServiceClient();

  await supabase.rpc("increment", {
    table_name: "admin_broadcasts",
    row_id: broadcastId,
    column_name: "read_count",
  });
}

/**
 * Get pending scheduled broadcasts
 */
export async function getPendingScheduledBroadcasts(): Promise<AdminBroadcast[]> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("admin_broadcasts")
    .select("*")
    .is("sent_at", null)
    .not("scheduled_at", "is", null)
    .lte("scheduled_at", new Date().toISOString());

  if (error) {
    console.error("[Broadcast] Error getting pending broadcasts:", error);
    return [];
  }

  return (data || []).map(mapToBroadcast);
}
