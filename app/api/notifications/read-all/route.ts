/**
 * Mark All Notifications as Read API
 *
 * POST - Mark all notifications as read for current user
 */

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { markAllNotificationsAsRead } from "@/lib/notifications";
import { handleDbError } from "@/lib/api/helpers";

export async function POST() {
  try {
    const user = await requireUser();

    const count = await markAllNotificationsAsRead(user.id);

    return NextResponse.json({
      success: true,
      markedAsRead: count,
    });
  } catch (error) {
    return handleDbError(error, "mark all as read");
  }
}
