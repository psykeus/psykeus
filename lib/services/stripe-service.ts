/**
 * Stripe Service
 *
 * Handles Stripe payment operations including checkout sessions,
 * customer portal, webhooks, and subscription management.
 */

import Stripe from "stripe";
import { createServiceClient } from "@/lib/supabase/server";
import { getStripeSecretKey, getStripeWebhookSecret } from "@/lib/services/stripe-admin-service";
import type {
  SubscriptionDetails,
  PaymentHistory,
  SubscriptionType,
  PaymentType,
  AccessTierWithStripe,
  AccessTierFull,
  AccessTierForPricing,
  StripePriceInfo,
  TierFeature,
} from "@/lib/types";

// Cached Stripe instance and the key it was created with
let _stripe: Stripe | null = null;
let _stripeKey: string | null = null;

/**
 * Get Stripe client using database settings (with env fallback)
 */
async function getStripe(): Promise<Stripe> {
  const secretKey = await getStripeSecretKey();

  if (!secretKey) {
    throw new Error(
      "Stripe is not configured. Please set up Stripe credentials in Admin > Stripe Settings."
    );
  }

  // Reuse existing instance if key hasn't changed
  if (_stripe && _stripeKey === secretKey) {
    return _stripe;
  }

  _stripe = new Stripe(secretKey);
  _stripeKey = secretKey;
  return _stripe;
}

/**
 * Get or create a Stripe customer for a user
 */
export async function getOrCreateStripeCustomer(
  userId: string,
  email: string,
  name?: string | null
): Promise<string> {
  const supabase = createServiceClient();

  // Check if user already has a Stripe customer ID
  const { data: user } = await supabase
    .from("users")
    .select("stripe_customer_id")
    .eq("id", userId)
    .single();

  if (user?.stripe_customer_id) {
    return user.stripe_customer_id;
  }

  // Create new Stripe customer
  const stripe = await getStripe();
  const customer = await stripe.customers.create({
    email,
    name: name || undefined,
    metadata: {
      user_id: userId,
    },
  });

  // Save customer ID to database
  await supabase
    .from("users")
    .update({ stripe_customer_id: customer.id })
    .eq("id", userId);

  return customer.id;
}

/**
 * Create a checkout session for a tier purchase
 */
export async function createCheckoutSession(params: {
  userId: string;
  email: string;
  name?: string | null;
  tierId: string;
  priceType: "yearly" | "lifetime";
  successUrl: string;
  cancelUrl: string;
  promoCode?: string;
}): Promise<{ sessionId: string; url: string }> {
  const { userId, email, name, tierId, priceType, successUrl, cancelUrl, promoCode } = params;
  const supabase = createServiceClient();
  const stripe = await getStripe();

  // Get the tier with Stripe price IDs
  const { data: tier, error: tierError } = await supabase
    .from("access_tiers")
    .select("*, stripe_price_id_yearly, stripe_price_id_lifetime")
    .eq("id", tierId)
    .single();

  if (tierError || !tier) {
    throw new Error("Tier not found");
  }

  const priceId =
    priceType === "yearly"
      ? tier.stripe_price_id_yearly
      : tier.stripe_price_id_lifetime;

  if (!priceId) {
    throw new Error(`No ${priceType} price configured for this tier`);
  }

  // Get or create Stripe customer
  const customerId = await getOrCreateStripeCustomer(userId, email, name);

  // Create checkout session
  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    customer: customerId,
    mode: priceType === "yearly" ? "subscription" : "payment",
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      user_id: userId,
      tier_id: tierId,
      price_type: priceType,
    },
    allow_promotion_codes: !promoCode, // Allow user to enter codes if none provided
  };

  // If a promo code was provided, look up and apply it
  if (promoCode) {
    try {
      // Look up the promotion code
      const promoCodes = await stripe.promotionCodes.list({
        code: promoCode,
        active: true,
        limit: 1,
      });

      if (promoCodes.data.length === 0) {
        throw new Error(`Invalid promo code: ${promoCode}`);
      }

      const promotionCode = promoCodes.data[0];

      // Apply the discount
      if (priceType === "yearly") {
        // For subscriptions, use discounts
        sessionParams.discounts = [{ promotion_code: promotionCode.id }];
      } else {
        // For one-time payments, use discounts as well
        sessionParams.discounts = [{ promotion_code: promotionCode.id }];
      }
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("Invalid promo code")) {
        throw error;
      }
      console.error("[StripeService] Error looking up promo code:", error);
      throw new Error(`Invalid or expired promo code: ${promoCode}`);
    }
  }

  // For one-time payments, set invoice creation for receipt
  if (priceType === "lifetime") {
    sessionParams.invoice_creation = {
      enabled: true,
    };
  }

  const session = await stripe.checkout.sessions.create(sessionParams);

  return {
    sessionId: session.id,
    url: session.url || "",
  };
}

/**
 * Create a billing portal session for subscription management
 */
export async function createPortalSession(params: {
  userId: string;
  returnUrl: string;
}): Promise<{ url: string }> {
  const { userId, returnUrl } = params;
  const supabase = createServiceClient();

  // Get user's Stripe customer ID
  const { data: user } = await supabase
    .from("users")
    .select("stripe_customer_id")
    .eq("id", userId)
    .single();

  if (!user?.stripe_customer_id) {
    throw new Error("No Stripe customer found for this user");
  }

  const stripe = await getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: user.stripe_customer_id,
    return_url: returnUrl,
  });

  return { url: session.url };
}

/**
 * Get subscription details for a user
 */
export async function getSubscriptionDetails(
  userId: string
): Promise<SubscriptionDetails> {
  const supabase = createServiceClient();

  const { data: user } = await supabase
    .from("users")
    .select(`
      subscription_status,
      subscription_type,
      subscription_period_end,
      tier_id,
      access_tier:access_tiers(name)
    `)
    .eq("id", userId)
    .single();

  if (!user) {
    return {
      status: null,
      type: null,
      tier_id: null,
      tier_name: null,
      period_end: null,
      cancel_at_period_end: false,
    };
  }

  // Check if subscription is set to cancel
  let cancelAtPeriodEnd = false;
  if (user.subscription_status === "active") {
    const { data: subUser } = await supabase
      .from("users")
      .select("stripe_subscription_id")
      .eq("id", userId)
      .single();

    if (subUser?.stripe_subscription_id) {
      try {
        const stripe = await getStripe();
        const subscription = await stripe.subscriptions.retrieve(
          subUser.stripe_subscription_id
        );
        cancelAtPeriodEnd = subscription.cancel_at_period_end;
      } catch {
        // Subscription may not exist anymore
      }
    }
  }

  // access_tier is returned as an array from the join query
  const tierArray = user.access_tier as Array<{ name: string }> | null;
  const tierData = tierArray?.[0] || null;

  return {
    status: user.subscription_status as SubscriptionDetails["status"],
    type: user.subscription_type as SubscriptionType | null,
    tier_id: user.tier_id,
    tier_name: tierData?.name || null,
    period_end: user.subscription_period_end,
    cancel_at_period_end: cancelAtPeriodEnd,
  };
}

/**
 * Get payment history for a user
 */
export async function getPaymentHistory(
  userId: string,
  limit: number = 10
): Promise<PaymentHistory[]> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("payment_history")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[StripeService] Error fetching payment history:", error);
    return [];
  }

  return data as PaymentHistory[];
}

/**
 * Check if a webhook event has already been processed (idempotency)
 */
export async function isEventProcessed(eventId: string): Promise<boolean> {
  const supabase = createServiceClient();

  const { data } = await supabase
    .from("stripe_webhook_events")
    .select("processed")
    .eq("stripe_event_id", eventId)
    .single();

  return data?.processed === true;
}

/**
 * Record a webhook event for idempotency tracking
 */
export async function recordWebhookEvent(
  eventId: string,
  eventType: string,
  payload: Stripe.Event
): Promise<void> {
  const supabase = createServiceClient();

  await supabase.from("stripe_webhook_events").upsert({
    stripe_event_id: eventId,
    event_type: eventType,
    payload: payload as unknown as Record<string, unknown>,
    created_at: new Date().toISOString(),
  });
}

/**
 * Mark a webhook event as processed
 */
export async function markEventProcessed(
  eventId: string,
  error?: string
): Promise<void> {
  const supabase = createServiceClient();

  await supabase
    .from("stripe_webhook_events")
    .update({
      processed: true,
      processed_at: new Date().toISOString(),
      processing_error: error || null,
    })
    .eq("stripe_event_id", eventId);
}

/**
 * Handle checkout.session.completed event
 */
export async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session
): Promise<void> {
  const supabase = createServiceClient();

  const userId = session.metadata?.user_id;
  const tierId = session.metadata?.tier_id;
  const priceType = session.metadata?.price_type as "yearly" | "lifetime";

  if (!userId || !tierId) {
    throw new Error("Missing metadata in checkout session");
  }

  // Determine subscription type and expiration
  const isLifetime = priceType === "lifetime";
  const subscriptionType: SubscriptionType = isLifetime ? "lifetime" : "yearly";
  const paymentType: PaymentType = isLifetime ? "one_time" : "subscription";

  // Calculate period end (lifetime = null, yearly = 1 year from now)
  const periodEnd = isLifetime
    ? null
    : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

  // Update user with tier and subscription info
  const updateData: Record<string, unknown> = {
    tier_id: tierId,
    subscription_status: "active",
    subscription_type: subscriptionType,
    subscription_period_end: periodEnd,
  };

  // For subscriptions, store the subscription ID
  if (session.subscription) {
    updateData.stripe_subscription_id = session.subscription;
  }

  // For lifetime, tier never expires
  if (isLifetime) {
    updateData.tier_expires_at = null;
  } else {
    updateData.tier_expires_at = periodEnd;
  }

  await supabase.from("users").update(updateData).eq("id", userId);

  // Record payment in history
  await supabase.from("payment_history").insert({
    user_id: userId,
    stripe_checkout_session_id: session.id,
    stripe_payment_intent_id:
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id,
    amount_cents: session.amount_total || 0,
    currency: session.currency || "usd",
    payment_type: paymentType,
    tier_id: tierId,
    status: "succeeded",
    metadata: {
      price_type: priceType,
      customer_email: session.customer_details?.email,
    },
  });

  // Log in subscription history
  await supabase.from("subscription_history").insert({
    user_id: userId,
    tier_id: tierId,
    action: "purchase",
    reason: `${priceType} purchase via Stripe`,
    starts_at: new Date().toISOString(),
    expires_at: periodEnd,
  });
}

/**
 * Handle customer.subscription.updated event
 */
export async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription
): Promise<void> {
  const supabase = createServiceClient();

  // Find user by Stripe customer ID
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  const { data: user } = await supabase
    .from("users")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .single();

  if (!user) {
    console.error(
      "[StripeService] User not found for customer:",
      customerId
    );
    return;
  }

  // Update subscription status
  // Get period end from the first subscription item
  const firstItem = subscription.items?.data?.[0];
  const periodEndTimestamp = firstItem?.current_period_end;
  const periodEnd = periodEndTimestamp
    ? new Date(periodEndTimestamp * 1000).toISOString()
    : null;

  await supabase
    .from("users")
    .update({
      subscription_status: subscription.status,
      subscription_period_end: periodEnd,
      tier_expires_at: periodEnd,
    })
    .eq("id", user.id);
}

/**
 * Handle customer.subscription.deleted event
 */
export async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription
): Promise<void> {
  const supabase = createServiceClient();

  // Find user by Stripe customer ID
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  const { data: user } = await supabase
    .from("users")
    .select("id, subscription_type")
    .eq("stripe_customer_id", customerId)
    .single();

  if (!user) {
    console.error(
      "[StripeService] User not found for customer:",
      customerId
    );
    return;
  }

  // Don't downgrade lifetime users
  if (user.subscription_type === "lifetime") {
    return;
  }

  // Get the free tier ID
  const { data: freeTier } = await supabase
    .from("access_tiers")
    .select("id")
    .eq("slug", "free")
    .single();

  // Downgrade to free tier
  await supabase
    .from("users")
    .update({
      tier_id: freeTier?.id || null,
      subscription_status: "canceled",
      subscription_period_end: null,
      stripe_subscription_id: null,
      tier_expires_at: null,
    })
    .eq("id", user.id);

  // Log in subscription history
  await supabase.from("subscription_history").insert({
    user_id: user.id,
    tier_id: freeTier?.id,
    action: "downgrade",
    previous_tier_id: user.id,
    reason: "Subscription canceled",
  });
}

/**
 * Handle invoice.payment_succeeded event
 */
export async function handleInvoicePaymentSucceeded(
  invoice: Stripe.Invoice
): Promise<void> {
  const supabase = createServiceClient();

  // Find user by Stripe customer ID
  const customerId =
    typeof invoice.customer === "string"
      ? invoice.customer
      : invoice.customer?.id;

  if (!customerId) return;

  const { data: user } = await supabase
    .from("users")
    .select("id, tier_id")
    .eq("stripe_customer_id", customerId)
    .single();

  if (!user) return;

  // Record payment (for renewals)
  await supabase.from("payment_history").insert({
    user_id: user.id,
    stripe_invoice_id: invoice.id,
    stripe_payment_intent_id: null,
    amount_cents: invoice.amount_paid ?? 0,
    currency: invoice.currency ?? "usd",
    payment_type: "subscription",
    tier_id: user.tier_id,
    status: "succeeded",
    metadata: {
      billing_reason: invoice.billing_reason,
    },
  });
}

/**
 * Handle invoice.payment_failed event
 */
export async function handleInvoicePaymentFailed(
  invoice: Stripe.Invoice
): Promise<void> {
  const supabase = createServiceClient();

  // Find user by Stripe customer ID
  const customerId =
    typeof invoice.customer === "string"
      ? invoice.customer
      : invoice.customer?.id;

  if (!customerId) return;

  const { data: user } = await supabase
    .from("users")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .single();

  if (!user) return;

  // Update subscription status to past_due
  await supabase
    .from("users")
    .update({
      subscription_status: "past_due",
    })
    .eq("id", user.id);
}

/**
 * Construct a Stripe event from raw body and signature
 */
export async function constructWebhookEvent(
  rawBody: string | Buffer,
  signature: string
): Promise<Stripe.Event> {
  const webhookSecret = await getStripeWebhookSecret();

  if (!webhookSecret) {
    throw new Error(
      "Stripe webhook secret is not configured. Please set it up in Admin > Stripe Settings."
    );
  }

  const stripe = await getStripe();
  return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
}

/**
 * Get all access tiers with Stripe pricing info
 */
export async function getAccessTiersWithPricing(): Promise<AccessTierWithStripe[]> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("access_tiers")
    .select("*, stripe_price_id_yearly, stripe_price_id_lifetime")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("[StripeService] Error fetching tiers:", error);
    return [];
  }

  return data as AccessTierWithStripe[];
}

/**
 * Get all access tiers with features for pricing page display
 */
export async function getAccessTiersForPricing(): Promise<AccessTierFull[]> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("access_tiers")
    .select(`
      *,
      stripe_price_id_yearly,
      stripe_price_id_lifetime,
      tier_features(*)
    `)
    .eq("is_active", true)
    .eq("show_on_pricing", true)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("[StripeService] Error fetching tiers for pricing:", error);
    return [];
  }

  // Sort features and map to expected structure
  return (data || []).map((tier) => ({
    ...tier,
    features: ((tier.tier_features as TierFeature[]) || [])
      .filter((f) => f.is_active)
      .sort((a, b) => a.sort_order - b.sort_order),
  })) as AccessTierFull[];
}

/**
 * Format price amount for display
 */
function formatPrice(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

/**
 * Fetch a single Stripe price by ID
 */
async function fetchStripePrice(priceId: string): Promise<StripePriceInfo | null> {
  try {
    const stripe = await getStripe();
    const price = await stripe.prices.retrieve(priceId);

    if (!price.active || price.unit_amount === null) {
      return null;
    }

    return {
      id: price.id,
      amount: price.unit_amount,
      currency: price.currency,
      interval: price.recurring?.interval as "month" | "year" | undefined,
      formatted: formatPrice(price.unit_amount, price.currency),
    };
  } catch (error) {
    console.error(`[StripeService] Error fetching price ${priceId}:`, error);
    return null;
  }
}

/**
 * Get access tiers with live Stripe pricing data
 * This fetches actual prices from Stripe to ensure pricing page is accurate
 */
export async function getAccessTiersWithLivePricing(): Promise<AccessTierForPricing[]> {
  // First get tiers with features from database
  const tiers = await getAccessTiersForPricing();

  // Collect all price IDs that need to be fetched
  const priceIds: string[] = [];
  tiers.forEach((tier) => {
    if (tier.stripe_price_id_yearly) priceIds.push(tier.stripe_price_id_yearly);
    if (tier.stripe_price_id_lifetime) priceIds.push(tier.stripe_price_id_lifetime);
  });

  // Fetch all prices in parallel
  const pricePromises = priceIds.map((id) => fetchStripePrice(id));
  const prices = await Promise.all(pricePromises);

  // Create a map of price ID to price info
  const priceMap = new Map<string, StripePriceInfo>();
  priceIds.forEach((id, index) => {
    const price = prices[index];
    if (price) {
      priceMap.set(id, price);
    }
  });

  // Attach live pricing to tiers
  return tiers.map((tier) => ({
    ...tier,
    stripe_yearly_price: tier.stripe_price_id_yearly
      ? priceMap.get(tier.stripe_price_id_yearly) || null
      : null,
    stripe_lifetime_price: tier.stripe_price_id_lifetime
      ? priceMap.get(tier.stripe_price_id_lifetime) || null
      : null,
  }));
}

/**
 * Cancel a subscription at period end
 */
export async function cancelSubscription(userId: string): Promise<boolean> {
  const supabase = createServiceClient();

  const { data: user } = await supabase
    .from("users")
    .select("stripe_subscription_id")
    .eq("id", userId)
    .single();

  if (!user?.stripe_subscription_id) {
    throw new Error("No active subscription found");
  }

  const stripe = await getStripe();
  await stripe.subscriptions.update(user.stripe_subscription_id, {
    cancel_at_period_end: true,
  });

  return true;
}

/**
 * Reactivate a canceled subscription
 */
export async function reactivateSubscription(userId: string): Promise<boolean> {
  const supabase = createServiceClient();

  const { data: user } = await supabase
    .from("users")
    .select("stripe_subscription_id")
    .eq("id", userId)
    .single();

  if (!user?.stripe_subscription_id) {
    throw new Error("No subscription found");
  }

  const stripe = await getStripe();
  await stripe.subscriptions.update(user.stripe_subscription_id, {
    cancel_at_period_end: false,
  });

  return true;
}
