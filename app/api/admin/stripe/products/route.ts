/**
 * Stripe Products API Route
 *
 * GET - List all Stripe products with prices
 * POST - Create a new Stripe product
 */

import { NextResponse } from "next/server";
import { getUser, isAdmin } from "@/lib/auth";
import {
  listStripeProducts,
  createStripeProduct,
} from "@/lib/services/stripe-admin-service";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await getUser();
    if (!user || !isAdmin(user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const products = await listStripeProducts();
    return NextResponse.json({ products });
  } catch (error) {
    console.error("[Stripe Products] Error:", error);
    return NextResponse.json(
      { error: "Failed to list products" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await getUser();
    if (!user || !isAdmin(user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const { name, description } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Product name is required" },
        { status: 400 }
      );
    }

    const product = await createStripeProduct({
      name: name.trim(),
      description: description?.trim(),
    });

    return NextResponse.json({ product });
  } catch (error) {
    console.error("[Stripe Products] Error creating product:", error);
    const message =
      error instanceof Error ? error.message : "Failed to create product";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
