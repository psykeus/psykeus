/**
 * Admin Stripe Product API - Single Product Operations
 *
 * GET /api/admin/stripe/products/[id] - Get product details with prices
 * PATCH /api/admin/stripe/products/[id] - Update product (name/description)
 * DELETE /api/admin/stripe/products/[id] - Archive product
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  updateStripeProduct,
  archiveStripeProduct,
  listProductPrices,
} from "@/lib/services/stripe-admin-service";
import { getStripeSecretKey } from "@/lib/services/stripe-admin-service";
import Stripe from "stripe";
import { z } from "zod";
import type { IdRouteParams } from "@/lib/types";

export const runtime = "nodejs";

// Schema for updating a product
const updateProductSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  active: z.boolean().optional(),
});

/**
 * Get a Stripe client instance
 */
async function getStripeClient(): Promise<Stripe | null> {
  const secretKey = await getStripeSecretKey();
  if (!secretKey) {
    return null;
  }
  return new Stripe(secretKey);
}

/**
 * GET /api/admin/stripe/products/[id]
 * Get a single product with its prices
 */
export async function GET(request: NextRequest, { params }: IdRouteParams) {
  try {
    const user = await requireAdmin();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get("includeInactive") === "true";

    const stripe = await getStripeClient();
    if (!stripe) {
      return NextResponse.json(
        { error: "Stripe not configured" },
        { status: 500 }
      );
    }

    const product = await stripe.products.retrieve(id);
    const prices = await listProductPrices(id, includeInactive);

    return NextResponse.json({
      product: {
        id: product.id,
        name: product.name,
        description: product.description,
        active: product.active,
        prices,
      },
    });
  } catch (error) {
    console.error("[API] Error getting product:", error);
    const message =
      error instanceof Error ? error.message : "Failed to get product";

    if (message.includes("No such product")) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/stripe/products/[id]
 * Update a product's name, description, or active status
 */
export async function PATCH(request: NextRequest, { params }: IdRouteParams) {
  try {
    const user = await requireAdmin();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = updateProductSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    await updateStripeProduct(id, parsed.data);

    // Fetch updated product
    const stripe = await getStripeClient();
    if (!stripe) {
      return NextResponse.json(
        { error: "Stripe not configured" },
        { status: 500 }
      );
    }

    const product = await stripe.products.retrieve(id);
    const prices = await listProductPrices(id, true);

    return NextResponse.json({
      product: {
        id: product.id,
        name: product.name,
        description: product.description,
        active: product.active,
        prices,
      },
    });
  } catch (error) {
    console.error("[API] Error updating product:", error);
    const message =
      error instanceof Error ? error.message : "Failed to update product";

    if (message.includes("No such product")) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/stripe/products/[id]
 * Archive a product (set active = false)
 */
export async function DELETE(request: NextRequest, { params }: IdRouteParams) {
  try {
    const user = await requireAdmin();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    await archiveStripeProduct(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API] Error archiving product:", error);
    const message =
      error instanceof Error ? error.message : "Failed to archive product";

    if (message.includes("No such product")) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
