/**
 * Scheduled Publishing API
 *
 * GET /api/admin/scheduled-publishing - Get scheduled designs
 * POST /api/admin/scheduled-publishing - Process scheduled publishing
 * PUT /api/admin/scheduled-publishing - Schedule a design
 */

import { NextRequest, NextResponse } from "next/server";
import { getUser, isAdmin } from "@/lib/auth";
import { isScheduledPublishingEnabled } from "@/lib/feature-flags";
import {
  processScheduledPublishing,
  scheduleDesign,
  getScheduledDesigns,
  clearSchedule,
} from "@/lib/scheduled-publishing";
import { z } from "zod";
import { forbiddenResponse } from "@/lib/api/helpers";

export const runtime = "nodejs";

const scheduleSchema = z.object({
  designId: z.string().uuid(),
  publishAt: z.string().datetime().nullable().optional(),
  unpublishAt: z.string().datetime().nullable().optional(),
  clear: z.boolean().optional(),
});

/**
 * GET /api/admin/scheduled-publishing
 * Returns list of scheduled designs
 */
export async function GET() {
  const user = await getUser();
  if (!user || !isAdmin(user)) {
    return forbiddenResponse("Admin access required");
  }

  const enabled = await isScheduledPublishingEnabled();
  if (!enabled) {
    return NextResponse.json({
      enabled: false,
      toPublish: [],
      toUnpublish: [],
      message: "Scheduled publishing feature is disabled",
    });
  }

  const scheduled = await getScheduledDesigns();

  return NextResponse.json({
    enabled: true,
    ...scheduled,
  });
}

/**
 * POST /api/admin/scheduled-publishing
 * Trigger processing of scheduled designs
 * Can be called by cron job or manually
 */
export async function POST(request: NextRequest) {
  // Allow cron job access via secret header or admin auth
  const cronSecret = request.headers.get("x-cron-secret");
  const expectedSecret = process.env.CRON_SECRET;

  if (cronSecret && expectedSecret && cronSecret === expectedSecret) {
    // Authenticated via cron secret
  } else {
    // Require admin auth
    const user = await getUser();
    if (!user || !isAdmin(user)) {
      return forbiddenResponse("Admin access required");
    }
  }

  const result = await processScheduledPublishing();

  return NextResponse.json(result);
}

/**
 * PUT /api/admin/scheduled-publishing
 * Schedule a design for publishing/unpublishing
 */
export async function PUT(request: NextRequest) {
  const user = await getUser();
  if (!user || !isAdmin(user)) {
    return forbiddenResponse("Admin access required");
  }

  const enabled = await isScheduledPublishingEnabled();
  if (!enabled) {
    return NextResponse.json(
      { error: "Scheduled publishing feature is disabled" },
      { status: 400 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validation = scheduleSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: `Invalid data: ${validation.error.issues.map((e) => e.message).join(", ")}` },
      { status: 400 }
    );
  }

  const { designId, publishAt, unpublishAt, clear } = validation.data;

  // Clear schedule if requested
  if (clear) {
    const result = await clearSchedule(designId);
    return NextResponse.json(result);
  }

  // Schedule the design
  const result = await scheduleDesign({
    designId,
    publishAt,
    unpublishAt,
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    message: "Schedule updated successfully",
    designId,
    publishAt,
    unpublishAt,
  });
}
