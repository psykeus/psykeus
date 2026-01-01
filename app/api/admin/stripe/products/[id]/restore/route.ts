/**
 * Admin Stripe Product Restore API
 *
 * POST /api/admin/stripe/products/[id]/restore - Unarchive a product
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { unarchiveStripeProduct } from "@/lib/services/stripe-admin-service";
import type { IdRouteParams } from "@/lib/types";

export const runtime = "nodejs";

/**
 * POST /api/admin/stripe/products/[id]/restore
 * Unarchive a product (set active = true)
 */
export async function POST(request: NextRequest, { params }: IdRouteParams) {
  try {
    const user = await requireAdmin();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    await unarchiveStripeProduct(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API] Error restoring product:", error);
    const message =
      error instanceof Error ? error.message : "Failed to restore product";

    if (message.includes("No such product")) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
