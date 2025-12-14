"use client";

import { SWRConfig } from "swr";
import { ReactNode } from "react";

interface Props {
  children: ReactNode;
}

/**
 * Global SWR configuration provider
 *
 * Provides consistent caching and fetching behavior across the app:
 * - Custom fetcher with error handling
 * - Optimized revalidation settings
 * - Error retry configuration
 */
export function SWRProvider({ children }: Props) {
  return (
    <SWRConfig
      value={{
        // Default fetcher
        fetcher: async (url: string) => {
          const res = await fetch(url);
          if (!res.ok) {
            const error = new Error("An error occurred while fetching data");
            throw error;
          }
          return res.json();
        },
        // Revalidation settings
        revalidateOnFocus: false, // Don't refetch on window focus
        revalidateIfStale: true, // Refetch if data is stale
        shouldRetryOnError: true, // Retry on error
        errorRetryCount: 3, // Max 3 retries
        errorRetryInterval: 5000, // 5 second retry interval
        dedupingInterval: 5000, // Dedupe within 5 seconds
      }}
    >
      {children}
    </SWRConfig>
  );
}
