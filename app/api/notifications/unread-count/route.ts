/**
 * Unread Notification Count API
 *
 * GET - Get unread notification count for current user
 */

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getUnreadCount } from "@/lib/notifications";
import { handleDbError } from "@/lib/api/helpers";

export async function GET() {
  try {
    const user = await requireUser();

    const count = await getUnreadCount(user.id);

    return NextResponse.json({ unreadCount: count });
  } catch (error) {
    return handleDbError(error, "get unread count");
  }
}
