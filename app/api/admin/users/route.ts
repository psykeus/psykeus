/**
 * Admin Users API
 *
 * GET - List all users with filtering and pagination
 */

import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth";
import { getUsers, getAccessTiers } from "@/lib/services/user-service";

export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin();

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "20", 10);
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
    console.error("[Admin Users API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}
