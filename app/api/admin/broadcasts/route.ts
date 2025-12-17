/**
 * Admin Broadcasts API
 *
 * GET - List all broadcasts
 * POST - Create a new broadcast
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { listBroadcasts, createBroadcast, sendBroadcast } from "@/lib/notifications";
import {
  parsePaginationParams,
  parseJsonBody,
  handleDbError,
} from "@/lib/api/helpers";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const { page, pageSize } = parsePaginationParams(searchParams, {
      defaultPageSize: 20,
    });

    const result = await listBroadcasts(pageSize, (page - 1) * pageSize);

    return NextResponse.json({
      broadcasts: result.broadcasts,
      total: result.total,
      page,
      pageSize,
      totalPages: Math.ceil(result.total / pageSize),
    });
  } catch (error) {
    return handleDbError(error, "fetch broadcasts");
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin();

    const bodyResult = await parseJsonBody<{
      title: string;
      message: string;
      targetAudience?: "all" | "admins" | "subscribers" | "free";
      targetTierIds?: string[];
      scheduledAt?: string;
      actionUrl?: string;
      actionLabel?: string;
      priority?: "low" | "normal" | "high" | "urgent";
      sendImmediately?: boolean;
      sendEmail?: boolean;
    }>(request);
    if (!bodyResult.success) return bodyResult.response!;
    const body = bodyResult.data!;

    // Validate required fields
    if (!body.title || !body.message) {
      return NextResponse.json(
        { error: "Title and message are required" },
        { status: 400 }
      );
    }

    // Create the broadcast
    const broadcast = await createBroadcast({
      title: body.title,
      message: body.message,
      targetAudience: body.targetAudience || "all",
      targetTierIds: body.targetTierIds,
      scheduledAt: body.scheduledAt,
      actionUrl: body.actionUrl,
      actionLabel: body.actionLabel,
      priority: body.priority || "normal",
      createdBy: admin.id,
    });

    if (!broadcast) {
      return NextResponse.json(
        { error: "Failed to create broadcast" },
        { status: 500 }
      );
    }

    // If sendImmediately is true and not scheduled, send now
    if (body.sendImmediately && !body.scheduledAt) {
      const result = await sendBroadcast(broadcast.id, body.sendEmail);
      return NextResponse.json({
        broadcast,
        sent: true,
        recipientsCount: result?.recipientsCount || 0,
        emailsSent: result?.emailsSent || 0,
      });
    }

    return NextResponse.json({ broadcast, sent: false });
  } catch (error) {
    return handleDbError(error, "create broadcast");
  }
}
