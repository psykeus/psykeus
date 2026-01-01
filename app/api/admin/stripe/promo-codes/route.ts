/**
 * Admin Stripe Promo Codes API
 *
 * GET /api/admin/stripe/promo-codes - List all promo codes
 * POST /api/admin/stripe/promo-codes - Create a new promo code
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  listPromoCodes,
  createPromoCode,
} from "@/lib/services/stripe-coupon-service";
import { z } from "zod";

export const runtime = "nodejs";

// Schema for creating a promo code
const createPromoCodeSchema = z.object({
  couponId: z.string().min(1, "Coupon ID is required"),
  code: z
    .string()
    .min(1, "Code is required")
    .max(20)
    .regex(/^[A-Z0-9_-]+$/i, "Code must be alphanumeric with dashes/underscores"),
  maxRedemptions: z.number().min(1).optional(),
  expiresAt: z.string().datetime().optional(),
  firstTimeTransaction: z.boolean().optional(),
  minimumAmount: z.number().min(1).optional(),
  minimumAmountCurrency: z.string().length(3).optional(),
  metadata: z.record(z.string(), z.string()).optional(),
});

/**
 * GET /api/admin/stripe/promo-codes
 * List all promo codes, optionally filtered by coupon
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAdmin();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const couponId = searchParams.get("couponId") || undefined;
    const includeInactive = searchParams.get("includeInactive") === "true";

    const promoCodes = await listPromoCodes(couponId, includeInactive);

    return NextResponse.json({ promoCodes });
  } catch (error) {
    console.error("[API] Error listing promo codes:", error);
    const message =
      error instanceof Error ? error.message : "Failed to list promo codes";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/admin/stripe/promo-codes
 * Create a new promo code for a coupon
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAdmin();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createPromoCodeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const promoCode = await createPromoCode(parsed.data);

    return NextResponse.json({ promoCode }, { status: 201 });
  } catch (error) {
    console.error("[API] Error creating promo code:", error);
    const message =
      error instanceof Error ? error.message : "Failed to create promo code";

    // Check for common Stripe errors
    if (message.includes("already exists")) {
      return NextResponse.json(
        { error: "A promo code with this name already exists" },
        { status: 409 }
      );
    }

    if (message.includes("No such coupon")) {
      return NextResponse.json(
        { error: "Coupon not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
