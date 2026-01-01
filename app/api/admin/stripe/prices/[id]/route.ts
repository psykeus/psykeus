/**
 * Admin Stripe Price API - Single Price Operations
 *
 * PATCH /api/admin/stripe/prices/[id] - Update price (activate/deactivate)
 * DELETE /api/admin/stripe/prices/[id] - Deactivate price
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  deactivateStripePrice,
  reactivateStripePrice,
} from "@/lib/services/stripe-admin-service";
import { z } from "zod";
import type { IdRouteParams } from "@/lib/types";

export const runtime = "nodejs";

// Schema for updating a price
const updatePriceSchema = z.object({
  active: z.boolean(),
});

/**
 * PATCH /api/admin/stripe/prices/[id]
 * Update a price's active status
 */
export async function PATCH(request: NextRequest, { params }: IdRouteParams) {
  try {
    const user = await requireAdmin();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = updatePriceSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    if (parsed.data.active) {
      await reactivateStripePrice(id);
    } else {
      await deactivateStripePrice(id);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API] Error updating price:", error);
    const message =
      error instanceof Error ? error.message : "Failed to update price";

    if (message.includes("No such price")) {
      return NextResponse.json({ error: "Price not found" }, { status: 404 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/stripe/prices/[id]
 * Deactivate a price (Stripe doesn't allow deletion)
 */
export async function DELETE(request: NextRequest, { params }: IdRouteParams) {
  try {
    const user = await requireAdmin();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    await deactivateStripePrice(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API] Error deactivating price:", error);
    const message =
      error instanceof Error ? error.message : "Failed to deactivate price";

    if (message.includes("No such price")) {
      return NextResponse.json({ error: "Price not found" }, { status: 404 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
