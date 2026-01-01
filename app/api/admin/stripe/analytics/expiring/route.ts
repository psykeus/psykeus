/**
 * Admin Stripe Expiring Items API
 *
 * GET /api/admin/stripe/analytics/expiring - Get coupons/promo codes expiring soon
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getExpiringItems } from "@/lib/services/stripe-coupon-service";

export const runtime = "nodejs";

/**
 * GET /api/admin/stripe/analytics/expiring
 * Get coupons and promo codes expiring within N days
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAdmin();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const daysAhead = parseInt(searchParams.get("days") || "30", 10);

    // Validate days parameter
    if (isNaN(daysAhead) || daysAhead < 1 || daysAhead > 365) {
      return NextResponse.json(
        { error: "Days must be between 1 and 365" },
        { status: 400 }
      );
    }

    const expiringItems = await getExpiringItems(daysAhead);

    return NextResponse.json({ expiringItems });
  } catch (error) {
    console.error("[API] Error getting expiring items:", error);
    const message =
      error instanceof Error ? error.message : "Failed to get expiring items";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
