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

export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB"];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
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
