/**
 * Webhooks API
 *
 * GET /api/admin/webhooks - List all webhooks
 * POST /api/admin/webhooks - Create a new webhook
 */

import { NextRequest, NextResponse } from "next/server";
import { getUser, isAdmin } from "@/lib/auth";
import { isWebhooksEnabled } from "@/lib/feature-flags";
import {
  listWebhooks,
  createWebhook,
  getWebhookStats,
  WEBHOOK_EVENTS,
} from "@/lib/webhooks";
import { z } from "zod";
import { forbiddenResponse } from "@/lib/api/helpers";

export const runtime = "nodejs";

const createWebhookSchema = z.object({
  name: z.string().min(1).max(255),
  url: z.string().url(),
  events: z.array(z.string()).min(1),
  secret: z.string().min(16).optional(),
  headers: z.record(z.string(), z.string()).optional(),
  retry_count: z.number().int().min(0).max(10).optional(),
  timeout_ms: z.number().int().min(1000).max(30000).optional(),
});

/**
 * GET /api/admin/webhooks
 * List all webhooks and stats
 */
export async function GET() {
  const user = await getUser();
  if (!user || !isAdmin(user)) {
    return forbiddenResponse("Admin access required");
  }

  const enabled = await isWebhooksEnabled();
  if (!enabled) {
    return NextResponse.json({
      enabled: false,
      webhooks: [],
      stats: null,
      availableEvents: [],
      message: "Webhooks feature is disabled",
    });
  }

  const [webhooks, stats] = await Promise.all([listWebhooks(), getWebhookStats()]);

  return NextResponse.json({
    enabled: true,
    webhooks,
    stats,
    availableEvents: WEBHOOK_EVENTS,
  });
}

/**
 * POST /api/admin/webhooks
 * Create a new webhook
 */
export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user || !isAdmin(user)) {
    return forbiddenResponse("Admin access required");
  }

  const enabled = await isWebhooksEnabled();
  if (!enabled) {
    return NextResponse.json({ error: "Webhooks feature is disabled" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validation = createWebhookSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: `Invalid data: ${validation.error.issues.map((e) => e.message).join(", ")}` },
      { status: 400 }
    );
  }

  const result = await createWebhook(validation.data, user.id);

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ webhook: result.webhook }, { status: 201 });
}
