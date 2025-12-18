/**
 * Admin Tier Features API
 *
 * GET  - List features for a tier
 * POST - Create a new feature
 */

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  getTierFeatures,
  createTierFeature,
  reorderTierFeatures,
} from "@/lib/services/tier-service";
import type { IdRouteParams, CreateTierFeatureRequest } from "@/lib/types";

export async function GET(request: Request, { params }: IdRouteParams) {
  try {
    await requireAdmin();

    const { id } = await params;
    const features = await getTierFeatures(id);

    return NextResponse.json({ features });
  } catch (error) {
    console.error("[API] Error fetching tier features:", error);
    return NextResponse.json(
      { error: "Failed to fetch features" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request, { params }: IdRouteParams) {
  try {
    await requireAdmin();

    const { id } = await params;
    const body = await request.json();

    // Handle reorder action
    if (body.action === "reorder" && Array.isArray(body.orderedIds)) {
      const { success, error } = await reorderTierFeatures(id, body.orderedIds);

      if (!success) {
        return NextResponse.json({ error }, { status: 400 });
      }

      return NextResponse.json({ success: true });
    }

    // Create new feature
    const featureData: CreateTierFeatureRequest = {
      tier_id: id,
      feature_text: body.feature_text,
      icon: body.icon,
      sort_order: body.sort_order,
      is_highlighted: body.is_highlighted,
    };

    if (!featureData.feature_text) {
      return NextResponse.json(
        { error: "Feature text is required" },
        { status: 400 }
      );
    }

    const { feature, error } = await createTierFeature(featureData);

    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }

    return NextResponse.json({ feature }, { status: 201 });
  } catch (error) {
    console.error("[API] Error creating tier feature:", error);
    return NextResponse.json(
      { error: "Failed to create feature" },
      { status: 500 }
    );
  }
}
