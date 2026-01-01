/**
 * Admin Stripe Coupon Analytics API
 *
 * GET /api/admin/stripe/analytics/coupons - Get coupon usage statistics
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getCouponAnalytics } from "@/lib/services/stripe-coupon-service";

export const runtime = "nodejs";

/**
 * GET /api/admin/stripe/analytics/coupons
 * Get coupon usage analytics
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAdmin();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;

    const analytics = await getCouponAnalytics(startDate, endDate);

    return NextResponse.json({ analytics });
  } catch (error) {
    console.error("[API] Error getting coupon analytics:", error);
    const message =
      error instanceof Error ? error.message : "Failed to get coupon analytics";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
