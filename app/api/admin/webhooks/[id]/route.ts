/**
 * Individual Webhook API
 *
 * GET /api/admin/webhooks/[id] - Get webhook details and deliveries
 * PATCH /api/admin/webhooks/[id] - Update webhook
 * DELETE /api/admin/webhooks/[id] - Delete webhook
 * POST /api/admin/webhooks/[id]/test - Test webhook
 */

import { NextRequest, NextResponse } from "next/server";
import { getUser, isAdmin } from "@/lib/auth";
import { isWebhooksEnabled } from "@/lib/feature-flags";
import {
  getWebhook,
  updateWebhook,
  deleteWebhook,
  testWebhook,
  getWebhookDeliveries,
} from "@/lib/webhooks";
import { z } from "zod";
import { forbiddenResponse, notFoundResponse } from "@/lib/api/helpers";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const updateWebhookSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  url: z.string().url().optional(),
  events: z.array(z.string()).min(1).optional(),
  secret: z.string().min(16).optional(),
  headers: z.record(z.string(), z.string()).optional(),
  is_active: z.boolean().optional(),
  retry_count: z.number().int().min(0).max(10).optional(),
  timeout_ms: z.number().int().min(1000).max(30000).optional(),
});

/**
 * GET /api/admin/webhooks/[id]
 * Get webhook details and recent deliveries
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const user = await getUser();
  if (!user || !isAdmin(user)) {
    return forbiddenResponse("Admin access required");
  }

  const { id } = await params;

  const webhook = await getWebhook(id);
  if (!webhook) {
    return notFoundResponse("Webhook");
  }

  const deliveries = await getWebhookDeliveries(id, 25);

  return NextResponse.json({
    webhook,
    deliveries,
  });
}

/**
 * PATCH /api/admin/webhooks/[id]
 * Update webhook configuration
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const user = await getUser();
  if (!user || !isAdmin(user)) {
    return forbiddenResponse("Admin access required");
  }

  const enabled = await isWebhooksEnabled();
  if (!enabled) {
    return NextResponse.json({ error: "Webhooks feature is disabled" }, { status: 400 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validation = updateWebhookSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: `Invalid data: ${validation.error.issues.map((e) => e.message).join(", ")}` },
      { status: 400 }
    );
  }

  const result = await updateWebhook(id, validation.data);

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ webhook: result.webhook });
}

/**
 * DELETE /api/admin/webhooks/[id]
 * Delete a webhook
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const user = await getUser();
  if (!user || !isAdmin(user)) {
    return forbiddenResponse("Admin access required");
  }

  const { id } = await params;

  const result = await deleteWebhook(id);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}

/**
 * POST /api/admin/webhooks/[id]
 * Test webhook by sending a test payload
 */
export async function POST(_request: NextRequest, { params }: RouteParams) {
  const user = await getUser();
  if (!user || !isAdmin(user)) {
    return forbiddenResponse("Admin access required");
  }

  const enabled = await isWebhooksEnabled();
  if (!enabled) {
    return NextResponse.json({ error: "Webhooks feature is disabled" }, { status: 400 });
  }

  const { id } = await params;

  const result = await testWebhook(id);

  return NextResponse.json({
    success: result.success,
    status: result.status,
    error: result.error,
  });
}
