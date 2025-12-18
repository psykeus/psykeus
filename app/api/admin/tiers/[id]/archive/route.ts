/**
 * Tier Archive API Route
 *
 * POST /api/admin/tiers/[id]/archive - Archive a tier
 * DELETE /api/admin/tiers/[id]/archive - Unarchive a tier
 */

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { archiveTier, unarchiveTier } from "@/lib/services/tier-service";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;

    const result = await archiveTier(id);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API] Error archiving tier:", error);
    const message = error instanceof Error ? error.message : "Failed to archive tier";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;

    const result = await unarchiveTier(id);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API] Error unarchiving tier:", error);
    const message = error instanceof Error ? error.message : "Failed to unarchive tier";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
