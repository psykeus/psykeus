/**
 * Feature Flag Utilities
 * Helper functions to check if features are enabled throughout the codebase
 */

import { loadAIConfig } from "./ai-config";
import type { FeatureFlags } from "./ai-config";

// Cache for feature flags to avoid repeated file reads
let cachedFlags: FeatureFlags | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 300000; // 5 minutes (reduced from 30s for better performance)

/**
 * Get all feature flags (with caching)
 */
export async function getFeatureFlags(): Promise<FeatureFlags> {
  const now = Date.now();

  if (cachedFlags && now - cacheTimestamp < CACHE_TTL) {
    return cachedFlags;
  }

  const config = await loadAIConfig();
  cachedFlags = config.featureFlags;
  cacheTimestamp = now;

  return cachedFlags;
}

/**
 * Clear the feature flags cache (useful after config updates)
 */
export function clearFeatureFlagsCache(): void {
  cachedFlags = null;
  cacheTimestamp = 0;
}

/**
 * Check if a specific feature is enabled
 */
export async function isFeatureEnabled(
  feature: keyof FeatureFlags
): Promise<boolean> {
  const flags = await getFeatureFlags();
  const featureConfig = flags[feature];

  if (typeof featureConfig === "object" && "enabled" in featureConfig) {
    return featureConfig.enabled;
  }

  return false;
}

// Specific feature checks for type-safe access

/**
 * Check if favorites feature is enabled
 */
export async function isFavoritesEnabled(): Promise<boolean> {
  const flags = await getFeatureFlags();
  return flags.favorites.enabled;
}

/**
 * Get favorites configuration
 */
export async function getFavoritesConfig() {
  const flags = await getFeatureFlags();
  return flags.favorites;
}

/**
 * Check if collections feature is enabled
 */
export async function isCollectionsEnabled(): Promise<boolean> {
  const flags = await getFeatureFlags();
  return flags.collections.enabled;
}

/**
 * Get collections configuration
 */
export async function getCollectionsConfig() {
  const flags = await getFeatureFlags();
  return flags.collections;
}

/**
 * Check if related designs feature is enabled
 */
export async function isRelatedDesignsEnabled(): Promise<boolean> {
  const flags = await getFeatureFlags();
  return flags.relatedDesigns.enabled;
}

/**
 * Get related designs configuration
 */
export async function getRelatedDesignsConfig() {
  const flags = await getFeatureFlags();
  return flags.relatedDesigns;
}

/**
 * Check if scheduled publishing feature is enabled
 */
export async function isScheduledPublishingEnabled(): Promise<boolean> {
  const flags = await getFeatureFlags();
  return flags.scheduledPublishing.enabled;
}

/**
 * Check if bulk edit feature is enabled
 */
export async function isBulkEditEnabled(): Promise<boolean> {
  const flags = await getFeatureFlags();
  return flags.bulkEdit.enabled;
}

/**
 * Check if audit log feature is enabled
 */
export async function isAuditLogEnabled(): Promise<boolean> {
  const flags = await getFeatureFlags();
  return flags.auditLog.enabled;
}

/**
 * Get audit log configuration
 */
export async function getAuditLogConfig() {
  const flags = await getFeatureFlags();
  return flags.auditLog;
}

/**
 * Check if analytics charts feature is enabled
 */
export async function isAnalyticsChartsEnabled(): Promise<boolean> {
  const flags = await getFeatureFlags();
  return flags.analyticsCharts.enabled;
}

/**
 * Check if popular tags report feature is enabled
 */
export async function isPopularTagsReportEnabled(): Promise<boolean> {
  const flags = await getFeatureFlags();
  return flags.popularTagsReport.enabled;
}

/**
 * Check if export reports feature is enabled
 */
export async function isExportReportsEnabled(): Promise<boolean> {
  const flags = await getFeatureFlags();
  return flags.exportReports.enabled;
}

/**
 * Check if background jobs feature is enabled
 */
export async function isBackgroundJobsEnabled(): Promise<boolean> {
  const flags = await getFeatureFlags();
  return flags.backgroundJobs.enabled;
}

/**
 * Check if CDN integration feature is enabled
 */
export async function isCdnIntegrationEnabled(): Promise<boolean> {
  const flags = await getFeatureFlags();
  return flags.cdnIntegration.enabled;
}

/**
 * Get CDN configuration
 */
export async function getCdnConfig() {
  const flags = await getFeatureFlags();
  return flags.cdnIntegration;
}

/**
 * Check if webhooks feature is enabled
 */
export async function isWebhooksEnabled(): Promise<boolean> {
  const flags = await getFeatureFlags();
  return flags.webhooks.enabled;
}

/**
 * Check if sitemap generation feature is enabled
 */
export async function isSitemapGenerationEnabled(): Promise<boolean> {
  const flags = await getFeatureFlags();
  return flags.sitemapGeneration.enabled;
}

/**
 * Check if social cards feature is enabled
 */
export async function isSocialCardsEnabled(): Promise<boolean> {
  const flags = await getFeatureFlags();
  return flags.socialCards.enabled;
}

/**
 * Check if advanced search feature is enabled
 */
export async function isAdvancedSearchEnabled(): Promise<boolean> {
  const flags = await getFeatureFlags();
  return flags.advancedSearch.enabled;
}

/**
 * Check if tag autocomplete feature is enabled
 */
export async function isTagAutocompleteEnabled(): Promise<boolean> {
  const flags = await getFeatureFlags();
  return flags.tagAutocomplete.enabled;
}

/**
 * Check if G-code preview feature is enabled
 */
export async function isGcodePreviewEnabled(): Promise<boolean> {
  const flags = await getFeatureFlags();
  return flags.gcodePreview.enabled;
}

/**
 * Check if notifications feature is enabled
 */
export async function isNotificationsEnabled(): Promise<boolean> {
  const flags = await getFeatureFlags();
  return flags.notifications.enabled;
}

/**
 * Get notifications configuration
 */
export async function getNotificationsConfig() {
  const flags = await getFeatureFlags();
  return flags.notifications;
}

/**
 * Check if email feature is enabled
 */
export async function isEmailEnabled(): Promise<boolean> {
  const flags = await getFeatureFlags();
  return flags.email.enabled;
}

/**
 * Get email configuration
 */
export async function getEmailConfig() {
  const flags = await getFeatureFlags();
  return flags.email;
}

/**
 * Check if admin broadcasts feature is enabled
 */
export async function isAdminBroadcastsEnabled(): Promise<boolean> {
  const flags = await getFeatureFlags();
  return flags.adminBroadcasts.enabled;
}

/**
 * Get all enabled features as a list of feature names
 */
export async function getEnabledFeatures(): Promise<string[]> {
  const flags = await getFeatureFlags();
  const enabled: string[] = [];

  for (const [key, value] of Object.entries(flags)) {
    if (typeof value === "object" && "enabled" in value && value.enabled) {
      enabled.push(key);
    }
  }

  return enabled;
}

/**
 * Type guard for checking feature flags in components
 * Returns null if feature is disabled, or the config if enabled
 */
export async function getFeatureIfEnabled<K extends keyof FeatureFlags>(
  feature: K
): Promise<FeatureFlags[K] | null> {
  const flags = await getFeatureFlags();
  const config = flags[feature];

  if (typeof config === "object" && "enabled" in config && config.enabled) {
    return config;
  }

  return null;
}
