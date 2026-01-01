/**
 * Admin Stripe Coupon API - Single Coupon Operations
 *
 * GET /api/admin/stripe/coupons/[id] - Get coupon details
 * PATCH /api/admin/stripe/coupons/[id] - Update coupon (name/metadata only)
 * DELETE /api/admin/stripe/coupons/[id] - Delete coupon
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  getCoupon,
  updateCoupon,
  deleteCoupon,
} from "@/lib/services/stripe-coupon-service";
import { z } from "zod";
import type { IdRouteParams } from "@/lib/types";

export const runtime = "nodejs";

// Schema for updating a coupon
const updateCouponSchema = z.object({
  name: z.string().min(1).optional(),
  metadata: z.record(z.string(), z.string()).optional(),
});

/**
 * GET /api/admin/stripe/coupons/[id]
 * Get a single coupon with its promo codes
 */
export async function GET(request: NextRequest, { params }: IdRouteParams) {
  try {
    const user = await requireAdmin();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const coupon = await getCoupon(id);

    return NextResponse.json({ coupon });
  } catch (error) {
    console.error("[API] Error getting coupon:", error);
    const message =
      error instanceof Error ? error.message : "Failed to get coupon";

    // Check if it's a Stripe "not found" error
    if (message.includes("No such coupon")) {
      return NextResponse.json({ error: "Coupon not found" }, { status: 404 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/stripe/coupons/[id]
 * Update a coupon (only name and metadata can be changed)
 */
export async function PATCH(request: NextRequest, { params }: IdRouteParams) {
  try {
    const user = await requireAdmin();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = updateCouponSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const coupon = await updateCoupon(id, parsed.data);

    return NextResponse.json({ coupon });
  } catch (error) {
    console.error("[API] Error updating coupon:", error);
    const message =
      error instanceof Error ? error.message : "Failed to update coupon";

    if (message.includes("No such coupon")) {
      return NextResponse.json({ error: "Coupon not found" }, { status: 404 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/stripe/coupons/[id]
 * Delete a coupon (also deletes all associated promo codes)
 */
export async function DELETE(request: NextRequest, { params }: IdRouteParams) {
  try {
    const user = await requireAdmin();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    await deleteCoupon(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API] Error deleting coupon:", error);
    const message =
      error instanceof Error ? error.message : "Failed to delete coupon";

    if (message.includes("No such coupon")) {
      return NextResponse.json({ error: "Coupon not found" }, { status: 404 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
