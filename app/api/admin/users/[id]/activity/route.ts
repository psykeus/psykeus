/**
 * Admin User Activity API
 *
 * GET - Get user activity history
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import type { IdRouteParams } from "@/lib/types";

export async function GET(request: NextRequest, { params }: IdRouteParams) {
  try {
    await requireAdmin();
    const { id } = await params;

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    const supabase = createServiceClient();

    const { data: activity, error } = await supabase
      .from("user_activity")
      .select("id, activity_type, entity_type, entity_id, metadata, created_at")
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("[User Activity API] Error:", error);
      return NextResponse.json(
        { error: "Failed to fetch activity" },
        { status: 500 }
      );
    }

    return NextResponse.json({ activity: activity || [] });
  } catch (error) {
    console.error("[User Activity API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch activity" },
      { status: 500 }
    );
  }
}
