/**
 * Single Broadcast API
 *
 * GET - Get broadcast details
 * POST - Send the broadcast (if not already sent)
 * DELETE - Delete the broadcast (if not already sent)
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import {
  getBroadcast,
  sendBroadcast,
  deleteBroadcast,
} from "@/lib/notifications";
import {
  validateParams,
  parseJsonBody,
  handleDbError,
  notFoundResponse,
} from "@/lib/api/helpers";

const paramsSchema = z.object({
  id: z.string().uuid("Invalid broadcast ID"),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    await requireAdmin();

    const paramsResult = await validateParams(params, paramsSchema);
    if (!paramsResult.success) return paramsResult.response!;
    const { id } = paramsResult.data;

    const broadcast = await getBroadcast(id);
    if (!broadcast) {
      return notFoundResponse("Broadcast");
    }

    return NextResponse.json({ broadcast });
  } catch (error) {
    return handleDbError(error, "fetch broadcast");
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    await requireAdmin();

    const paramsResult = await validateParams(params, paramsSchema);
    if (!paramsResult.success) return paramsResult.response!;
    const { id } = paramsResult.data;

    const bodyResult = await parseJsonBody<{ sendEmail?: boolean }>(request);
    const sendEmail = bodyResult.data?.sendEmail ?? false;

    // Check if broadcast exists
    const broadcast = await getBroadcast(id);
    if (!broadcast) {
      return notFoundResponse("Broadcast");
    }

    // Check if already sent
    if (broadcast.sentAt) {
      return NextResponse.json(
        { error: "Broadcast has already been sent" },
        { status: 400 }
      );
    }

    // Send the broadcast
    const result = await sendBroadcast(id, sendEmail);
    if (!result) {
      return NextResponse.json(
        { error: "Failed to send broadcast" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      recipientsCount: result.recipientsCount,
      emailsSent: result.emailsSent || 0,
    });
  } catch (error) {
    return handleDbError(error, "send broadcast");
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    await requireAdmin();

    const paramsResult = await validateParams(params, paramsSchema);
    if (!paramsResult.success) return paramsResult.response!;
    const { id } = paramsResult.data;

    const success = await deleteBroadcast(id);
    if (!success) {
      return NextResponse.json(
        { error: "Cannot delete broadcast (already sent or not found)" },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleDbError(error, "delete broadcast");
  }
}
