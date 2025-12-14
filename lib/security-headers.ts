/**
 * Security headers configuration for the application
 * Implements Content Security Policy and other security headers
 */

import { NextResponse } from "next/server";

/**
 * Content Security Policy directives
 * Configured for Next.js + Supabase + external image hosting
 */
function buildCSP(): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseHost = supabaseUrl ? new URL(supabaseUrl).host : "";

  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": [
      "'self'",
      "'unsafe-inline'", // Required for Next.js inline scripts
      "'unsafe-eval'", // Required for Next.js development mode - consider removing in production
    ],
    "style-src": ["'self'", "'unsafe-inline'"], // Required for Tailwind and styled-jsx
    "img-src": [
      "'self'",
      "data:",
      "blob:",
      "*.supabase.co",
      "*.supabase.in",
      "*.brandgears.com",
      supabaseHost,
    ].filter(Boolean),
    "font-src": ["'self'", "data:"],
    "connect-src": [
      "'self'",
      supabaseUrl,
      "*.supabase.co",
      "*.supabase.in",
    ].filter(Boolean),
    "frame-src": ["'self'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
    "upgrade-insecure-requests": [],
  };

  // Remove unsafe-eval in production
  if (process.env.NODE_ENV === "production") {
    directives["script-src"] = directives["script-src"].filter(
      (d) => d !== "'unsafe-eval'"
    );
  }

  return Object.entries(directives)
    .map(([key, values]) => {
      if (values.length === 0) return key;
      return `${key} ${values.join(" ")}`;
    })
    .join("; ");
}

/**
 * Security headers to add to all responses
 */
export function getSecurityHeaders(): Record<string, string> {
  return {
    // Content Security Policy
    "Content-Security-Policy": buildCSP(),

    // Prevent clickjacking
    "X-Frame-Options": "DENY",

    // Prevent MIME type sniffing
    "X-Content-Type-Options": "nosniff",

    // Enable browser XSS filter
    "X-XSS-Protection": "1; mode=block",

    // Control referrer information
    "Referrer-Policy": "strict-origin-when-cross-origin",

    // Permissions Policy (formerly Feature-Policy)
    "Permissions-Policy": [
      "camera=()",
      "microphone=()",
      "geolocation=()",
      "payment=()",
    ].join(", "),

    // Strict Transport Security (HSTS)
    // Only set in production to avoid issues with local development
    ...(process.env.NODE_ENV === "production"
      ? { "Strict-Transport-Security": "max-age=31536000; includeSubDomains" }
      : {}),
  };
}

/**
 * Apply security headers to a NextResponse
 */
export function applySecurityHeaders(response: NextResponse): NextResponse {
  const headers = getSecurityHeaders();

  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }

  return response;
}
