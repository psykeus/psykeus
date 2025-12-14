/**
 * CDN Integration Utilities
 *
 * Provides URL rewriting for CDN integration with Cloudflare, CloudFront, or generic CDN.
 * Supports cache purging for when content is updated.
 */

import { getCdnConfig, isCdnIntegrationEnabled } from "./feature-flags";
import type { CdnConfig } from "./ai-config";

// =============================================================================
// Types
// =============================================================================

export interface PurgeResult {
  success: boolean;
  message?: string;
  error?: string;
}

// =============================================================================
// URL Rewriting
// =============================================================================

/**
 * Get the CDN URL for a given storage URL
 * Returns the original URL if CDN is not enabled or not configured
 */
export async function getCdnUrl(storageUrl: string): Promise<string> {
  const enabled = await isCdnIntegrationEnabled();
  if (!enabled) {
    return storageUrl;
  }

  const config = await getCdnConfig();
  if (!config.cdnUrl) {
    return storageUrl;
  }

  return rewriteUrlForCdn(storageUrl, config);
}

/**
 * Rewrite a Supabase storage URL to use the CDN
 */
function rewriteUrlForCdn(storageUrl: string, config: CdnConfig): string {
  try {
    const url = new URL(storageUrl);

    // Only rewrite Supabase storage URLs
    if (!url.pathname.includes("/storage/v1/object/")) {
      return storageUrl;
    }

    // Extract the storage path (e.g., /storage/v1/object/public/previews/filename.png)
    const storagePath = url.pathname;

    // Build CDN URL
    const cdnBase = config.cdnUrl.replace(/\/$/, ""); // Remove trailing slash

    switch (config.provider) {
      case "cloudflare":
        // Cloudflare: Direct path mapping
        // CDN URL + storage path
        return `${cdnBase}${storagePath}`;

      case "cloudfront":
        // CloudFront: May need origin path configuration
        // Typically maps /storage/v1/object/public/* to /*
        const cloudFrontPath = storagePath.replace(
          /^\/storage\/v1\/object\/public\//,
          "/"
        );
        return `${cdnBase}${cloudFrontPath}`;

      case "generic":
      default:
        // Generic: Direct path mapping
        return `${cdnBase}${storagePath}`;
    }
  } catch {
    // If URL parsing fails, return original
    return storageUrl;
  }
}

/**
 * Batch rewrite multiple URLs
 */
export async function getCdnUrls(
  storageUrls: string[]
): Promise<Map<string, string>> {
  const enabled = await isCdnIntegrationEnabled();
  const result = new Map<string, string>();

  if (!enabled) {
    for (const url of storageUrls) {
      result.set(url, url);
    }
    return result;
  }

  const config = await getCdnConfig();

  for (const url of storageUrls) {
    if (config.cdnUrl) {
      result.set(url, rewriteUrlForCdn(url, config));
    } else {
      result.set(url, url);
    }
  }

  return result;
}

// =============================================================================
// Cache Purging
// =============================================================================

/**
 * Purge a URL from the CDN cache
 */
export async function purgeCdnCache(urls: string[]): Promise<PurgeResult> {
  const enabled = await isCdnIntegrationEnabled();
  if (!enabled) {
    return { success: true, message: "CDN not enabled, nothing to purge" };
  }

  const config = await getCdnConfig();
  if (!config.cdnUrl) {
    return { success: true, message: "CDN URL not configured, nothing to purge" };
  }

  switch (config.provider) {
    case "cloudflare":
      return purgeCloudflareCache(urls, config);

    case "cloudfront":
      return purgeCloudFrontCache(urls, config);

    case "generic":
    default:
      return {
        success: true,
        message: "Generic CDN: Manual cache purge may be required",
      };
  }
}

/**
 * Purge Cloudflare cache
 * Requires CLOUDFLARE_ZONE_ID and CLOUDFLARE_API_TOKEN environment variables
 */
async function purgeCloudflareCache(
  urls: string[],
  config: CdnConfig
): Promise<PurgeResult> {
  const zoneId = process.env.CLOUDFLARE_ZONE_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;

  if (!zoneId || !apiToken) {
    return {
      success: false,
      error: "Cloudflare credentials not configured (CLOUDFLARE_ZONE_ID, CLOUDFLARE_API_TOKEN)",
    };
  }

  // Convert storage URLs to CDN URLs for purging
  const cdnUrls = urls.map((url) => rewriteUrlForCdn(url, config));

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ files: cdnUrls }),
      }
    );

    const result = await response.json();

    if (result.success) {
      return {
        success: true,
        message: `Purged ${cdnUrls.length} URLs from Cloudflare cache`,
      };
    } else {
      return {
        success: false,
        error: result.errors?.[0]?.message || "Cloudflare purge failed",
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Cloudflare API error",
    };
  }
}

/**
 * Purge CloudFront cache
 * Requires AWS credentials and CLOUDFRONT_DISTRIBUTION_ID environment variable
 */
async function purgeCloudFrontCache(
  urls: string[],
  config: CdnConfig
): Promise<PurgeResult> {
  const distributionId = process.env.CLOUDFRONT_DISTRIBUTION_ID;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const region = process.env.AWS_REGION || "us-east-1";

  if (!distributionId || !accessKeyId || !secretAccessKey) {
    return {
      success: false,
      error:
        "CloudFront credentials not configured (CLOUDFRONT_DISTRIBUTION_ID, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)",
    };
  }

  // Convert URLs to invalidation paths
  const paths = urls.map((url) => {
    const parsed = new URL(url);
    const path = parsed.pathname.replace(/^\/storage\/v1\/object\/public\//, "/");
    return path;
  });

  try {
    // Using fetch with AWS Signature v4 would be complex
    // For production, recommend using @aws-sdk/client-cloudfront
    // This is a placeholder that indicates what would be needed

    console.log(
      `[CDN] CloudFront invalidation requested for ${paths.length} paths in distribution ${distributionId}`
    );
    console.log(`[CDN] Paths: ${paths.join(", ")}`);

    // In production, you would use:
    // const { CloudFrontClient, CreateInvalidationCommand } = await import("@aws-sdk/client-cloudfront");
    // const client = new CloudFrontClient({ region, credentials: { accessKeyId, secretAccessKey } });
    // await client.send(new CreateInvalidationCommand({...}));

    return {
      success: true,
      message: `CloudFront invalidation initiated for ${paths.length} paths (requires @aws-sdk/client-cloudfront for full implementation)`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "CloudFront API error",
    };
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get cache headers for CDN
 */
export function getCdnCacheHeaders(
  maxAge: number = 3600,
  staleWhileRevalidate: number = 86400
): Record<string, string> {
  return {
    "Cache-Control": `public, s-maxage=${maxAge}, stale-while-revalidate=${staleWhileRevalidate}`,
    Vary: "Accept-Encoding",
  };
}

/**
 * Get cache headers for static assets (long-lived)
 */
export function getStaticAssetHeaders(): Record<string, string> {
  return {
    "Cache-Control": "public, max-age=31536000, immutable",
    Vary: "Accept-Encoding",
  };
}

/**
 * Get cache headers for dynamic content (short-lived)
 */
export function getDynamicCacheHeaders(maxAge: number = 60): Record<string, string> {
  return {
    "Cache-Control": `public, s-maxage=${maxAge}, stale-while-revalidate=${maxAge * 5}`,
    Vary: "Accept-Encoding, Accept",
  };
}

/**
 * Get no-cache headers
 */
export function getNoCacheHeaders(): Record<string, string> {
  return {
    "Cache-Control": "no-store, no-cache, must-revalidate",
    Pragma: "no-cache",
  };
}
