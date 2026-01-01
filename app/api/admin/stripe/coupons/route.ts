/**
 * Admin Stripe Coupons API
 *
 * GET /api/admin/stripe/coupons - List all coupons with promo codes
 * POST /api/admin/stripe/coupons - Create a new coupon
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { listCoupons, createCoupon } from "@/lib/services/stripe-coupon-service";
import { z } from "zod";

export const runtime = "nodejs";

// Schema for creating a coupon
const createCouponSchema = z.object({
  name: z.string().min(1, "Name is required"),
  percentOff: z.number().min(1).max(100).optional(),
  amountOff: z.number().min(1).optional(),
  currency: z.string().length(3).optional(),
  duration: z.enum(["forever", "once", "repeating"]),
  durationInMonths: z.number().min(1).optional(),
  maxRedemptions: z.number().min(1).optional(),
  redeemBy: z.string().datetime().optional(),
  metadata: z.record(z.string(), z.string()).optional(),
});

/**
 * GET /api/admin/stripe/coupons
 * List all coupons with their promo codes
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAdmin();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const includeInvalid = searchParams.get("includeInvalid") === "true";

    const coupons = await listCoupons(includeInvalid);

    return NextResponse.json({ coupons });
  } catch (error) {
    console.error("[API] Error listing coupons:", error);
    const message =
      error instanceof Error ? error.message : "Failed to list coupons";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/admin/stripe/coupons
 * Create a new coupon
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAdmin();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createCouponSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Validate discount type
    if (!data.percentOff && !data.amountOff) {
      return NextResponse.json(
        { error: "Must specify either percentOff or amountOff" },
        { status: 400 }
      );
    }

    if (data.percentOff && data.amountOff) {
      return NextResponse.json(
        { error: "Cannot specify both percentOff and amountOff" },
        { status: 400 }
      );
    }

    if (data.amountOff && !data.currency) {
      return NextResponse.json(
        { error: "Currency is required for fixed amount discounts" },
        { status: 400 }
      );
    }

    if (data.duration === "repeating" && !data.durationInMonths) {
      return NextResponse.json(
        { error: "durationInMonths is required for repeating duration" },
        { status: 400 }
      );
    }

    const coupon = await createCoupon(data);

    return NextResponse.json({ coupon }, { status: 201 });
  } catch (error) {
    console.error("[API] Error creating coupon:", error);
    const message =
      error instanceof Error ? error.message : "Failed to create coupon";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
