/**
 * Stripe Checkout API Route
 *
 * Creates Stripe checkout sessions for tier purchases.
 * POST /api/stripe/checkout
 */

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createCheckoutSession } from "@/lib/services/stripe-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await requireUser();

    const body = await request.json();
    const { tier_id, price_type, success_url, cancel_url } = body;

    if (!tier_id || !price_type) {
      return NextResponse.json(
        { error: "Missing tier_id or price_type" },
        { status: 400 }
      );
    }

    if (!["yearly", "lifetime"].includes(price_type)) {
      return NextResponse.json(
        { error: "price_type must be 'yearly' or 'lifetime'" },
        { status: 400 }
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const session = await createCheckoutSession({
      userId: user.id,
      email: user.email,
      name: user.name,
      tierId: tier_id,
      priceType: price_type,
      successUrl: success_url || `${appUrl}/account?payment=success`,
      cancelUrl: cancel_url || `${appUrl}/pricing?payment=canceled`,
    });

    return NextResponse.json(session);
  } catch (error) {
    console.error("[Stripe Checkout] Error:", error);
    const message = error instanceof Error ? error.message : "Failed to create checkout session";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
