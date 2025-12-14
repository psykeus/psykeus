/**
 * Dynamic Sitemap Generation
 *
 * Generates sitemap.xml for SEO. Includes:
 * - Static pages (home, designs, login)
 * - All public designs with last modified dates
 *
 * Feature flag controlled via `sitemapGeneration.enabled`
 */

import { MetadataRoute } from "next";
import { createServiceClient } from "@/lib/supabase/server";
import { isSitemapGenerationEnabled } from "@/lib/feature-flags";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const enabled = await isSitemapGenerationEnabled();

  // Return minimal sitemap if feature disabled
  if (!enabled) {
    return [
      {
        url: getBaseUrl(),
        lastModified: new Date(),
        changeFrequency: "weekly",
        priority: 1,
      },
    ];
  }

  const baseUrl = getBaseUrl();
  const sitemap: MetadataRoute.Sitemap = [];

  // Static pages
  sitemap.push(
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${baseUrl}/designs`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/login`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.3,
    }
  );

  // Fetch all public designs
  try {
    const supabase = createServiceClient();

    const { data: designs, error } = await supabase
      .from("designs")
      .select("slug, updated_at")
      .eq("is_public", true)
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("[Sitemap] Error fetching designs:", error);
      return sitemap;
    }

    // Add design pages
    for (const design of designs || []) {
      sitemap.push({
        url: `${baseUrl}/designs/${design.slug}`,
        lastModified: new Date(design.updated_at),
        changeFrequency: "weekly",
        priority: 0.7,
      });
    }

    console.log(`[Sitemap] Generated sitemap with ${sitemap.length} URLs`);
  } catch (error) {
    console.error("[Sitemap] Error generating sitemap:", error);
  }

  return sitemap;
}

/**
 * Get the base URL for sitemap generation
 */
function getBaseUrl(): string {
  // Try environment variable first
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  }

  // Try VERCEL_URL (Vercel deployments)
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  // Fallback to localhost for development
  return "http://localhost:3000";
}
