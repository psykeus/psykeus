/**
 * Stripe Subscription API Route
 *
 * Get subscription status and manage subscriptions.
 * GET /api/stripe/subscription - Get current subscription status
 * POST /api/stripe/subscription - Manage subscription (cancel/reactivate)
 */

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import {
  getSubscriptionDetails,
  getPaymentHistory,
  cancelSubscription,
  reactivateSubscription,
} from "@/lib/services/stripe-service";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireUser();

    const [subscription, payments] = await Promise.all([
      getSubscriptionDetails(user.id),
      getPaymentHistory(user.id, 10),
    ]);

    return NextResponse.json({
      subscription,
      payments,
    });
  } catch (error) {
    console.error("[Stripe Subscription] Error:", error);
    const message = error instanceof Error ? error.message : "Failed to get subscription";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();

    const body = await request.json();
    const { action } = body;

    if (!action || !["cancel", "reactivate"].includes(action)) {
      return NextResponse.json(
        { error: "action must be 'cancel' or 'reactivate'" },
        { status: 400 }
      );
    }

    if (action === "cancel") {
      await cancelSubscription(user.id);
      return NextResponse.json({ success: true, message: "Subscription will cancel at period end" });
    }

    if (action === "reactivate") {
      await reactivateSubscription(user.id);
      return NextResponse.json({ success: true, message: "Subscription reactivated" });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("[Stripe Subscription] Error:", error);
    const message = error instanceof Error ? error.message : "Failed to manage subscription";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
