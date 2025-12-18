/**
 * Tier Service
 *
 * Handles CRUD operations for access tiers and tier features.
 */

import { createServiceClient } from "@/lib/supabase/server";
import type {
  AccessTierFull,
  TierFeature,
  TierWithFeatures,
  CreateTierRequest,
  UpdateTierRequest,
  CreateTierFeatureRequest,
  UpdateTierFeatureRequest,
  TierStats,
} from "@/lib/types";

// =============================================================================
// TIER CRUD OPERATIONS
// =============================================================================

/**
 * Get all tiers with features and optional inactive tiers
 */
export async function getAllTiers(
  includeInactive: boolean = false
): Promise<TierWithFeatures[]> {
  const supabase = createServiceClient();

  let query = supabase
    .from("access_tiers")
    .select(`
      *,
      tier_features(*)
    `)
    .order("sort_order", { ascending: true });

  if (!includeInactive) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[TierService] Error fetching tiers:", error);
    return [];
  }

  // Map the data to include features properly
  return (data || []).map((tier) => ({
    ...tier,
    features: (tier.tier_features || []).sort(
      (a: TierFeature, b: TierFeature) => a.sort_order - b.sort_order
    ),
  })) as TierWithFeatures[];
}

/**
 * Get a single tier by ID with all features
 */
export async function getTierById(id: string): Promise<TierWithFeatures | null> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("access_tiers")
    .select(`
      *,
      tier_features(*)
    `)
    .eq("id", id)
    .single();

  if (error || !data) {
    console.error("[TierService] Error fetching tier:", error);
    return null;
  }

  return {
    ...data,
    features: (data.tier_features || []).sort(
      (a: TierFeature, b: TierFeature) => a.sort_order - b.sort_order
    ),
  } as TierWithFeatures;
}

/**
 * Get a single tier by slug with all features
 */
export async function getTierBySlug(slug: string): Promise<TierWithFeatures | null> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("access_tiers")
    .select(`
      *,
      tier_features(*)
    `)
    .eq("slug", slug)
    .single();

  if (error || !data) {
    return null;
  }

  return {
    ...data,
    features: (data.tier_features || []).sort(
      (a: TierFeature, b: TierFeature) => a.sort_order - b.sort_order
    ),
  } as TierWithFeatures;
}

/**
 * Create a new tier
 */
export async function createTier(
  data: CreateTierRequest
): Promise<{ tier: AccessTierFull | null; error: string | null }> {
  const supabase = createServiceClient();

  // Check if slug is available
  const slugAvailable = await isSlugAvailable(data.slug);
  if (!slugAvailable) {
    return { tier: null, error: "Slug is already in use" };
  }

  const { data: tier, error } = await supabase
    .from("access_tiers")
    .insert({
      name: data.name,
      slug: data.slug,
      description: data.description,
      daily_download_limit: data.daily_download_limit,
      monthly_download_limit: data.monthly_download_limit,
      can_access_premium: data.can_access_premium,
      can_access_exclusive: data.can_access_exclusive,
      can_create_collections: data.can_create_collections,
      max_collections: data.max_collections,
      max_favorites: data.max_favorites,
      price_monthly: data.price_monthly,
      price_yearly: data.price_yearly,
      price_lifetime: data.price_lifetime,
      price_yearly_display: data.price_yearly_display,
      price_lifetime_display: data.price_lifetime_display,
      sort_order: data.sort_order,
      is_active: data.is_active,
      show_on_pricing: data.show_on_pricing,
      highlight_label: data.highlight_label,
      cta_text: data.cta_text,
    })
    .select()
    .single();

  if (error) {
    console.error("[TierService] Error creating tier:", error);
    return { tier: null, error: error.message };
  }

  return { tier: tier as AccessTierFull, error: null };
}

/**
 * Update an existing tier
 */
export async function updateTier(
  id: string,
  data: UpdateTierRequest
): Promise<{ tier: AccessTierFull | null; error: string | null }> {
  const supabase = createServiceClient();

  // If slug is being updated, check availability
  if (data.slug) {
    const slugAvailable = await isSlugAvailable(data.slug, id);
    if (!slugAvailable) {
      return { tier: null, error: "Slug is already in use" };
    }
  }

  const { data: tier, error } = await supabase
    .from("access_tiers")
    .update(data)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[TierService] Error updating tier:", error);
    return { tier: null, error: error.message };
  }

  return { tier: tier as AccessTierFull, error: null };
}

/**
 * Delete a tier (only if no users assigned)
 */
export async function deleteTier(
  id: string
): Promise<{ success: boolean; error: string | null }> {
  const supabase = createServiceClient();

  // Check if tier can be deleted
  const { canDelete, reason } = await canDeleteTier(id);
  if (!canDelete) {
    return { success: false, error: reason || "Cannot delete tier" };
  }

  const { error } = await supabase.from("access_tiers").delete().eq("id", id);

  if (error) {
    console.error("[TierService] Error deleting tier:", error);
    return { success: false, error: error.message };
  }

  return { success: true, error: null };
}

/**
 * Toggle tier active status
 */
export async function toggleTierActive(
  id: string,
  isActive: boolean
): Promise<{ success: boolean; error: string | null }> {
  const supabase = createServiceClient();

  const { error } = await supabase
    .from("access_tiers")
    .update({ is_active: isActive })
    .eq("id", id);

  if (error) {
    console.error("[TierService] Error toggling tier active:", error);
    return { success: false, error: error.message };
  }

  return { success: true, error: null };
}

/**
 * Archive a tier (soft delete for tiers that can't be fully deleted)
 */
export async function archiveTier(
  id: string
): Promise<{ success: boolean; error: string | null }> {
  const supabase = createServiceClient();

  const { error } = await supabase
    .from("access_tiers")
    .update({
      is_archived: true,
      archived_at: new Date().toISOString(),
      is_active: false, // Also deactivate when archiving
      show_on_pricing: false, // Hide from pricing page
    })
    .eq("id", id);

  if (error) {
    console.error("[TierService] Error archiving tier:", error);
    return { success: false, error: error.message };
  }

  return { success: true, error: null };
}

/**
 * Unarchive a tier
 */
export async function unarchiveTier(
  id: string
): Promise<{ success: boolean; error: string | null }> {
  const supabase = createServiceClient();

  const { error } = await supabase
    .from("access_tiers")
    .update({
      is_archived: false,
      archived_at: null,
    })
    .eq("id", id);

  if (error) {
    console.error("[TierService] Error unarchiving tier:", error);
    return { success: false, error: error.message };
  }

  return { success: true, error: null };
}

/**
 * Reorder tiers by providing an array of tier IDs in desired order
 */
export async function reorderTiers(
  orderedIds: string[]
): Promise<{ success: boolean; error: string | null }> {
  const supabase = createServiceClient();

  // Update each tier's sort_order
  const updates = orderedIds.map((id, index) =>
    supabase
      .from("access_tiers")
      .update({ sort_order: index })
      .eq("id", id)
  );

  try {
    await Promise.all(updates);
    return { success: true, error: null };
  } catch (error) {
    console.error("[TierService] Error reordering tiers:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to reorder",
    };
  }
}

// =============================================================================
// TIER FEATURE CRUD OPERATIONS
// =============================================================================

/**
 * Get all features for a tier
 */
export async function getTierFeatures(tierId: string): Promise<TierFeature[]> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("tier_features")
    .select("*")
    .eq("tier_id", tierId)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("[TierService] Error fetching tier features:", error);
    return [];
  }

  return data as TierFeature[];
}

/**
 * Create a new tier feature
 */
export async function createTierFeature(
  data: CreateTierFeatureRequest
): Promise<{ feature: TierFeature | null; error: string | null }> {
  const supabase = createServiceClient();

  // Get max sort_order for this tier if not provided
  let sortOrder = data.sort_order;
  if (sortOrder === undefined) {
    const { data: maxOrder } = await supabase
      .from("tier_features")
      .select("sort_order")
      .eq("tier_id", data.tier_id)
      .order("sort_order", { ascending: false })
      .limit(1)
      .single();

    sortOrder = (maxOrder?.sort_order ?? -1) + 1;
  }

  const { data: feature, error } = await supabase
    .from("tier_features")
    .insert({
      tier_id: data.tier_id,
      feature_text: data.feature_text,
      icon: data.icon || null,
      sort_order: sortOrder,
      is_highlighted: data.is_highlighted || false,
    })
    .select()
    .single();

  if (error) {
    console.error("[TierService] Error creating tier feature:", error);
    return { feature: null, error: error.message };
  }

  return { feature: feature as TierFeature, error: null };
}

/**
 * Update a tier feature
 */
export async function updateTierFeature(
  id: string,
  data: UpdateTierFeatureRequest
): Promise<{ feature: TierFeature | null; error: string | null }> {
  const supabase = createServiceClient();

  const { data: feature, error } = await supabase
    .from("tier_features")
    .update(data)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[TierService] Error updating tier feature:", error);
    return { feature: null, error: error.message };
  }

  return { feature: feature as TierFeature, error: null };
}

/**
 * Delete a tier feature
 */
export async function deleteTierFeature(
  id: string
): Promise<{ success: boolean; error: string | null }> {
  const supabase = createServiceClient();

  const { error } = await supabase.from("tier_features").delete().eq("id", id);

  if (error) {
    console.error("[TierService] Error deleting tier feature:", error);
    return { success: false, error: error.message };
  }

  return { success: true, error: null };
}

/**
 * Reorder tier features
 */
export async function reorderTierFeatures(
  tierId: string,
  orderedIds: string[]
): Promise<{ success: boolean; error: string | null }> {
  const supabase = createServiceClient();

  // Update each feature's sort_order
  const updates = orderedIds.map((id, index) =>
    supabase
      .from("tier_features")
      .update({ sort_order: index })
      .eq("id", id)
      .eq("tier_id", tierId)
  );

  try {
    await Promise.all(updates);
    return { success: true, error: null };
  } catch (error) {
    console.error("[TierService] Error reordering features:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to reorder",
    };
  }
}

// =============================================================================
// STATISTICS & VALIDATION
// =============================================================================

/**
 * Get tier statistics including user counts
 */
export async function getTierStats(): Promise<{
  tiers: TierStats[];
  total_users: number;
}> {
  const supabase = createServiceClient();

  // Get user counts per tier
  const { data: tierCounts, error: countError } = await supabase
    .from("users")
    .select("tier_id, access_tiers!inner(id, name)")
    .not("tier_id", "is", null);

  if (countError) {
    console.error("[TierService] Error fetching tier stats:", countError);
    return { tiers: [], total_users: 0 };
  }

  // Get total user count
  const { count: totalUsers } = await supabase
    .from("users")
    .select("*", { count: "exact", head: true });

  // Aggregate counts by tier
  const tierMap = new Map<string, TierStats>();

  for (const user of tierCounts || []) {
    const tierId = user.tier_id;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tierData = user.access_tiers as any;

    if (!tierMap.has(tierId)) {
      tierMap.set(tierId, {
        tier_id: tierId,
        tier_name: tierData?.name || "Unknown",
        user_count: 0,
        active_subscriptions: 0,
      });
    }

    const stats = tierMap.get(tierId)!;
    stats.user_count++;
  }

  // Get active subscription counts
  const { data: subscriptions } = await supabase
    .from("users")
    .select("tier_id")
    .eq("subscription_status", "active")
    .not("tier_id", "is", null);

  for (const sub of subscriptions || []) {
    const stats = tierMap.get(sub.tier_id);
    if (stats) {
      stats.active_subscriptions++;
    }
  }

  return {
    tiers: Array.from(tierMap.values()),
    total_users: totalUsers || 0,
  };
}

/**
 * Check if a slug is available (not already in use)
 */
export async function isSlugAvailable(
  slug: string,
  excludeId?: string
): Promise<boolean> {
  const supabase = createServiceClient();

  let query = supabase
    .from("access_tiers")
    .select("id")
    .eq("slug", slug);

  if (excludeId) {
    query = query.neq("id", excludeId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[TierService] Error checking slug availability:", error);
    return false;
  }

  return !data || data.length === 0;
}

/**
 * Check if a tier can be deleted
 */
export async function canDeleteTier(
  tierId: string
): Promise<{ canDelete: boolean; reason?: string }> {
  const supabase = createServiceClient();

  // Check if any users are assigned to this tier
  const { count, error } = await supabase
    .from("users")
    .select("*", { count: "exact", head: true })
    .eq("tier_id", tierId);

  if (error) {
    console.error("[TierService] Error checking tier users:", error);
    return { canDelete: false, reason: "Error checking tier usage" };
  }

  if (count && count > 0) {
    return {
      canDelete: false,
      reason: `Cannot delete tier: ${count} user(s) are currently assigned to this tier`,
    };
  }

  return { canDelete: true };
}

/**
 * Get tiers with user counts for admin display
 */
export async function getTiersWithUserCounts(): Promise<TierWithFeatures[]> {
  const tiers = await getAllTiers(true);
  const { tiers: stats } = await getTierStats();

  // Map user counts to tiers
  const statsMap = new Map(stats.map((s) => [s.tier_id, s.user_count]));

  return tiers.map((tier) => ({
    ...tier,
    user_count: statsMap.get(tier.id) || 0,
  }));
}
