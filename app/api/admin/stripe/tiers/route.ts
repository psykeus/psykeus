/**
 * Stripe Tier Mappings API Route
 *
 * GET - Get tier-to-price mappings
 * PUT - Update tier-to-price mappings
 */

import { NextResponse } from "next/server";
import { getUser, isAdmin } from "@/lib/auth";
import {
  getTierMappings,
  updateTierMappings,
} from "@/lib/services/stripe-admin-service";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await getUser();
    if (!user || !isAdmin(user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const mappings = await getTierMappings();
    return NextResponse.json({ mappings });
  } catch (error) {
    console.error("[Stripe Tiers] Error:", error);
    return NextResponse.json(
      { error: "Failed to get tier mappings" },
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
    const { mappings } = body;

    if (!Array.isArray(mappings)) {
      return NextResponse.json(
        { error: "Mappings must be an array" },
        { status: 400 }
      );
    }

    // Validate mapping structure
    for (const mapping of mappings) {
      if (!mapping.tierId || typeof mapping.tierId !== "string") {
        return NextResponse.json(
          { error: "Each mapping must have a tierId" },
          { status: 400 }
        );
      }
    }

    await updateTierMappings(mappings);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Stripe Tiers] Error updating mappings:", error);
    return NextResponse.json(
      { error: "Failed to update tier mappings" },
      { status: 500 }
    );
  }
}
