/**
 * Admin Tier Stats API
 *
 * GET - Get tier statistics
 */

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getTierStats } from "@/lib/services/tier-service";

export async function GET() {
  try {
    await requireAdmin();

    const stats = await getTierStats();

    return NextResponse.json(stats);
  } catch (error) {
    console.error("[API] Error fetching tier stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 }
    );
  }
}
