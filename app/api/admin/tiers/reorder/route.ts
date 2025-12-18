/**
 * Admin Tiers Reorder API
 *
 * POST - Reorder tiers
 */

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { reorderTiers } from "@/lib/services/tier-service";

export async function POST(request: Request) {
  try {
    await requireAdmin();

    const body = await request.json();

    if (!Array.isArray(body.orderedIds)) {
      return NextResponse.json(
        { error: "orderedIds array is required" },
        { status: 400 }
      );
    }

    const { success, error } = await reorderTiers(body.orderedIds);

    if (!success) {
      return NextResponse.json({ error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API] Error reordering tiers:", error);
    return NextResponse.json(
      { error: "Failed to reorder tiers" },
      { status: 500 }
    );
  }
}
