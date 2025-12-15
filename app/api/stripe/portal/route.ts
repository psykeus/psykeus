/**
 * Stripe Customer Portal API Route
 *
 * Creates Stripe customer portal sessions for subscription management.
 * POST /api/stripe/portal
 */

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createPortalSession } from "@/lib/services/stripe-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await requireUser();

    const body = await request.json();
    const { return_url } = body;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const session = await createPortalSession({
      userId: user.id,
      returnUrl: return_url || `${appUrl}/account`,
    });

    return NextResponse.json(session);
  } catch (error) {
    console.error("[Stripe Portal] Error:", error);
    const message = error instanceof Error ? error.message : "Failed to create portal session";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
