/**
 * Admin Stripe Revenue Analytics API
 *
 * GET /api/admin/stripe/analytics/revenue - Get revenue breakdown
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import type { RevenueAnalytics, TierRevenueStats, RevenueDataPoint } from "@/lib/types";

export const runtime = "nodejs";

/**
 * GET /api/admin/stripe/analytics/revenue
 * Get revenue analytics
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

    const supabase = createServiceClient();

    // Build query for payment history
    let query = supabase
      .from("payment_history")
      .select(`
        amount_cents,
        discount_amount_cents,
        payment_type,
        tier_id,
        created_at,
        access_tier:access_tiers(name)
      `)
      .eq("status", "succeeded");

    if (startDate) {
      query = query.gte("created_at", startDate);
    }
    if (endDate) {
      query = query.lte("created_at", endDate);
    }

    const { data: payments, error } = await query;

    if (error) {
      console.error("[API] Error fetching revenue data:", error);
      throw error;
    }

    // Calculate totals
    let totalRevenue = 0;
    let totalDiscounts = 0;
    const tierStats: Record<string, TierRevenueStats> = {};
    const dailyStats: Record<string, { revenue: number; discounts: number }> = {};

    for (const payment of payments || []) {
      const revenue = payment.amount_cents || 0;
      const discounts = payment.discount_amount_cents || 0;

      totalRevenue += revenue;
      totalDiscounts += discounts;

      // Aggregate by tier
      if (payment.tier_id) {
        if (!tierStats[payment.tier_id]) {
          // Handle the access_tier join result
          const tierArray = payment.access_tier as Array<{ name: string }> | null;
          const tierName = tierArray?.[0]?.name || "Unknown";

          tierStats[payment.tier_id] = {
            tierId: payment.tier_id,
            tierName,
            revenue: 0,
            subscriptionCount: 0,
            lifetimeCount: 0,
          };
        }

        tierStats[payment.tier_id].revenue += revenue;

        if (payment.payment_type === "subscription") {
          tierStats[payment.tier_id].subscriptionCount++;
        } else if (payment.payment_type === "one_time") {
          tierStats[payment.tier_id].lifetimeCount++;
        }
      }

      // Aggregate by date
      const date = payment.created_at.split("T")[0];
      if (!dailyStats[date]) {
        dailyStats[date] = { revenue: 0, discounts: 0 };
      }
      dailyStats[date].revenue += revenue;
      dailyStats[date].discounts += discounts;
    }

    // Convert to sorted arrays
    const byTier: TierRevenueStats[] = Object.values(tierStats).sort(
      (a, b) => b.revenue - a.revenue
    );

    const byPeriod: RevenueDataPoint[] = Object.entries(dailyStats)
      .map(([date, stats]) => ({
        date,
        revenue: stats.revenue,
        discounts: stats.discounts,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const analytics: RevenueAnalytics = {
      totalRevenue,
      totalDiscounts,
      netRevenue: totalRevenue, // Note: amount_cents is already post-discount
      byTier,
      byPeriod,
    };

    return NextResponse.json({ analytics });
  } catch (error) {
    console.error("[API] Error getting revenue analytics:", error);
    const message =
      error instanceof Error ? error.message : "Failed to get revenue analytics";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
