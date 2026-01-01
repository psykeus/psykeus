/**
 * Admin Stripe Promo Code API - Single Promo Code Operations
 *
 * GET /api/admin/stripe/promo-codes/[id] - Get promo code details
 * PATCH /api/admin/stripe/promo-codes/[id] - Update promo code (activate/deactivate)
 * DELETE /api/admin/stripe/promo-codes/[id] - Deactivate promo code
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  getPromoCode,
  updatePromoCode,
  deactivatePromoCode,
} from "@/lib/services/stripe-coupon-service";
import { z } from "zod";
import type { IdRouteParams } from "@/lib/types";

export const runtime = "nodejs";

// Schema for updating a promo code
const updatePromoCodeSchema = z.object({
  active: z.boolean().optional(),
  metadata: z.record(z.string(), z.string()).optional(),
});

/**
 * GET /api/admin/stripe/promo-codes/[id]
 * Get a single promo code
 */
export async function GET(request: NextRequest, { params }: IdRouteParams) {
  try {
    const user = await requireAdmin();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const promoCode = await getPromoCode(id);

    return NextResponse.json({ promoCode });
  } catch (error) {
    console.error("[API] Error getting promo code:", error);
    const message =
      error instanceof Error ? error.message : "Failed to get promo code";

    if (message.includes("No such promotion code")) {
      return NextResponse.json(
        { error: "Promo code not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/stripe/promo-codes/[id]
 * Update a promo code (can only change active status and metadata)
 */
export async function PATCH(request: NextRequest, { params }: IdRouteParams) {
  try {
    const user = await requireAdmin();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = updatePromoCodeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const promoCode = await updatePromoCode(id, parsed.data);

    return NextResponse.json({ promoCode });
  } catch (error) {
    console.error("[API] Error updating promo code:", error);
    const message =
      error instanceof Error ? error.message : "Failed to update promo code";

    if (message.includes("No such promotion code")) {
      return NextResponse.json(
        { error: "Promo code not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/stripe/promo-codes/[id]
 * Deactivate a promo code (Stripe doesn't allow deletion)
 */
export async function DELETE(request: NextRequest, { params }: IdRouteParams) {
  try {
    const user = await requireAdmin();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    await deactivatePromoCode(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API] Error deactivating promo code:", error);
    const message =
      error instanceof Error ? error.message : "Failed to deactivate promo code";

    if (message.includes("No such promotion code")) {
      return NextResponse.json(
        { error: "Promo code not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
