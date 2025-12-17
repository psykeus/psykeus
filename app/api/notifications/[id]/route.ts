/**
 * Single Notification API
 *
 * PATCH - Mark notification as read
 * DELETE - Delete notification
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import {
  getNotification,
  markNotificationAsRead,
  deleteNotification,
  incrementBroadcastReadCount,
} from "@/lib/notifications";
import {
  validateParams,
  handleDbError,
  notFoundResponse,
} from "@/lib/api/helpers";

const paramsSchema = z.object({
  id: z.string().uuid("Invalid notification ID"),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const user = await requireUser();

    const paramsResult = await validateParams(params, paramsSchema);
    if (!paramsResult.success) return paramsResult.response!;
    const { id } = paramsResult.data;

    // Get notification to check ownership and broadcast ID
    const notification = await getNotification(id, user.id);
    if (!notification) {
      return notFoundResponse("Notification");
    }

    // Mark as read
    const success = await markNotificationAsRead(id, user.id);
    if (!success) {
      return NextResponse.json(
        { error: "Failed to mark notification as read" },
        { status: 500 }
      );
    }

    // If this is from a broadcast, increment the read count
    if (notification.broadcastId) {
      await incrementBroadcastReadCount(notification.broadcastId);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleDbError(error, "update notification");
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const user = await requireUser();

    const paramsResult = await validateParams(params, paramsSchema);
    if (!paramsResult.success) return paramsResult.response!;
    const { id } = paramsResult.data;

    const success = await deleteNotification(id, user.id);
    if (!success) {
      return notFoundResponse("Notification");
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleDbError(error, "delete notification");
  }
}
