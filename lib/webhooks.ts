/**
 * Webhooks Service
 *
 * Manages webhook configurations and event dispatching.
 * Supports design lifecycle events (created, updated, published, unpublished, deleted).
 */

import { createServiceClient } from "@/lib/supabase/server";
import { isWebhooksEnabled } from "@/lib/feature-flags";
import { enqueueJob, jobQueue } from "@/lib/jobs";
import crypto from "crypto";

// =============================================================================
// Types
// =============================================================================

export const WEBHOOK_EVENTS = [
  "design.created",
  "design.updated",
  "design.published",
  "design.unpublished",
  "design.deleted",
  "import.started",
  "import.completed",
  "import.failed",
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export interface Webhook {
  id: string;
  name: string;
  url: string;
  secret: string | null;
  events: string[];
  is_active: boolean;
  headers: Record<string, string> | null;
  retry_count: number;
  timeout_ms: number;
  last_triggered_at: string | null;
  last_status: number | null;
  last_error: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface WebhookDelivery {
  id: string;
  webhook_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  response_status: number | null;
  response_body: string | null;
  error: string | null;
  duration_ms: number | null;
  attempt_number: number;
  delivered_at: string;
}

export interface CreateWebhookInput {
  name: string;
  url: string;
  events: string[];
  secret?: string;
  headers?: Record<string, string>;
  retry_count?: number;
  timeout_ms?: number;
}

export interface UpdateWebhookInput {
  name?: string;
  url?: string;
  events?: string[];
  secret?: string;
  headers?: Record<string, string>;
  is_active?: boolean;
  retry_count?: number;
  timeout_ms?: number;
}

export interface WebhookPayload {
  event: WebhookEvent;
  timestamp: string;
  data: Record<string, unknown>;
}

// =============================================================================
// Webhook CRUD
// =============================================================================

/**
 * List all webhooks
 */
export async function listWebhooks(): Promise<Webhook[]> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("webhooks")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[Webhooks] Error listing webhooks:", error);
    return [];
  }

  return data || [];
}

/**
 * Get a webhook by ID
 */
export async function getWebhook(id: string): Promise<Webhook | null> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("webhooks")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    return null;
  }

  return data;
}

/**
 * Create a new webhook
 */
export async function createWebhook(
  input: CreateWebhookInput,
  userId?: string
): Promise<{ webhook?: Webhook; error?: string }> {
  const enabled = await isWebhooksEnabled();
  if (!enabled) {
    return { error: "Webhooks feature is disabled" };
  }

  // Validate URL
  try {
    new URL(input.url);
  } catch {
    return { error: "Invalid webhook URL" };
  }

  // Validate events
  const invalidEvents = input.events.filter(
    (e) => !WEBHOOK_EVENTS.includes(e as WebhookEvent)
  );
  if (invalidEvents.length > 0) {
    return { error: `Invalid events: ${invalidEvents.join(", ")}` };
  }

  // Generate secret if not provided
  const secret = input.secret || crypto.randomBytes(32).toString("hex");

  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("webhooks")
    .insert({
      name: input.name,
      url: input.url,
      secret,
      events: input.events,
      headers: input.headers || {},
      retry_count: input.retry_count ?? 3,
      timeout_ms: input.timeout_ms ?? 5000,
      is_active: true,
      created_by: userId,
    })
    .select()
    .single();

  if (error) {
    return { error: error.message };
  }

  return { webhook: data };
}

/**
 * Update a webhook
 */
export async function updateWebhook(
  id: string,
  input: UpdateWebhookInput
): Promise<{ webhook?: Webhook; error?: string }> {
  const enabled = await isWebhooksEnabled();
  if (!enabled) {
    return { error: "Webhooks feature is disabled" };
  }

  // Validate URL if provided
  if (input.url) {
    try {
      new URL(input.url);
    } catch {
      return { error: "Invalid webhook URL" };
    }
  }

  // Validate events if provided
  if (input.events) {
    const invalidEvents = input.events.filter(
      (e) => !WEBHOOK_EVENTS.includes(e as WebhookEvent)
    );
    if (invalidEvents.length > 0) {
      return { error: `Invalid events: ${invalidEvents.join(", ")}` };
    }
  }

  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("webhooks")
    .update({
      ...input,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return { error: error.message };
  }

  return { webhook: data };
}

/**
 * Delete a webhook
 */
export async function deleteWebhook(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServiceClient();

  const { error } = await supabase.from("webhooks").delete().eq("id", id);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Test a webhook by sending a test payload
 */
export async function testWebhook(
  id: string
): Promise<{ success: boolean; status?: number; error?: string }> {
  const webhook = await getWebhook(id);
  if (!webhook) {
    return { success: false, error: "Webhook not found" };
  }

  const payload: WebhookPayload = {
    event: "design.created",
    timestamp: new Date().toISOString(),
    data: {
      test: true,
      message: "This is a test webhook delivery",
    },
  };

  return deliverWebhook(webhook, payload);
}

// =============================================================================
// Event Dispatching
// =============================================================================

/**
 * Dispatch an event to all subscribed webhooks
 */
export async function dispatchWebhookEvent(
  event: WebhookEvent,
  data: Record<string, unknown>
): Promise<{ dispatched: number; errors: string[] }> {
  const enabled = await isWebhooksEnabled();
  if (!enabled) {
    return { dispatched: 0, errors: [] };
  }

  const supabase = createServiceClient();
  const errors: string[] = [];

  // Find all active webhooks subscribed to this event
  const { data: webhooks, error } = await supabase
    .from("webhooks")
    .select("*")
    .eq("is_active", true)
    .contains("events", [event]);

  if (error) {
    return { dispatched: 0, errors: [error.message] };
  }

  if (!webhooks || webhooks.length === 0) {
    return { dispatched: 0, errors: [] };
  }

  const payload: WebhookPayload = {
    event,
    timestamp: new Date().toISOString(),
    data,
  };

  // Check if job queue is available for async delivery
  const queueAvailable = await jobQueue.isAvailable();

  let dispatched = 0;
  for (const webhook of webhooks) {
    if (queueAvailable) {
      // Queue for async delivery
      const result = await enqueueJob({
        type: "webhook:deliver",
        webhookId: webhook.id,
        event,
        payload: data,
      });

      if (result.queued) {
        dispatched++;
      } else {
        errors.push(`Failed to queue webhook ${webhook.id}: ${result.error}`);
      }
    } else {
      // Deliver synchronously (fallback)
      const result = await deliverWebhook(webhook, payload);
      if (result.success) {
        dispatched++;
      } else {
        errors.push(`Webhook ${webhook.id}: ${result.error}`);
      }
    }
  }

  return { dispatched, errors };
}

/**
 * Deliver a webhook payload to a specific webhook
 */
async function deliverWebhook(
  webhook: Webhook,
  payload: WebhookPayload
): Promise<{ success: boolean; status?: number; error?: string }> {
  const supabase = createServiceClient();
  const startTime = Date.now();

  try {
    // Create signature
    const payloadString = JSON.stringify(payload);
    const signature = webhook.secret
      ? crypto.createHmac("sha256", webhook.secret).update(payloadString).digest("hex")
      : null;

    // Deliver
    const response = await fetch(webhook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Event": payload.event,
        ...(signature && { "X-Webhook-Signature": `sha256=${signature}` }),
        ...(webhook.headers || {}),
      },
      body: payloadString,
      signal: AbortSignal.timeout(webhook.timeout_ms || 5000),
    });

    const duration = Date.now() - startTime;
    const responseBody = await response.text().catch(() => null);

    // Record delivery
    await supabase.from("webhook_deliveries").insert({
      webhook_id: webhook.id,
      event_type: payload.event,
      payload,
      response_status: response.status,
      response_body: responseBody,
      duration_ms: duration,
      attempt_number: 1,
    });

    // Update webhook status
    await supabase
      .from("webhooks")
      .update({
        last_triggered_at: new Date().toISOString(),
        last_status: response.status,
        last_error: response.ok ? null : `HTTP ${response.status}`,
      })
      .eq("id", webhook.id);

    return {
      success: response.ok,
      status: response.status,
      error: response.ok ? undefined : `HTTP ${response.status}`,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const message = error instanceof Error ? error.message : "Unknown error";

    // Record failed delivery
    await supabase.from("webhook_deliveries").insert({
      webhook_id: webhook.id,
      event_type: payload.event,
      payload,
      response_status: 0,
      error: message,
      duration_ms: duration,
      attempt_number: 1,
    });

    // Update webhook status
    await supabase
      .from("webhooks")
      .update({
        last_triggered_at: new Date().toISOString(),
        last_status: 0,
        last_error: message,
      })
      .eq("id", webhook.id);

    return { success: false, error: message };
  }
}

// =============================================================================
// Delivery History
// =============================================================================

/**
 * Get webhook delivery history
 */
export async function getWebhookDeliveries(
  webhookId?: string,
  limit = 50
): Promise<WebhookDelivery[]> {
  const supabase = createServiceClient();

  let query = supabase
    .from("webhook_deliveries")
    .select("*")
    .order("delivered_at", { ascending: false })
    .limit(limit);

  if (webhookId) {
    query = query.eq("webhook_id", webhookId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[Webhooks] Error fetching deliveries:", error);
    return [];
  }

  return data || [];
}

/**
 * Get webhook statistics
 */
export async function getWebhookStats(): Promise<{
  totalWebhooks: number;
  activeWebhooks: number;
  recentDeliveries: number;
  successRate: number;
}> {
  const supabase = createServiceClient();

  // Get webhook counts
  const { count: totalWebhooks } = await supabase
    .from("webhooks")
    .select("*", { count: "exact", head: true });

  const { count: activeWebhooks } = await supabase
    .from("webhooks")
    .select("*", { count: "exact", head: true })
    .eq("is_active", true);

  // Get recent delivery stats (last 24 hours)
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: deliveries } = await supabase
    .from("webhook_deliveries")
    .select("response_status")
    .gte("delivered_at", oneDayAgo);

  const recentDeliveries = deliveries?.length || 0;
  const successfulDeliveries =
    deliveries?.filter((d) => d.response_status && d.response_status >= 200 && d.response_status < 300)
      .length || 0;

  const successRate =
    recentDeliveries > 0 ? Math.round((successfulDeliveries / recentDeliveries) * 100) : 100;

  return {
    totalWebhooks: totalWebhooks || 0,
    activeWebhooks: activeWebhooks || 0,
    recentDeliveries,
    successRate,
  };
}
