/**
 * User Service
 *
 * Handles user-related data operations including dashboard stats,
 * tier management, and activity tracking.
 */

import { createServiceClient } from "@/lib/supabase/server";
import { escapeIlikePattern } from "@/lib/validations";
import type {
  User,
  UserWithTier,
  AccessTier,
  UserDashboardStats,
  DownloadLimitStatus,
} from "@/lib/types";

/**
 * Get a user with their access tier information
 */
export async function getUserWithTier(userId: string): Promise<UserWithTier | null> {
  const supabase = createServiceClient();

  const { data: user, error } = await supabase
    .from("users")
    .select(`
      *,
      access_tier:access_tiers(*)
    `)
    .eq("id", userId)
    .single();

  if (error || !user) {
    return null;
  }

  return user as UserWithTier;
}

/**
 * Get dashboard stats for a user using the database function
 */
export async function getUserDashboardStats(userId: string): Promise<UserDashboardStats | null> {
  const supabase = createServiceClient();

  const { data, error } = await supabase.rpc("get_user_dashboard_stats", {
    user_uuid: userId,
  });

  if (error) {
    console.error("[UserService] Error fetching dashboard stats:", error);
    return null;
  }

  return data as UserDashboardStats;
}

/**
 * Check if a user can download based on their tier limits
 */
export async function checkUserDownloadLimit(userId: string): Promise<DownloadLimitStatus> {
  const supabase = createServiceClient();

  const { data, error } = await supabase.rpc("check_user_download_limit", {
    user_uuid: userId,
  });

  if (error) {
    console.error("[UserService] Error checking download limit:", error);
    return {
      can_download: false,
      reason: "Error checking download limit",
      downloads_today: 0,
      downloads_this_month: 0,
      daily_limit: null,
      monthly_limit: null,
    };
  }

  return data as DownloadLimitStatus;
}

/**
 * Check if a user can access a specific design
 */
export async function canUserAccessDesign(
  userId: string,
  designId: string
): Promise<boolean> {
  const supabase = createServiceClient();

  const { data, error } = await supabase.rpc("can_user_access_design", {
    user_uuid: userId,
    design_uuid: designId,
  });

  if (error) {
    console.error("[UserService] Error checking design access:", error);
    return false;
  }

  return data as boolean;
}

/**
 * Get all active access tiers
 */
export async function getAccessTiers(): Promise<AccessTier[]> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("access_tiers")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("[UserService] Error fetching access tiers:", error);
    return [];
  }

  return data as AccessTier[];
}

/**
 * Update a user's tier (admin only)
 */
export async function updateUserTier(
  userId: string,
  tierId: string,
  expiresAt: string | null,
  grantedBy: string,
  reason?: string
): Promise<boolean> {
  const supabase = createServiceClient();

  // Get current tier for history
  const { data: currentUser } = await supabase
    .from("users")
    .select("tier_id")
    .eq("id", userId)
    .single();

  // Update user tier
  const { error: updateError } = await supabase
    .from("users")
    .update({
      tier_id: tierId,
      tier_expires_at: expiresAt,
    })
    .eq("id", userId);

  if (updateError) {
    console.error("[UserService] Error updating user tier:", updateError);
    return false;
  }

  // Record in subscription history
  const action = currentUser?.tier_id ? "upgrade" : "grant";
  await supabase.from("subscription_history").insert({
    user_id: userId,
    tier_id: tierId,
    action,
    previous_tier_id: currentUser?.tier_id,
    reason,
    granted_by: grantedBy,
    starts_at: new Date().toISOString(),
    expires_at: expiresAt,
  });

  return true;
}

/**
 * Suspend a user
 */
export async function suspendUser(
  userId: string,
  reason: string,
  suspendedBy: string
): Promise<boolean> {
  const supabase = createServiceClient();

  const { error } = await supabase
    .from("users")
    .update({
      status: "suspended",
      suspended_reason: reason,
      suspended_at: new Date().toISOString(),
      suspended_by: suspendedBy,
    })
    .eq("id", userId);

  if (error) {
    console.error("[UserService] Error suspending user:", error);
    return false;
  }

  // Delete all user sessions (force logout)
  await supabase.from("user_sessions").delete().eq("user_id", userId);

  // Log the action
  await supabase.from("audit_logs").insert({
    user_id: suspendedBy,
    action: "suspend",
    entity_type: "user",
    entity_id: userId,
    metadata: { reason },
  });

  return true;
}

/**
 * Unsuspend a user
 */
export async function unsuspendUser(userId: string, unsuspendedBy: string): Promise<boolean> {
  const supabase = createServiceClient();

  const { error } = await supabase
    .from("users")
    .update({
      status: "active",
      suspended_reason: null,
      suspended_at: null,
      suspended_by: null,
    })
    .eq("id", userId);

  if (error) {
    console.error("[UserService] Error unsuspending user:", error);
    return false;
  }

  // Log the action
  await supabase.from("audit_logs").insert({
    user_id: unsuspendedBy,
    action: "unsuspend",
    entity_type: "user",
    entity_id: userId,
  });

  return true;
}

/**
 * Ban a user (permanent)
 */
export async function banUser(
  userId: string,
  reason: string,
  bannedBy: string
): Promise<boolean> {
  const supabase = createServiceClient();

  const { error } = await supabase
    .from("users")
    .update({
      status: "banned",
      suspended_reason: reason,
      suspended_at: new Date().toISOString(),
      suspended_by: bannedBy,
    })
    .eq("id", userId);

  if (error) {
    console.error("[UserService] Error banning user:", error);
    return false;
  }

  // Delete all user sessions (force logout)
  await supabase.from("user_sessions").delete().eq("user_id", userId);

  // Log the action
  await supabase.from("audit_logs").insert({
    user_id: bannedBy,
    action: "ban",
    entity_type: "user",
    entity_id: userId,
    metadata: { reason },
  });

  return true;
}

/**
 * Pause a user account (user-requested temporary hold, e.g., vacation)
 */
export async function pauseUser(
  userId: string,
  reason: string,
  pausedBy: string
): Promise<boolean> {
  const supabase = createServiceClient();

  const { error } = await supabase
    .from("users")
    .update({
      status: "paused",
      paused_reason: reason,
      paused_at: new Date().toISOString(),
      paused_by: pausedBy,
      // Clear any previous suspended/disabled state
      suspended_reason: null,
      suspended_at: null,
      suspended_by: null,
      disabled_reason: null,
      disabled_at: null,
      disabled_by: null,
    })
    .eq("id", userId);

  if (error) {
    console.error("[UserService] Error pausing user:", error);
    return false;
  }

  // Log the action
  await supabase.from("audit_logs").insert({
    user_id: pausedBy,
    action: "pause",
    entity_type: "user",
    entity_id: userId,
    metadata: { reason },
  });

  return true;
}

/**
 * Unpause a user account (restore from paused state)
 */
export async function unpauseUser(userId: string, unpausedBy: string): Promise<boolean> {
  const supabase = createServiceClient();

  const { error } = await supabase
    .from("users")
    .update({
      status: "active",
      paused_reason: null,
      paused_at: null,
      paused_by: null,
    })
    .eq("id", userId);

  if (error) {
    console.error("[UserService] Error unpausing user:", error);
    return false;
  }

  // Log the action
  await supabase.from("audit_logs").insert({
    user_id: unpausedBy,
    action: "unpause",
    entity_type: "user",
    entity_id: userId,
  });

  return true;
}

/**
 * Disable a user account (admin-disabled, permanent until re-enabled)
 */
export async function disableUser(
  userId: string,
  reason: string,
  disabledBy: string
): Promise<boolean> {
  const supabase = createServiceClient();

  const { error } = await supabase
    .from("users")
    .update({
      status: "disabled",
      disabled_reason: reason,
      disabled_at: new Date().toISOString(),
      disabled_by: disabledBy,
      // Clear any previous paused state
      paused_reason: null,
      paused_at: null,
      paused_by: null,
    })
    .eq("id", userId);

  if (error) {
    console.error("[UserService] Error disabling user:", error);
    return false;
  }

  // Delete all user sessions (force logout)
  await supabase.from("user_sessions").delete().eq("user_id", userId);

  // Log the action
  await supabase.from("audit_logs").insert({
    user_id: disabledBy,
    action: "disable",
    entity_type: "user",
    entity_id: userId,
    metadata: { reason },
  });

  return true;
}

/**
 * Enable a user account (restore from disabled state)
 */
export async function enableUser(userId: string, enabledBy: string): Promise<boolean> {
  const supabase = createServiceClient();

  const { error } = await supabase
    .from("users")
    .update({
      status: "active",
      disabled_reason: null,
      disabled_at: null,
      disabled_by: null,
    })
    .eq("id", userId);

  if (error) {
    console.error("[UserService] Error enabling user:", error);
    return false;
  }

  // Log the action
  await supabase.from("audit_logs").insert({
    user_id: enabledBy,
    action: "enable",
    entity_type: "user",
    entity_id: userId,
  });

  return true;
}

/**
 * Activate a user (restore from any non-active state)
 * This is a generic restore function that clears all status-related fields
 */
export async function activateUser(userId: string, activatedBy: string): Promise<boolean> {
  const supabase = createServiceClient();

  // Get current status to determine what we're restoring from
  const { data: currentUser } = await supabase
    .from("users")
    .select("status")
    .eq("id", userId)
    .single();

  const { error } = await supabase
    .from("users")
    .update({
      status: "active",
      paused_reason: null,
      paused_at: null,
      paused_by: null,
      disabled_reason: null,
      disabled_at: null,
      disabled_by: null,
      suspended_reason: null,
      suspended_at: null,
      suspended_by: null,
    })
    .eq("id", userId);

  if (error) {
    console.error("[UserService] Error activating user:", error);
    return false;
  }

  // Log the action with previous status
  await supabase.from("audit_logs").insert({
    user_id: activatedBy,
    action: "activate",
    entity_type: "user",
    entity_id: userId,
    metadata: { previous_status: currentUser?.status },
  });

  return true;
}

/**
 * Send password reset email using Supabase Auth
 */
export async function sendPasswordReset(
  email: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServiceClient();

  // Get the site URL from environment
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/auth/callback?type=recovery`,
  });

  if (error) {
    console.error("[UserService] Error sending password reset:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Log user activity
 */
export async function logUserActivity(
  userId: string,
  activityType: string,
  entityType?: string,
  entityId?: string,
  metadata?: Record<string, unknown>,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  const supabase = createServiceClient();

  await supabase.from("user_activity").insert({
    user_id: userId,
    activity_type: activityType,
    entity_type: entityType,
    entity_id: entityId,
    metadata,
    ip_address: ipAddress,
    user_agent: userAgent?.slice(0, 500),
  });
}

/**
 * Get user's recent activity
 */
export async function getUserActivity(
  userId: string,
  limit: number = 20
): Promise<Array<{
  id: string;
  activity_type: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}>> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("user_activity")
    .select("id, activity_type, entity_type, entity_id, metadata, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[UserService] Error fetching user activity:", error);
    return [];
  }

  return data || [];
}

/**
 * Get list of users for admin management
 */
export async function getUsers(options: {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  tierId?: string;
  role?: string;
}): Promise<{
  users: UserWithTier[];
  total: number;
}> {
  const supabase = createServiceClient();
  const { page = 1, pageSize = 20, search, status, tierId, role } = options;

  let query = supabase
    .from("users")
    .select(`
      *,
      access_tier:access_tiers(*)
    `, { count: "exact" });

  if (search) {
    const escapedSearch = escapeIlikePattern(search);
    query = query.or(`email.ilike.%${escapedSearch}%,name.ilike.%${escapedSearch}%`);
  }

  if (status) {
    query = query.eq("status", status);
  }

  if (tierId) {
    query = query.eq("tier_id", tierId);
  }

  if (role) {
    query = query.eq("role", role);
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    console.error("[UserService] Error fetching users:", error);
    return { users: [], total: 0 };
  }

  return {
    users: data as UserWithTier[],
    total: count || 0,
  };
}
