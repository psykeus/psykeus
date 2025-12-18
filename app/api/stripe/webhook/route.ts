/**
 * Stripe Webhook API Route
 *
 * Handles incoming Stripe webhook events.
 * POST /api/stripe/webhook
 */

import { NextResponse } from "next/server";
import {
  constructWebhookEvent,
  isEventProcessed,
  recordWebhookEvent,
  markEventProcessed,
  handleCheckoutCompleted,
  handleSubscriptionUpdated,
  handleSubscriptionDeleted,
  handleInvoicePaymentSucceeded,
  handleInvoicePaymentFailed,
} from "@/lib/services/stripe-service";
import type Stripe from "stripe";

export const runtime = "nodejs";

// Disable body parsing - we need raw body for webhook verification
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const signature = request.headers.get("stripe-signature");

    if (!signature) {
      return NextResponse.json(
        { error: "Missing stripe-signature header" },
        { status: 400 }
      );
    }

    // Get raw body
    const rawBody = await request.text();

    // Construct and verify event
    let event: Stripe.Event;
    try {
      event = await constructWebhookEvent(rawBody, signature);
    } catch (err) {
      console.error("[Stripe Webhook] Signature verification failed:", err);
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 400 }
      );
    }

    // Check idempotency - skip if already processed
    const alreadyProcessed = await isEventProcessed(event.id);
    if (alreadyProcessed) {
      return NextResponse.json({ received: true, skipped: true });
    }

    // Record event for idempotency
    await recordWebhookEvent(event.id, event.type, event);

    // Process event based on type
    let processingError: string | undefined;
    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object as Stripe.Checkout.Session;
          await handleCheckoutCompleted(session);
          break;
        }

        case "customer.subscription.updated": {
          const subscription = event.data.object as Stripe.Subscription;
          await handleSubscriptionUpdated(subscription);
          break;
        }

        case "customer.subscription.deleted": {
          const subscription = event.data.object as Stripe.Subscription;
          await handleSubscriptionDeleted(subscription);
          break;
        }

        case "invoice.payment_succeeded": {
          const invoice = event.data.object as Stripe.Invoice;
          await handleInvoicePaymentSucceeded(invoice);
          break;
        }

        case "invoice.payment_failed": {
          const invoice = event.data.object as Stripe.Invoice;
          await handleInvoicePaymentFailed(invoice);
          break;
        }

        default:
          // Unhandled event type - log but don't fail
          console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
      }
    } catch (error) {
      console.error(`[Stripe Webhook] Error processing ${event.type}:`, error);
      processingError = error instanceof Error ? error.message : "Unknown error";
    }

    // Mark event as processed
    await markEventProcessed(event.id, processingError);

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[Stripe Webhook] Unexpected error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
