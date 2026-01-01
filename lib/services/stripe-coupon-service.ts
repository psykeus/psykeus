/**
 * Stripe Coupon Service
 *
 * Handles Stripe coupon and promo code operations including:
 * - Coupon CRUD (create, read, update, delete)
 * - Promo code CRUD (create, read, update/deactivate)
 * - Analytics queries for coupon usage
 */

import Stripe from "stripe";
import { createServiceClient } from "@/lib/supabase/server";
import { getStripeSecretKey } from "./stripe-admin-service";
import type {
  StripeCoupon,
  StripePromoCode,
  CreateCouponRequest,
  UpdateCouponRequest,
  CreatePromoCodeRequest,
  UpdatePromoCodeRequest,
  CouponAnalytics,
  CouponUsageStats,
  PromoCodeUsageStats,
  AnalyticsDataPoint,
  ExpiringItem,
} from "@/lib/types";

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get a Stripe client instance
 */
async function getStripeClient(): Promise<Stripe | null> {
  const secretKey = await getStripeSecretKey();
  if (!secretKey) {
    return null;
  }
  return new Stripe(secretKey);
}

/**
 * Convert Stripe coupon to our interface
 */
function formatCoupon(coupon: Stripe.Coupon): StripeCoupon {
  return {
    id: coupon.id,
    name: coupon.name,
    percentOff: coupon.percent_off,
    amountOff: coupon.amount_off,
    currency: coupon.currency,
    duration: coupon.duration,
    durationInMonths: coupon.duration_in_months ?? null,
    maxRedemptions: coupon.max_redemptions ?? null,
    timesRedeemed: coupon.times_redeemed,
    redeemBy: coupon.redeem_by
      ? new Date(coupon.redeem_by * 1000).toISOString()
      : null,
    valid: coupon.valid,
    created: new Date(coupon.created * 1000).toISOString(),
    metadata: (coupon.metadata as Record<string, string>) || {},
  };
}

/**
 * Convert Stripe promo code to our interface
 */
function formatPromoCode(promoCode: Stripe.PromotionCode): StripePromoCode {
  const couponId =
    typeof promoCode.promotion.coupon === "string"
      ? promoCode.promotion.coupon
      : promoCode.promotion.coupon?.id ?? "";

  return {
    id: promoCode.id,
    code: promoCode.code,
    couponId,
    active: promoCode.active,
    maxRedemptions: promoCode.max_redemptions ?? null,
    timesRedeemed: promoCode.times_redeemed,
    expiresAt: promoCode.expires_at
      ? new Date(promoCode.expires_at * 1000).toISOString()
      : null,
    firstTimeTransaction: promoCode.restrictions?.first_time_transaction ?? false,
    minimumAmount: promoCode.restrictions?.minimum_amount ?? null,
    minimumAmountCurrency: promoCode.restrictions?.minimum_amount_currency ?? null,
    created: new Date(promoCode.created * 1000).toISOString(),
    metadata: (promoCode.metadata as Record<string, string>) || {},
  };
}

// =============================================================================
// Coupon CRUD Operations
// =============================================================================

/**
 * List all coupons with their promo codes
 */
export async function listCoupons(
  includeInvalid = false
): Promise<StripeCoupon[]> {
  const stripe = await getStripeClient();
  if (!stripe) {
    throw new Error("Stripe not configured");
  }

  try {
    // Fetch all coupons
    const coupons = await stripe.coupons.list({ limit: 100 });

    // Fetch all promo codes
    const promoCodes = await stripe.promotionCodes.list({
      limit: 100,
      active: includeInvalid ? undefined : true,
    });

    // Group promo codes by coupon ID
    const promoCodesByCoupon: Record<string, StripePromoCode[]> = {};
    for (const pc of promoCodes.data) {
      const couponId =
        typeof pc.promotion.coupon === "string" ? pc.promotion.coupon : pc.promotion.coupon?.id ?? "";
      if (!promoCodesByCoupon[couponId]) {
        promoCodesByCoupon[couponId] = [];
      }
      promoCodesByCoupon[couponId].push(formatPromoCode(pc));
    }

    // Format coupons with their promo codes
    const result: StripeCoupon[] = coupons.data
      .filter((c) => includeInvalid || c.valid)
      .map((coupon) => ({
        ...formatCoupon(coupon),
        promoCodes: promoCodesByCoupon[coupon.id] || [],
      }));

    return result;
  } catch (error) {
    console.error("[StripeCoupon] Error listing coupons:", error);
    throw error;
  }
}

/**
 * Get a single coupon by ID with its promo codes
 */
export async function getCoupon(couponId: string): Promise<StripeCoupon> {
  const stripe = await getStripeClient();
  if (!stripe) {
    throw new Error("Stripe not configured");
  }

  try {
    const coupon = await stripe.coupons.retrieve(couponId);

    // Get promo codes for this coupon
    const promoCodes = await stripe.promotionCodes.list({
      coupon: couponId,
      limit: 100,
    });

    return {
      ...formatCoupon(coupon),
      promoCodes: promoCodes.data.map(formatPromoCode),
    };
  } catch (error) {
    console.error("[StripeCoupon] Error getting coupon:", error);
    throw error;
  }
}

/**
 * Create a new coupon
 */
export async function createCoupon(
  data: CreateCouponRequest
): Promise<StripeCoupon> {
  const stripe = await getStripeClient();
  if (!stripe) {
    throw new Error("Stripe not configured");
  }

  // Validate: must have either percentOff or amountOff
  if (!data.percentOff && !data.amountOff) {
    throw new Error("Must specify either percentOff or amountOff");
  }
  if (data.percentOff && data.amountOff) {
    throw new Error("Cannot specify both percentOff and amountOff");
  }
  if (data.amountOff && !data.currency) {
    throw new Error("Currency is required for fixed amount discounts");
  }
  if (data.duration === "repeating" && !data.durationInMonths) {
    throw new Error("durationInMonths is required for repeating duration");
  }

  try {
    const couponData: Stripe.CouponCreateParams = {
      name: data.name,
      duration: data.duration,
      metadata: data.metadata,
    };

    if (data.percentOff) {
      couponData.percent_off = data.percentOff;
    } else if (data.amountOff) {
      couponData.amount_off = data.amountOff;
      couponData.currency = data.currency;
    }

    if (data.duration === "repeating" && data.durationInMonths) {
      couponData.duration_in_months = data.durationInMonths;
    }

    if (data.maxRedemptions) {
      couponData.max_redemptions = data.maxRedemptions;
    }

    if (data.redeemBy) {
      couponData.redeem_by = Math.floor(new Date(data.redeemBy).getTime() / 1000);
    }

    const coupon = await stripe.coupons.create(couponData);

    return {
      ...formatCoupon(coupon),
      promoCodes: [],
    };
  } catch (error) {
    console.error("[StripeCoupon] Error creating coupon:", error);
    throw error;
  }
}

/**
 * Update a coupon (only name and metadata can be updated)
 */
export async function updateCoupon(
  couponId: string,
  data: UpdateCouponRequest
): Promise<StripeCoupon> {
  const stripe = await getStripeClient();
  if (!stripe) {
    throw new Error("Stripe not configured");
  }

  try {
    const updateData: Stripe.CouponUpdateParams = {};

    if (data.name !== undefined) {
      updateData.name = data.name;
    }
    if (data.metadata !== undefined) {
      updateData.metadata = data.metadata;
    }

    const coupon = await stripe.coupons.update(couponId, updateData);

    // Get promo codes for this coupon
    const promoCodes = await stripe.promotionCodes.list({
      coupon: couponId,
      limit: 100,
    });

    return {
      ...formatCoupon(coupon),
      promoCodes: promoCodes.data.map(formatPromoCode),
    };
  } catch (error) {
    console.error("[StripeCoupon] Error updating coupon:", error);
    throw error;
  }
}

/**
 * Delete a coupon (also deletes all associated promo codes)
 */
export async function deleteCoupon(couponId: string): Promise<void> {
  const stripe = await getStripeClient();
  if (!stripe) {
    throw new Error("Stripe not configured");
  }

  try {
    await stripe.coupons.del(couponId);
  } catch (error) {
    console.error("[StripeCoupon] Error deleting coupon:", error);
    throw error;
  }
}

// =============================================================================
// Promo Code CRUD Operations
// =============================================================================

/**
 * List all promo codes (optionally filtered by coupon)
 */
export async function listPromoCodes(
  couponId?: string,
  includeInactive = false
): Promise<StripePromoCode[]> {
  const stripe = await getStripeClient();
  if (!stripe) {
    throw new Error("Stripe not configured");
  }

  try {
    const params: Stripe.PromotionCodeListParams = {
      limit: 100,
    };

    if (couponId) {
      params.coupon = couponId;
    }

    if (!includeInactive) {
      params.active = true;
    }

    const promoCodes = await stripe.promotionCodes.list(params);

    return promoCodes.data.map(formatPromoCode);
  } catch (error) {
    console.error("[StripeCoupon] Error listing promo codes:", error);
    throw error;
  }
}

/**
 * Get a single promo code by ID
 */
export async function getPromoCode(
  promoCodeId: string
): Promise<StripePromoCode> {
  const stripe = await getStripeClient();
  if (!stripe) {
    throw new Error("Stripe not configured");
  }

  try {
    const promoCode = await stripe.promotionCodes.retrieve(promoCodeId);
    return formatPromoCode(promoCode);
  } catch (error) {
    console.error("[StripeCoupon] Error getting promo code:", error);
    throw error;
  }
}

/**
 * Create a new promo code for a coupon
 */
export async function createPromoCode(
  data: CreatePromoCodeRequest
): Promise<StripePromoCode> {
  const stripe = await getStripeClient();
  if (!stripe) {
    throw new Error("Stripe not configured");
  }

  try {
    const promoCodeData: Stripe.PromotionCodeCreateParams = {
      promotion: {
        type: "coupon",
        coupon: data.couponId,
      },
      code: data.code,
      metadata: data.metadata,
    };

    if (data.maxRedemptions) {
      promoCodeData.max_redemptions = data.maxRedemptions;
    }

    if (data.expiresAt) {
      promoCodeData.expires_at = Math.floor(
        new Date(data.expiresAt).getTime() / 1000
      );
    }

    // Build restrictions object
    const restrictions: Stripe.PromotionCodeCreateParams.Restrictions = {};

    if (data.firstTimeTransaction || data.restrictions?.firstTimeTransaction) {
      restrictions.first_time_transaction = true;
    }

    if (data.minimumAmount || data.restrictions?.minimumAmount) {
      restrictions.minimum_amount = data.minimumAmount || data.restrictions?.minimumAmount;
      restrictions.minimum_amount_currency =
        data.minimumAmountCurrency ||
        data.restrictions?.minimumAmountCurrency ||
        "usd";
    }

    if (Object.keys(restrictions).length > 0) {
      promoCodeData.restrictions = restrictions;
    }

    const promoCode = await stripe.promotionCodes.create(promoCodeData);

    return formatPromoCode(promoCode);
  } catch (error) {
    console.error("[StripeCoupon] Error creating promo code:", error);
    throw error;
  }
}

/**
 * Update a promo code (can only deactivate or update metadata)
 */
export async function updatePromoCode(
  promoCodeId: string,
  data: UpdatePromoCodeRequest
): Promise<StripePromoCode> {
  const stripe = await getStripeClient();
  if (!stripe) {
    throw new Error("Stripe not configured");
  }

  try {
    const updateData: Stripe.PromotionCodeUpdateParams = {};

    if (data.active !== undefined) {
      updateData.active = data.active;
    }
    if (data.metadata !== undefined) {
      updateData.metadata = data.metadata;
    }

    const promoCode = await stripe.promotionCodes.update(promoCodeId, updateData);

    return formatPromoCode(promoCode);
  } catch (error) {
    console.error("[StripeCoupon] Error updating promo code:", error);
    throw error;
  }
}

/**
 * Deactivate a promo code
 */
export async function deactivatePromoCode(
  promoCodeId: string
): Promise<StripePromoCode> {
  return updatePromoCode(promoCodeId, { active: false });
}

// =============================================================================
// Analytics Functions
// =============================================================================

/**
 * Get coupon analytics from payment history
 */
export async function getCouponAnalytics(
  startDate?: string,
  endDate?: string
): Promise<CouponAnalytics> {
  const supabase = createServiceClient();

  // Build query
  let query = supabase
    .from("payment_history")
    .select("coupon_code, coupon_id, discount_amount_cents, created_at")
    .not("coupon_code", "is", null);

  if (startDate) {
    query = query.gte("created_at", startDate);
  }
  if (endDate) {
    query = query.lte("created_at", endDate);
  }

  const { data: payments, error } = await query;

  if (error) {
    console.error("[StripeCoupon] Error fetching analytics:", error);
    throw error;
  }

  // Calculate totals
  let totalRedemptions = 0;
  let totalDiscountGiven = 0;
  const couponStats: Record<string, CouponUsageStats> = {};
  const promoCodeStats: Record<string, PromoCodeUsageStats> = {};
  const dailyStats: Record<string, { redemptions: number; discountAmount: number }> =
    {};

  for (const payment of payments || []) {
    totalRedemptions++;
    totalDiscountGiven += payment.discount_amount_cents || 0;

    // Aggregate by coupon
    if (payment.coupon_id) {
      if (!couponStats[payment.coupon_id]) {
        couponStats[payment.coupon_id] = {
          couponId: payment.coupon_id,
          couponName: null, // Will be filled from Stripe if needed
          redemptions: 0,
          totalDiscount: 0,
        };
      }
      couponStats[payment.coupon_id].redemptions++;
      couponStats[payment.coupon_id].totalDiscount +=
        payment.discount_amount_cents || 0;
    }

    // Aggregate by promo code
    if (payment.coupon_code) {
      if (!promoCodeStats[payment.coupon_code]) {
        promoCodeStats[payment.coupon_code] = {
          code: payment.coupon_code,
          couponId: payment.coupon_id || "",
          redemptions: 0,
          totalDiscount: 0,
        };
      }
      promoCodeStats[payment.coupon_code].redemptions++;
      promoCodeStats[payment.coupon_code].totalDiscount +=
        payment.discount_amount_cents || 0;
    }

    // Aggregate by date
    const date = payment.created_at.split("T")[0];
    if (!dailyStats[date]) {
      dailyStats[date] = { redemptions: 0, discountAmount: 0 };
    }
    dailyStats[date].redemptions++;
    dailyStats[date].discountAmount += payment.discount_amount_cents || 0;
  }

  // Sort and limit top coupons/codes
  const topCoupons = Object.values(couponStats)
    .sort((a, b) => b.redemptions - a.redemptions)
    .slice(0, 10);

  const topPromoCodes = Object.values(promoCodeStats)
    .sort((a, b) => b.redemptions - a.redemptions)
    .slice(0, 10);

  // Convert daily stats to sorted array
  const redemptionsByPeriod: AnalyticsDataPoint[] = Object.entries(dailyStats)
    .map(([date, stats]) => ({
      date,
      redemptions: stats.redemptions,
      discountAmount: stats.discountAmount,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    totalRedemptions,
    totalDiscountGiven,
    topCoupons,
    topPromoCodes,
    redemptionsByPeriod,
  };
}

/**
 * Get coupons and promo codes expiring within N days
 */
export async function getExpiringItems(
  daysAhead = 30
): Promise<ExpiringItem[]> {
  const stripe = await getStripeClient();
  if (!stripe) {
    throw new Error("Stripe not configured");
  }

  const now = new Date();
  const futureDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
  const expiringItems: ExpiringItem[] = [];

  try {
    // Check coupons with redeem_by set
    const coupons = await stripe.coupons.list({ limit: 100 });
    for (const coupon of coupons.data) {
      if (coupon.redeem_by && coupon.valid) {
        const expiresAt = new Date(coupon.redeem_by * 1000);
        if (expiresAt <= futureDate && expiresAt > now) {
          const daysUntilExpiry = Math.ceil(
            (expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
          );
          expiringItems.push({
            type: "coupon",
            id: coupon.id,
            name: coupon.name || coupon.id,
            expiresAt: expiresAt.toISOString(),
            daysUntilExpiry,
          });
        }
      }
    }

    // Check promo codes with expires_at set
    const promoCodes = await stripe.promotionCodes.list({
      limit: 100,
      active: true,
    });
    for (const pc of promoCodes.data) {
      if (pc.expires_at) {
        const expiresAt = new Date(pc.expires_at * 1000);
        if (expiresAt <= futureDate && expiresAt > now) {
          const daysUntilExpiry = Math.ceil(
            (expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
          );
          expiringItems.push({
            type: "promo_code",
            id: pc.id,
            name: pc.code,
            expiresAt: expiresAt.toISOString(),
            daysUntilExpiry,
          });
        }
      }
    }

    // Sort by days until expiry
    expiringItems.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);

    return expiringItems;
  } catch (error) {
    console.error("[StripeCoupon] Error getting expiring items:", error);
    throw error;
  }
}

/**
 * Validate a promo code (check if it's active and valid)
 */
export async function validatePromoCode(
  code: string
): Promise<{ valid: boolean; promoCode?: StripePromoCode; error?: string }> {
  const stripe = await getStripeClient();
  if (!stripe) {
    return { valid: false, error: "Stripe not configured" };
  }

  try {
    const promoCodes = await stripe.promotionCodes.list({
      code,
      active: true,
      limit: 1,
    });

    if (promoCodes.data.length === 0) {
      return { valid: false, error: "Promo code not found or inactive" };
    }

    const promoCode = promoCodes.data[0];

    // Check if coupon is still valid
    const coupon =
      typeof promoCode.promotion.coupon === "string"
        ? await stripe.coupons.retrieve(promoCode.promotion.coupon)
        : promoCode.promotion.coupon;

    if (!coupon || !coupon.valid) {
      return { valid: false, error: "Coupon has expired" };
    }

    // Check max redemptions
    if (
      promoCode.max_redemptions &&
      promoCode.times_redeemed >= promoCode.max_redemptions
    ) {
      return { valid: false, error: "Promo code has reached max redemptions" };
    }

    // Check expiration
    if (promoCode.expires_at && promoCode.expires_at * 1000 < Date.now()) {
      return { valid: false, error: "Promo code has expired" };
    }

    return {
      valid: true,
      promoCode: formatPromoCode(promoCode),
    };
  } catch (error) {
    console.error("[StripeCoupon] Error validating promo code:", error);
    return { valid: false, error: "Failed to validate promo code" };
  }
}
