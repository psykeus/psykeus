/**
 * Stripe Settings API Route
 *
 * GET - Get masked Stripe settings
 * PUT - Save Stripe settings
 */

import { NextResponse } from "next/server";
import { getUser, isAdmin } from "@/lib/auth";
import {
  getMaskedStripeSettings,
  saveStripeSettings,
} from "@/lib/services/stripe-admin-service";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await getUser();
    if (!user || !isAdmin(user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const settings = await getMaskedStripeSettings();
    return NextResponse.json(settings);
  } catch (error) {
    console.error("[Stripe Settings] Error:", error);
    return NextResponse.json(
      { error: "Failed to get settings" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getUser();
    if (!user || !isAdmin(user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const { secretKey, publishableKey, webhookSecret } = body;

    // Validate that keys start with expected prefixes
    if (secretKey && !secretKey.startsWith("sk_")) {
      return NextResponse.json(
        { error: "Secret key must start with 'sk_'" },
        { status: 400 }
      );
    }

    if (publishableKey && !publishableKey.startsWith("pk_")) {
      return NextResponse.json(
        { error: "Publishable key must start with 'pk_'" },
        { status: 400 }
      );
    }

    if (webhookSecret && !webhookSecret.startsWith("whsec_")) {
      return NextResponse.json(
        { error: "Webhook secret must start with 'whsec_'" },
        { status: 400 }
      );
    }

    await saveStripeSettings(
      { secretKey, publishableKey, webhookSecret },
      user.id
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Stripe Settings] Error:", error);
    return NextResponse.json(
      { error: "Failed to save settings" },
      { status: 500 }
    );
  }
}
