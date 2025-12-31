/**
 * Admin User Management API
 *
 * GET - Get single user details
 * PATCH - Update user (tier, status, role)
 *
 * Permission model:
 * - Admins can: view users, suspend/unsuspend, change tiers, force logout
 * - Super admins can: all of the above + change roles, ban users, modify other admins
 */

import { NextRequest, NextResponse } from "next/server";
import { isSuperAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import {
  getUserWithTier,
  updateUserTier,
  suspendUser,
  unsuspendUser,
  banUser,
  pauseUser,
  unpauseUser,
  disableUser,
  enableUser,
  activateUser,
  sendPasswordReset,
} from "@/lib/services/user-service";
import type { IdRouteParams } from "@/lib/types";
import {
  parseJsonBody,
  notFoundResponse,
  forbiddenResponse,
  handleDbError,
  requireAdminApi,
} from "@/lib/api/helpers";

export async function GET(request: NextRequest, { params }: IdRouteParams) {
  const adminResult = await requireAdminApi();
  if (adminResult.response) return adminResult.response;

  try {
    const { id } = await params;

    const user = await getUserWithTier(id);

    if (!user) {
      return notFoundResponse("User");
    }

    // Get additional stats
    const supabase = createServiceClient();

    const [downloads, favorites, collections, sessions] = await Promise.all([
      supabase
        .from("downloads")
        .select("*", { count: "exact", head: true })
        .eq("user_id", id),
      supabase
        .from("user_favorites")
        .select("*", { count: "exact", head: true })
        .eq("user_id", id),
      supabase
        .from("collections")
        .select("*", { count: "exact", head: true })
        .eq("user_id", id),
      supabase
        .from("user_sessions")
        .select("id, created_at, last_active_at, user_agent, ip_address")
        .eq("user_id", id)
        .order("last_active_at", { ascending: false }),
    ]);

    return NextResponse.json({
      user,
      stats: {
        totalDownloads: downloads.count || 0,
        totalFavorites: favorites.count || 0,
        totalCollections: collections.count || 0,
      },
      sessions: sessions.data || [],
    });
  } catch (error) {
    return handleDbError(error, "fetch user");
  }
}

export async function PATCH(request: NextRequest, { params }: IdRouteParams) {
  const adminResult = await requireAdminApi();
  if (adminResult.response) return adminResult.response;
  const admin = adminResult.user;

  try {
    const { id } = await params;

    const bodyResult = await parseJsonBody<Record<string, unknown>>(request);
    if (!bodyResult.success) return bodyResult.response!;

    const body = bodyResult.data!;
    const adminIsSuperAdmin = isSuperAdmin(admin);

    const supabase = createServiceClient();

    // Get current user
    const { data: targetUser } = await supabase
      .from("users")
      .select("id, email, role")
      .eq("id", id)
      .single();

    if (!targetUser) {
      return notFoundResponse("User");
    }

    // Prevent modifying other super_admins (only super_admin can modify themselves)
    if (targetUser.role === "super_admin" && targetUser.id !== admin.id) {
      return forbiddenResponse("Cannot modify other super admins");
    }

    // Regular admins cannot modify other admins
    if (!adminIsSuperAdmin && targetUser.role === "admin" && targetUser.id !== admin.id) {
      return forbiddenResponse("Only super admins can modify other admins");
    }

    const { action, ...updateData } = body;

    // Handle specific actions
    switch (action) {
      case "suspend": {
        const success = await suspendUser(id, updateData.reason as string || "No reason provided", admin.id);
        if (!success) {
          return handleDbError(null, "suspend user");
        }
        return NextResponse.json({ success: true, message: "User suspended" });
      }

      case "unsuspend": {
        const success = await unsuspendUser(id, admin.id);
        if (!success) {
          return handleDbError(null, "unsuspend user");
        }
        return NextResponse.json({ success: true, message: "User unsuspended" });
      }

      case "ban": {
        // Only super_admin can ban users
        if (!adminIsSuperAdmin) {
          return forbiddenResponse("Only super admins can ban users");
        }
        const success = await banUser(id, updateData.reason as string || "No reason provided", admin.id);
        if (!success) {
          return handleDbError(null, "ban user");
        }
        return NextResponse.json({ success: true, message: "User banned" });
      }

      case "pause": {
        const success = await pauseUser(id, updateData.reason as string || "User-requested pause", admin.id);
        if (!success) {
          return handleDbError(null, "pause user");
        }
        return NextResponse.json({ success: true, message: "User account paused" });
      }

      case "unpause": {
        const success = await unpauseUser(id, admin.id);
        if (!success) {
          return handleDbError(null, "unpause user");
        }
        return NextResponse.json({ success: true, message: "User account unpaused" });
      }

      case "disable": {
        const success = await disableUser(id, updateData.reason as string || "Admin disabled", admin.id);
        if (!success) {
          return handleDbError(null, "disable user");
        }
        return NextResponse.json({ success: true, message: "User account disabled" });
      }

      case "enable": {
        const success = await enableUser(id, admin.id);
        if (!success) {
          return handleDbError(null, "enable user");
        }
        return NextResponse.json({ success: true, message: "User account enabled" });
      }

      case "activate": {
        // Generic restore from any non-active state
        const success = await activateUser(id, admin.id);
        if (!success) {
          return handleDbError(null, "activate user");
        }
        return NextResponse.json({ success: true, message: "User account activated" });
      }

      case "send_password_reset": {
        const result = await sendPasswordReset(targetUser.email);
        if (!result.success) {
          return NextResponse.json(
            { error: result.error || "Failed to send password reset" },
            { status: 500 }
          );
        }
        return NextResponse.json({ success: true, message: "Password reset email sent" });
      }

      case "update_tier": {
        const success = await updateUserTier(
          id,
          updateData.tier_id as string,
          (updateData.expires_at as string) || null,
          admin.id,
          updateData.reason as string
        );
        if (!success) {
          return handleDbError(null, "update tier");
        }
        return NextResponse.json({ success: true, message: "Tier updated" });
      }

      case "update_role": {
        // Only super_admin can change roles
        if (!adminIsSuperAdmin) {
          return forbiddenResponse("Only super admins can change user roles");
        }

        // Only allow changing to/from user and admin roles
        if (!["user", "admin"].includes(updateData.role as string)) {
          return NextResponse.json(
            { error: "Invalid role. Only 'user' or 'admin' allowed." },
            { status: 400 }
          );
        }

        const { error } = await supabase
          .from("users")
          .update({ role: updateData.role })
          .eq("id", id);

        if (error) {
          return handleDbError(error, "update role");
        }

        // Log the action
        await supabase.from("audit_logs").insert({
          user_id: admin.id,
          action: "update_role",
          entity_type: "user",
          entity_id: id,
          changes: { role: updateData.role },
        });

        return NextResponse.json({ success: true, message: "Role updated" });
      }

      case "force_logout": {
        // Delete all user sessions
        const { error } = await supabase
          .from("user_sessions")
          .delete()
          .eq("user_id", id);

        if (error) {
          return handleDbError(error, "force logout");
        }

        return NextResponse.json({ success: true, message: "User logged out from all devices" });
      }

      default:
        // General update (name, etc.)
        const allowedFields = ["name", "bio", "website"];
        const filteredUpdate: Record<string, unknown> = {};

        for (const field of allowedFields) {
          if (updateData[field] !== undefined) {
            filteredUpdate[field] = updateData[field];
          }
        }

        if (Object.keys(filteredUpdate).length > 0) {
          const { error } = await supabase
            .from("users")
            .update(filteredUpdate)
            .eq("id", id);

          if (error) {
            return handleDbError(error, "update user");
          }
        }

        return NextResponse.json({ success: true, message: "User updated" });
    }
  } catch (error) {
    return handleDbError(error, "update user");
  }
}
