/**
 * Stripe Connection Test API Route
 *
 * POST - Test Stripe connection with current credentials
 */

import { NextResponse } from "next/server";
import { getUser, isAdmin } from "@/lib/auth";
import { testStripeConnection } from "@/lib/services/stripe-admin-service";

export const runtime = "nodejs";

export async function POST() {
  try {
    const user = await getUser();
    if (!user || !isAdmin(user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const result = await testStripeConnection();
    return NextResponse.json(result);
  } catch (error) {
    console.error("[Stripe Test] Error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to test connection" },
      { status: 500 }
    );
  }
}
