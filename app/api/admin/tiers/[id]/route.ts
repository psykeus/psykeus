/**
 * Admin Single Tier API
 *
 * GET    - Get a single tier with features
 * PATCH  - Update a tier
 * DELETE - Delete a tier
 */

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  getTierById,
  updateTier,
  deleteTier,
  toggleTierActive,
} from "@/lib/services/tier-service";
import type { IdRouteParams, UpdateTierRequest } from "@/lib/types";

export async function GET(request: Request, { params }: IdRouteParams) {
  try {
    await requireAdmin();

    const { id } = await params;
    const tier = await getTierById(id);

    if (!tier) {
      return NextResponse.json({ error: "Tier not found" }, { status: 404 });
    }

    return NextResponse.json({ tier });
  } catch (error) {
    console.error("[API] Error fetching tier:", error);
    return NextResponse.json(
      { error: "Failed to fetch tier" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, { params }: IdRouteParams) {
  try {
    await requireAdmin();

    const { id } = await params;
    const body = (await request.json()) as UpdateTierRequest & { action?: string };

    // Handle toggle active action
    if (body.action === "toggle_active" && body.is_active !== undefined) {
      const { success, error } = await toggleTierActive(id, body.is_active);

      if (!success) {
        return NextResponse.json({ error }, { status: 400 });
      }

      return NextResponse.json({ success: true });
    }

    // Regular update
    const { tier, error } = await updateTier(id, body);

    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }

    return NextResponse.json({ tier });
  } catch (error) {
    console.error("[API] Error updating tier:", error);
    return NextResponse.json(
      { error: "Failed to update tier" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, { params }: IdRouteParams) {
  try {
    await requireAdmin();

    const { id } = await params;
    const { success, error } = await deleteTier(id);

    if (!success) {
      return NextResponse.json({ error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API] Error deleting tier:", error);
    return NextResponse.json(
      { error: "Failed to delete tier" },
      { status: 500 }
    );
  }
}
