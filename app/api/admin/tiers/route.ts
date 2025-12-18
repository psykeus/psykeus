/**
 * Admin Tiers API
 *
 * GET  - List all tiers with features
 * POST - Create a new tier
 */

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getTiersWithUserCounts, createTier } from "@/lib/services/tier-service";
import type { CreateTierRequest } from "@/lib/types";

export async function GET() {
  try {
    await requireAdmin();

    const tiers = await getTiersWithUserCounts();

    return NextResponse.json({ tiers });
  } catch (error) {
    console.error("[API] Error fetching tiers:", error);
    return NextResponse.json(
      { error: "Failed to fetch tiers" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();

    const body = (await request.json()) as CreateTierRequest;

    // Validate required fields
    if (!body.name || !body.slug) {
      return NextResponse.json(
        { error: "Name and slug are required" },
        { status: 400 }
      );
    }

    const { tier, error } = await createTier(body);

    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }

    return NextResponse.json({ tier }, { status: 201 });
  } catch (error) {
    console.error("[API] Error creating tier:", error);
    return NextResponse.json(
      { error: "Failed to create tier" },
      { status: 500 }
    );
  }
}
