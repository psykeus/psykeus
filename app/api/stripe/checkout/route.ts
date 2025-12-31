/**
 * Stripe Checkout API Route
 *
 * Creates Stripe checkout sessions for tier purchases.
 * POST /api/stripe/checkout
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createCheckoutSession } from "@/lib/services/stripe-service";

export const runtime = "nodejs";

// Validation schema for checkout request
const checkoutSchema = z.object({
  tier_id: z.string().uuid("Invalid tier ID"),
  price_type: z.enum(["yearly", "lifetime"], {
    message: "price_type must be 'yearly' or 'lifetime'",
  }),
  success_url: z.string().url("Invalid success URL").optional(),
  cancel_url: z.string().url("Invalid cancel URL").optional(),
  promo_code: z.string().max(50).optional(),
});

export async function POST(request: Request) {
  try {
    const user = await requireUser();

    const body = await request.json();
    const validation = checkoutSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues.map(i => i.message).join(", ") },
        { status: 400 }
      );
    }

    const { tier_id, price_type, success_url, cancel_url, promo_code } = validation.data;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const session = await createCheckoutSession({
      userId: user.id,
      email: user.email,
      name: user.name,
      tierId: tier_id,
      priceType: price_type,
      successUrl: success_url || `${appUrl}/account?payment=success`,
      cancelUrl: cancel_url || `${appUrl}/pricing?payment=canceled`,
      promoCode: promo_code,
    });

    return NextResponse.json(session);
  } catch (error) {
    console.error("[Stripe Checkout] Error:", error);
    const message = error instanceof Error ? error.message : "Failed to create checkout session";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
