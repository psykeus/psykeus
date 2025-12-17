/**
 * Notifications API
 *
 * GET - List notifications for current user
 */

import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { listNotifications } from "@/lib/notifications";
import {
  parsePaginationParams,
  handleDbError,
} from "@/lib/api/helpers";
import type { NotificationType } from "@/lib/notifications/types";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();

    const { searchParams } = new URL(request.url);
    const { page, pageSize } = parsePaginationParams(searchParams, {
      defaultPageSize: 20,
      maxPageSize: 50,
    });
    const unreadOnly = searchParams.get("unreadOnly") === "true";
    const type = searchParams.get("type") as NotificationType | null;

    const result = await listNotifications({
      userId: user.id,
      limit: pageSize,
      offset: (page - 1) * pageSize,
      unreadOnly,
      type: type || undefined,
    });

    return NextResponse.json({
      notifications: result.notifications,
      total: result.total,
      unreadCount: result.unreadCount,
      page,
      pageSize,
      totalPages: Math.ceil(result.total / pageSize),
    });
  } catch (error) {
    return handleDbError(error, "fetch notifications");
  }
}
