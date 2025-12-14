"use client";

import useSWR from "swr";
import type { DesignListItem, DesignFilters, PaginatedResponse, Tag } from "@/lib/types";

// Using shared types from @/lib/types

interface DesignsResponse extends PaginatedResponse<DesignListItem> {
  total: number;
}

// Generic fetcher that returns JSON
async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("Failed to fetch data");
  }
  return res.json();
}

/**
 * Hook for fetching designs with SWR caching and deduplication
 *
 * Features:
 * - Automatic request deduplication
 * - Stale-while-revalidate caching
 * - Automatic revalidation on focus
 * - Error retry
 *
 * @param filters - Optional filters for the designs query
 * @returns SWR response with designs data, loading state, and error
 */
export function useDesigns(filters: DesignFilters = {}) {
  // Build query string from filters
  const params = new URLSearchParams();

  if (filters.q) params.set("q", filters.q);
  if (filters.tag) params.set("tag", filters.tag);
  if (filters.difficulty) params.set("difficulty", filters.difficulty);
  if (filters.category) params.set("category", filters.category);
  if (filters.style) params.set("style", filters.style);
  if (filters.page) params.set("page", filters.page.toString());
  if (filters.pageSize) params.set("pageSize", filters.pageSize.toString());

  const queryString = params.toString();
  const url = `/api/designs${queryString ? `?${queryString}` : ""}`;

  return useSWR<DesignsResponse>(url, fetcher<DesignsResponse>, {
    revalidateOnFocus: false,
    dedupingInterval: 2000, // Reduced from 5s for fresher data on pagination
    keepPreviousData: true, // Keep showing old data while fetching new
    revalidateOnReconnect: true, // Re-fetch when reconnecting to network
  });
}

interface FavoriteStatus {
  isFavorited: boolean;
  favoriteCount: number;
}

/**
 * Hook for checking favorite status with SWR
 */
export function useFavoriteStatus(designId: string, enabled = true) {
  return useSWR<FavoriteStatus>(
    enabled ? `/api/favorites/${designId}` : null,
    fetcher<FavoriteStatus>,
    {
      revalidateOnFocus: false,
      dedupingInterval: 10000,
    }
  );
}

interface DesignDetail {
  design: DesignListItem & {
    description?: string;
    tags?: Tag[];
    design_files?: unknown;
  };
  similarDesigns: DesignListItem[];
}

/**
 * Hook for fetching a single design by slug
 */
export function useDesign(slug: string) {
  return useSWR<DesignDetail>(
    slug ? `/api/designs/${slug}` : null,
    fetcher<DesignDetail>,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000, // Cache for 30 seconds
    }
  );
}
