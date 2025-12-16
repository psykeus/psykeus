/**
 * CDN Management API
 *
 * GET /api/admin/cdn - Get CDN configuration status
 * POST /api/admin/cdn/purge - Purge URLs from CDN cache
 */

import { NextRequest, NextResponse } from "next/server";
import { getUser, isAdmin } from "@/lib/auth";
import { getCdnConfig, isCdnIntegrationEnabled } from "@/lib/feature-flags";
import { purgeCdnCache, getCdnUrl } from "@/lib/cdn";
import { forbiddenResponse, handleDbError } from "@/lib/api/helpers";

export const runtime = "nodejs";

/**
 * GET /api/admin/cdn
 * Returns CDN configuration status
 */
export async function GET() {
  const user = await getUser();
  if (!user || !isAdmin(user)) {
    return forbiddenResponse("Admin access required");
  }

  const enabled = await isCdnIntegrationEnabled();
  const config = await getCdnConfig();

  // Check for required environment variables based on provider
  const envStatus: Record<string, boolean> = {};

  if (config.provider === "cloudflare") {
    envStatus.CLOUDFLARE_ZONE_ID = !!process.env.CLOUDFLARE_ZONE_ID;
    envStatus.CLOUDFLARE_API_TOKEN = !!process.env.CLOUDFLARE_API_TOKEN;
  } else if (config.provider === "cloudfront") {
    envStatus.CLOUDFRONT_DISTRIBUTION_ID = !!process.env.CLOUDFRONT_DISTRIBUTION_ID;
    envStatus.AWS_ACCESS_KEY_ID = !!process.env.AWS_ACCESS_KEY_ID;
    envStatus.AWS_SECRET_ACCESS_KEY = !!process.env.AWS_SECRET_ACCESS_KEY;
  }

  // Test URL rewriting
  const testUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/previews/test.png`;
  const rewrittenUrl = await getCdnUrl(testUrl);

  return NextResponse.json({
    enabled,
    provider: config.provider,
    cdnUrl: config.cdnUrl || null,
    configured: enabled && !!config.cdnUrl,
    envStatus,
    example: {
      original: testUrl,
      rewritten: rewrittenUrl,
      isRewritten: testUrl !== rewrittenUrl,
    },
  });
}

/**
 * POST /api/admin/cdn
 * Purge URLs from CDN cache
 *
 * Body:
 * - urls: string[] - URLs to purge
 * - designId?: string - Purge all URLs for a design
 */
export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user || !isAdmin(user)) {
    return forbiddenResponse("Admin access required");
  }

  try {
    const body = await request.json();
    const { urls, designId } = body;

    let urlsToPurge: string[] = [];

    if (urls && Array.isArray(urls)) {
      urlsToPurge = urls;
    } else if (designId) {
      // Fetch design and get all associated URLs
      const { createServiceClient } = await import("@/lib/supabase/server");
      const supabase = createServiceClient();

      const { data: design } = await supabase
        .from("designs")
        .select("preview_path")
        .eq("id", designId)
        .single();

      if (design?.preview_path) {
        urlsToPurge.push(design.preview_path);
      }

      // Also get all file preview paths
      const { data: files } = await supabase
        .from("design_files")
        .select("storage_path")
        .eq("design_id", designId);

      if (files) {
        for (const file of files) {
          // Convert storage path to URL
          const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/designs/${file.storage_path}`;
          urlsToPurge.push(url);
        }
      }
    }

    if (urlsToPurge.length === 0) {
      return NextResponse.json(
        { error: "No URLs to purge. Provide 'urls' array or 'designId'." },
        { status: 400 }
      );
    }

    const result = await purgeCdnCache(urlsToPurge);

    return NextResponse.json({
      ...result,
      urlsPurged: urlsToPurge.length,
    });
  } catch (error) {
    return handleDbError(error, "purge CDN cache");
  }
}
