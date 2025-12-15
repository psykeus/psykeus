/**
 * Stripe Prices API Route
 *
 * POST - Create a new price for a product
 */

import { NextResponse } from "next/server";
import { getUser, isAdmin } from "@/lib/auth";
import { createStripePrice } from "@/lib/services/stripe-admin-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await getUser();
    if (!user || !isAdmin(user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const { productId, unitAmount, currency, type, interval, nickname } = body;

    if (!productId || typeof productId !== "string") {
      return NextResponse.json(
        { error: "Product ID is required" },
        { status: 400 }
      );
    }

    if (!unitAmount || typeof unitAmount !== "number" || unitAmount <= 0) {
      return NextResponse.json(
        { error: "Unit amount must be a positive number (in cents)" },
        { status: 400 }
      );
    }

    if (!type || !["recurring", "one_time"].includes(type)) {
      return NextResponse.json(
        { error: "Type must be 'recurring' or 'one_time'" },
        { status: 400 }
      );
    }

    if (type === "recurring" && (!interval || !["year", "month"].includes(interval))) {
      return NextResponse.json(
        { error: "Interval must be 'year' or 'month' for recurring prices" },
        { status: 400 }
      );
    }

    const price = await createStripePrice({
      productId,
      unitAmount,
      currency: currency || "usd",
      type,
      interval: type === "recurring" ? interval : undefined,
      nickname: nickname?.trim(),
    });

    return NextResponse.json({ price });
  } catch (error) {
    console.error("[Stripe Prices] Error creating price:", error);
    const message =
      error instanceof Error ? error.message : "Failed to create price";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
