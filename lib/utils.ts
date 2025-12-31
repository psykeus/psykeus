import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Convert text to URL-friendly slug.
 * Preserves underscores converted to hyphens, no length limit.
 * Use for: design titles, general slugification.
 * @see generateSlug in file-types.ts for stricter alphanumeric-only slugs
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Format bytes to human-readable string.
 *
 * @param bytes - The number of bytes to format
 * @param options - Formatting options
 * @param options.decimals - Number of decimal places (default: 1)
 * @param options.nullValue - Value to return for null/undefined/0 (default: "0 B")
 * @returns Formatted string like "1.5 MB"
 *
 * @example
 * formatBytes(1536) // "1.5 KB"
 * formatBytes(null, { nullValue: "Unknown" }) // "Unknown"
 * formatBytes(0) // "0 B"
 */
export function formatBytes(
  bytes: number | null | undefined,
  options?: { decimals?: number; nullValue?: string }
): string {
  const { decimals = 1, nullValue = "0 B" } = options ?? {};

  if (bytes === null || bytes === undefined || bytes === 0) {
    return nullValue;
  }

  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(decimals)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(decimals)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(decimals)} GB`;
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}

export function formatDateTime(date: string | Date): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

/**
 * Format duration in milliseconds to human-readable string.
 *
 * @param ms - Duration in milliseconds
 * @param nullValue - Value to return for null/undefined (default: "-")
 * @returns Formatted string like "1.5s" or "2.3m"
 *
 * @example
 * formatDuration(1500) // "1.5s"
 * formatDuration(90000) // "1.5m"
 * formatDuration(500) // "500ms"
 */
export function formatDuration(ms: number | null | undefined, nullValue = "-"): string {
  if (ms === null || ms === undefined) return nullValue;
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

/**
 * Format price from cents to display string.
 *
 * @param cents - Amount in cents (e.g., 1999 for $19.99)
 * @param currency - Currency code (default: "usd")
 * @returns Formatted price string like "$19.99"
 *
 * @example
 * formatPrice(1999) // "$19.99"
 * formatPrice(1999, "eur") // "€19.99"
 */
export function formatPrice(cents: number | null | undefined, currency = "usd"): string {
  if (cents === null || cents === undefined) return "-";

  const amount = cents / 100;
  const currencySymbol = currency.toLowerCase() === "eur" ? "€" : "$";

  return `${currencySymbol}${amount.toFixed(2)}`;
}

// Re-export from file-types for backwards compatibility
export { getFileExtension } from "./file-types";

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Anonymize IP address for GDPR compliance
 * IPv4: keeps first 3 octets (192.168.1.x -> 192.168.1.0)
 * IPv6: keeps first 48 bits
 */
export function anonymizeIp(ip: string): string {
  if (ip.includes(":")) {
    // IPv6 - truncate to /48
    const parts = ip.split(":");
    return parts.slice(0, 3).join(":") + "::";
  } else {
    // IPv4 - zero out last octet
    const parts = ip.split(".");
    parts[3] = "0";
    return parts.join(".");
  }
}

/**
 * Get current timestamp as ISO string
 * Consolidates `new Date().toISOString()` pattern
 */
export const now = (): string => new Date().toISOString();

/**
 * Calculate pagination range for Supabase queries
 * @param page - 1-indexed page number
 * @param pageSize - Number of items per page
 * @returns Object with `from` and `to` for Supabase .range()
 */
export function getPaginationRange(page: number, pageSize: number): { from: number; to: number } {
  const from = (page - 1) * pageSize;
  return { from, to: from + pageSize - 1 };
}

/**
 * Handle Supabase database errors consistently
 * @param error - The error from Supabase
 * @param operation - Description of the operation (e.g., "fetch users")
 * @param options - Options for error handling behavior
 * @returns null if not throwing, never returns if throwing
 */
export function handleSupabaseError<T = null>(
  error: unknown,
  operation: string,
  options?: { throw?: boolean; returnValue?: T; silent?: boolean }
): T {
  const message = `Failed to ${operation}: ${(error as Error)?.message || 'Unknown error'}`;

  if (options?.throw) {
    throw new Error(message);
  }

  if (!options?.silent) {
    console.error(`[Supabase] ${message}`);
  }

  return (options?.returnValue ?? null) as T;
}
