/**
 * Admin Users API
 *
 * GET - List all users with filtering and pagination
 * POST - Create a new user
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, isSuperAdmin } from "@/lib/auth";
import { getUsers, getAccessTiers } from "@/lib/services/user-service";
import { createServiceClient } from "@/lib/supabase/server";
import {
  parsePaginationParams,
  parseJsonBody,
  forbiddenResponse,
  handleDbError,
} from "@/lib/api/helpers";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const { page, pageSize } = parsePaginationParams(searchParams, { defaultPageSize: 20 });
    const search = searchParams.get("search") || undefined;
    const status = searchParams.get("status") || undefined;
    const tierId = searchParams.get("tierId") || undefined;
    const role = searchParams.get("role") || undefined;

    // Fetch users and tiers in parallel
    const [usersResult, tiers] = await Promise.all([
      getUsers({ page, pageSize, search, status, tierId, role }),
      getAccessTiers(),
    ]);

    return NextResponse.json({
      users: usersResult.users,
      total: usersResult.total,
      page,
      pageSize,
      totalPages: Math.ceil(usersResult.total / pageSize),
      tiers,
    });
  } catch (error) {
    return handleDbError(error, "fetch users");
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin();

    const bodyResult = await parseJsonBody<{
      email?: string;
      name?: string;
      role?: string;
      tier_id?: string;
      password?: string;
    }>(request);
    if (!bodyResult.success) return bodyResult.response!;

    const { email, name, role, tier_id, password } = bodyResult.data!;

    // Validate required fields
    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    // Only super_admin can create admin users
    if (role === "admin" && !isSuperAdmin(admin)) {
      return forbiddenResponse("Only super admins can create admin users");
    }

    // Generate password if not provided
    const userPassword = password || generateSecurePassword();

    const supabase = createServiceClient();

    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password: userPassword,
      email_confirm: true,
      user_metadata: {
        name: name || undefined,
      },
    });

    if (authError || !authData.user) {
      console.error("[Create User] Auth error:", authError);
      return NextResponse.json(
        { error: authError?.message || "Failed to create user in auth" },
        { status: 500 }
      );
    }

    // Get default free tier if no tier specified
    let finalTierId = tier_id;
    if (!finalTierId) {
      const { data: freeTier } = await supabase
        .from("access_tiers")
        .select("id")
        .eq("slug", "free")
        .single();
      finalTierId = freeTier?.id;
    }

    // Create user record in users table
    const { data: userData, error: userError } = await supabase
      .from("users")
      .insert({
        id: authData.user.id,
        email,
        name: name || null,
        role: role || "user",
        tier_id: finalTierId,
        status: "active",
      })
      .select()
      .single();

    if (userError) {
      // Try to clean up auth user
      await supabase.auth.admin.deleteUser(authData.user.id);
      return handleDbError(userError, "create user record");
    }

    // Log the action
    await supabase.from("audit_logs").insert({
      user_id: admin.id,
      action: "create_user",
      entity_type: "user",
      entity_id: userData.id,
      changes: { email, role: role || "user" },
    });

    return NextResponse.json({
      success: true,
      user: {
        id: userData.id,
        email: userData.email,
        name: userData.name,
        role: userData.role,
      },
      // Only include password in response if it was generated
      ...(password ? {} : { generatedPassword: userPassword }),
    });
  } catch (error) {
    return handleDbError(error, "create user");
  }
}

function generateSecurePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%&*";
  let password = "";
  for (let i = 0; i < 16; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}
