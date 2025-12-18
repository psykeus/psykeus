/**
 * Admin Single Tier Feature API
 *
 * PATCH  - Update a feature
 * DELETE - Delete a feature
 */

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  updateTierFeature,
  deleteTierFeature,
} from "@/lib/services/tier-service";
import type { FeatureIdRouteParams, UpdateTierFeatureRequest } from "@/lib/types";

export async function PATCH(request: Request, { params }: FeatureIdRouteParams) {
  try {
    await requireAdmin();

    const { featureId } = await params;
    const body = (await request.json()) as UpdateTierFeatureRequest;

    const { feature, error } = await updateTierFeature(featureId, body);

    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }

    return NextResponse.json({ feature });
  } catch (error) {
    console.error("[API] Error updating feature:", error);
    return NextResponse.json(
      { error: "Failed to update feature" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, { params }: FeatureIdRouteParams) {
  try {
    await requireAdmin();

    const { featureId } = await params;
    const { success, error } = await deleteTierFeature(featureId);

    if (!success) {
      return NextResponse.json({ error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API] Error deleting feature:", error);
    return NextResponse.json(
      { error: "Failed to delete feature" },
      { status: 500 }
    );
  }
}
