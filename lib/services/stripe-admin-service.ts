/**
 * Stripe Admin Service
 *
 * Handles Stripe admin operations including:
 * - API key management (stored in database)
 * - Product and price management
 * - Tier-to-price mappings
 */

import Stripe from "stripe";
import { createServiceClient } from "@/lib/supabase/server";

// Setting keys for Stripe configuration
const STRIPE_SECRET_KEY = "stripe_secret_key";
const STRIPE_PUBLISHABLE_KEY = "stripe_publishable_key";
const STRIPE_WEBHOOK_SECRET = "stripe_webhook_secret";

export interface StripeSettings {
  secretKey: string | null;
  publishableKey: string | null;
  webhookSecret: string | null;
  isConfigured: boolean;
}

export interface StripeProduct {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  prices: StripePrice[];
}

export interface StripePrice {
  id: string;
  productId: string;
  nickname: string | null;
  unitAmount: number | null;
  currency: string;
  type: "recurring" | "one_time";
  interval?: "year" | "month" | "week" | "day";
  active: boolean;
}

export interface TierMapping {
  tierId: string;
  tierName: string;
  tierSlug: string;
  stripePriceIdYearly: string | null;
  stripePriceIdLifetime: string | null;
}

/**
 * Get a Stripe client using stored credentials
 */
async function getStripeClient(): Promise<Stripe | null> {
  const settings = await getStripeSettings();
  if (!settings.secretKey) {
    return null;
  }
  return new Stripe(settings.secretKey);
}

/**
 * Get Stripe settings from database
 */
export async function getStripeSettings(): Promise<StripeSettings> {
  const supabase = createServiceClient();

  const { data } = await supabase
    .from("app_settings")
    .select("key, value")
    .in("key", [STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY, STRIPE_WEBHOOK_SECRET]);

  const settings: Record<string, string | null> = {};
  data?.forEach((row) => {
    settings[row.key] = row.value;
  });

  const secretKey = settings[STRIPE_SECRET_KEY] || null;
  const publishableKey = settings[STRIPE_PUBLISHABLE_KEY] || null;
  const webhookSecret = settings[STRIPE_WEBHOOK_SECRET] || null;

  return {
    secretKey,
    publishableKey,
    webhookSecret,
    isConfigured: !!(secretKey && publishableKey),
  };
}

/**
 * Get masked Stripe settings for display (hide full keys)
 */
export async function getMaskedStripeSettings(): Promise<{
  secretKey: string;
  publishableKey: string;
  webhookSecret: string;
  isConfigured: boolean;
}> {
  const settings = await getStripeSettings();

  const maskKey = (key: string | null): string => {
    if (!key) return "";
    if (key.length <= 12) return "****";
    return key.slice(0, 7) + "..." + key.slice(-4);
  };

  return {
    secretKey: maskKey(settings.secretKey),
    publishableKey: maskKey(settings.publishableKey),
    webhookSecret: maskKey(settings.webhookSecret),
    isConfigured: settings.isConfigured,
  };
}

/**
 * Save Stripe settings to database
 */
export async function saveStripeSettings(
  settings: {
    secretKey?: string;
    publishableKey?: string;
    webhookSecret?: string;
  },
  updatedBy: string
): Promise<void> {
  const supabase = createServiceClient();

  const updates: Array<{
    key: string;
    value: string;
    is_secret: boolean;
    updated_at: string;
    updated_by: string;
  }> = [];

  if (settings.secretKey !== undefined) {
    updates.push({
      key: STRIPE_SECRET_KEY,
      value: settings.secretKey,
      is_secret: true,
      updated_at: new Date().toISOString(),
      updated_by: updatedBy,
    });
  }

  if (settings.publishableKey !== undefined) {
    updates.push({
      key: STRIPE_PUBLISHABLE_KEY,
      value: settings.publishableKey,
      is_secret: false,
      updated_at: new Date().toISOString(),
      updated_by: updatedBy,
    });
  }

  if (settings.webhookSecret !== undefined) {
    updates.push({
      key: STRIPE_WEBHOOK_SECRET,
      value: settings.webhookSecret,
      is_secret: true,
      updated_at: new Date().toISOString(),
      updated_by: updatedBy,
    });
  }

  if (updates.length > 0) {
    await supabase.from("app_settings").upsert(updates, { onConflict: "key" });
  }
}

/**
 * Test Stripe connection with current credentials
 */
export async function testStripeConnection(): Promise<{
  success: boolean;
  message: string;
  accountName?: string;
}> {
  try {
    const stripe = await getStripeClient();
    if (!stripe) {
      return {
        success: false,
        message: "Stripe credentials not configured",
      };
    }

    // Try to retrieve account info to verify the key works
    const account = await stripe.accounts.retrieve();

    return {
      success: true,
      message: "Connection successful",
      accountName: account.settings?.dashboard?.display_name || account.id,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to connect to Stripe";
    return {
      success: false,
      message,
    };
  }
}

/**
 * List all Stripe products with their prices
 */
export async function listStripeProducts(): Promise<StripeProduct[]> {
  const stripe = await getStripeClient();
  if (!stripe) {
    return [];
  }

  try {
    // Fetch products
    const products = await stripe.products.list({
      active: true,
      limit: 100,
    });

    // Fetch all prices
    const prices = await stripe.prices.list({
      active: true,
      limit: 100,
    });

    // Group prices by product
    const pricesByProduct: Record<string, StripePrice[]> = {};
    prices.data.forEach((price) => {
      const productId =
        typeof price.product === "string" ? price.product : price.product.id;

      if (!pricesByProduct[productId]) {
        pricesByProduct[productId] = [];
      }

      pricesByProduct[productId].push({
        id: price.id,
        productId,
        nickname: price.nickname,
        unitAmount: price.unit_amount,
        currency: price.currency,
        type: price.type,
        interval: price.recurring?.interval,
        active: price.active,
      });
    });

    // Build product list with prices
    return products.data.map((product) => ({
      id: product.id,
      name: product.name,
      description: product.description,
      active: product.active,
      prices: pricesByProduct[product.id] || [],
    }));
  } catch (error) {
    console.error("[StripeAdmin] Error listing products:", error);
    return [];
  }
}

/**
 * Create a new Stripe product
 */
export async function createStripeProduct(data: {
  name: string;
  description?: string;
}): Promise<StripeProduct | null> {
  const stripe = await getStripeClient();
  if (!stripe) {
    throw new Error("Stripe not configured");
  }

  try {
    const product = await stripe.products.create({
      name: data.name,
      description: data.description,
    });

    return {
      id: product.id,
      name: product.name,
      description: product.description,
      active: product.active,
      prices: [],
    };
  } catch (error) {
    console.error("[StripeAdmin] Error creating product:", error);
    throw error;
  }
}

/**
 * Update a Stripe product
 */
export async function updateStripeProduct(
  productId: string,
  data: {
    name?: string;
    description?: string;
    active?: boolean;
  }
): Promise<void> {
  const stripe = await getStripeClient();
  if (!stripe) {
    throw new Error("Stripe not configured");
  }

  await stripe.products.update(productId, data);
}

/**
 * Create a new price for a product
 */
export async function createStripePrice(data: {
  productId: string;
  unitAmount: number;
  currency?: string;
  type: "recurring" | "one_time";
  interval?: "year" | "month";
  nickname?: string;
}): Promise<StripePrice> {
  const stripe = await getStripeClient();
  if (!stripe) {
    throw new Error("Stripe not configured");
  }

  const priceData: Stripe.PriceCreateParams = {
    product: data.productId,
    unit_amount: data.unitAmount,
    currency: data.currency || "usd",
    nickname: data.nickname,
  };

  if (data.type === "recurring" && data.interval) {
    priceData.recurring = { interval: data.interval };
  }

  const price = await stripe.prices.create(priceData);

  return {
    id: price.id,
    productId: data.productId,
    nickname: price.nickname,
    unitAmount: price.unit_amount,
    currency: price.currency,
    type: price.type,
    interval: price.recurring?.interval,
    active: price.active,
  };
}

/**
 * Get tier mappings (access tiers with their linked Stripe prices)
 */
export async function getTierMappings(): Promise<TierMapping[]> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("access_tiers")
    .select(
      "id, name, slug, stripe_price_id_yearly, stripe_price_id_lifetime"
    )
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("[StripeAdmin] Error fetching tier mappings:", error);
    return [];
  }

  return data.map((tier) => ({
    tierId: tier.id,
    tierName: tier.name,
    tierSlug: tier.slug,
    stripePriceIdYearly: tier.stripe_price_id_yearly,
    stripePriceIdLifetime: tier.stripe_price_id_lifetime,
  }));
}

/**
 * Update tier-to-price mappings
 */
export async function updateTierMappings(
  mappings: Array<{
    tierId: string;
    stripePriceIdYearly: string | null;
    stripePriceIdLifetime: string | null;
  }>
): Promise<void> {
  const supabase = createServiceClient();

  for (const mapping of mappings) {
    await supabase
      .from("access_tiers")
      .update({
        stripe_price_id_yearly: mapping.stripePriceIdYearly,
        stripe_price_id_lifetime: mapping.stripePriceIdLifetime,
      })
      .eq("id", mapping.tierId);
  }
}

/**
 * Get the Stripe secret key for use in other services
 * Falls back to environment variable if not in database
 */
export async function getStripeSecretKey(): Promise<string | null> {
  const settings = await getStripeSettings();
  return settings.secretKey || process.env.STRIPE_SECRET_KEY || null;
}

/**
 * Get the Stripe webhook secret for use in webhook handler
 * Falls back to environment variable if not in database
 */
export async function getStripeWebhookSecret(): Promise<string | null> {
  const settings = await getStripeSettings();
  return settings.webhookSecret || process.env.STRIPE_WEBHOOK_SECRET || null;
}
