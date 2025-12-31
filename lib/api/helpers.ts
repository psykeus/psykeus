/**
 * API Route Helper Functions
 *
 * Consolidates common patterns used across API routes to reduce duplication.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from "@/lib/rate-limit";
import { getUser, isAdmin, isSuperAdmin } from "@/lib/auth";
import { anonymizeIp } from "@/lib/utils";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { User } from "@/lib/auth";

// =============================================================================
// Rate Limiting
// =============================================================================

export type RateLimitType = keyof typeof RATE_LIMITS;

export interface RateLimitResult {
  success: boolean;
  headers: Record<string, string>;
  response?: NextResponse;
}

/**
 * Validate rate limit and return response if exceeded
 */
export function validateRateLimit(
  request: NextRequest,
  userId: string | undefined,
  type: RateLimitType = "browse"
): RateLimitResult {
  const identifier = getClientIdentifier(request, userId);
  const rateLimit = checkRateLimit(identifier, RATE_LIMITS[type]);

  if (!rateLimit.success) {
    return {
      success: false,
      headers: rateLimit.headers,
      response: NextResponse.json(
        { error: "Too many requests. Please slow down." },
        { status: 429, headers: rateLimit.headers }
      ),
    };
  }

  return { success: true, headers: rateLimit.headers };
}

// =============================================================================
// Request Body Parsing
// =============================================================================

export type ParseJsonResult<T> =
  | { success: true; data: T; response?: undefined }
  | { success: false; data?: undefined; response: NextResponse };

/**
 * Parse JSON body from request with error handling
 */
export async function parseJsonBody<T = unknown>(
  request: NextRequest,
  headers?: Record<string, string>
): Promise<ParseJsonResult<T>> {
  try {
    const data = await request.json();
    return { success: true, data: data as T };
  } catch {
    return {
      success: false,
      response: NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400, headers }
      ),
    };
  }
}

// =============================================================================
// Parameter Validation
// =============================================================================

export type ValidateParamsResult<T> =
  | { success: true; data: T; response?: undefined }
  | { success: false; data?: undefined; response: NextResponse };

/**
 * Validate route parameters against a Zod schema
 */
export async function validateParams<T extends z.ZodSchema>(
  params: Promise<unknown>,
  schema: T,
  headers?: Record<string, string>
): Promise<ValidateParamsResult<z.infer<T>>> {
  const rawParams = await params;
  const validation = schema.safeParse(rawParams);

  if (!validation.success) {
    return {
      success: false,
      response: NextResponse.json(
        { error: validation.error.issues.map((e) => e.message).join(", ") },
        { status: 400, headers }
      ),
    };
  }

  return { success: true, data: validation.data };
}

// =============================================================================
// Pagination
// =============================================================================

export interface PaginationParams {
  page: number;
  pageSize: number;
  from: number;
  to: number;
}

/**
 * Parse pagination parameters from URL search params
 */
export function parsePaginationParams(
  searchParams: URLSearchParams,
  options?: { defaultPageSize?: number; maxPageSize?: number }
): PaginationParams {
  const defaultPageSize = options?.defaultPageSize ?? 20;
  const maxPageSize = options?.maxPageSize ?? 100;

  const parsedPage = parseInt(searchParams.get("page") ?? "1", 10);
  const parsedPageSize = parseInt(searchParams.get("pageSize") ?? String(defaultPageSize), 10);

  // Handle NaN from invalid numeric strings
  const page = Math.max(1, Number.isNaN(parsedPage) ? 1 : parsedPage);
  const pageSize = Math.min(
    Math.max(1, Number.isNaN(parsedPageSize) ? defaultPageSize : parsedPageSize),
    maxPageSize
  );

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  return { page, pageSize, from, to };
}

// =============================================================================
// Authentication Responses
// =============================================================================

/**
 * Return a 401 Unauthorized response
 */
export function unauthorizedResponse(headers?: Record<string, string>): NextResponse {
  return NextResponse.json(
    { error: "Authentication required" },
    { status: 401, headers }
  );
}

/**
 * Return a 403 Forbidden response
 */
export function forbiddenResponse(
  message: string = "Access denied",
  headers?: Record<string, string>
): NextResponse {
  return NextResponse.json({ error: message }, { status: 403, headers });
}

// =============================================================================
// Database Error Handling
// =============================================================================

/**
 * Handle database errors and return appropriate response
 */
export function handleDbError(
  error: unknown,
  operation: string,
  headers?: Record<string, string>
): NextResponse {
  console.error(`Error ${operation}:`, error);
  return NextResponse.json(
    { error: `Failed to ${operation}` },
    { status: 500, headers }
  );
}

/**
 * Return a 404 Not Found response
 */
export function notFoundResponse(
  resource: string = "Resource",
  headers?: Record<string, string>
): NextResponse {
  return NextResponse.json(
    { error: `${resource} not found` },
    { status: 404, headers }
  );
}

// =============================================================================
// Ownership Verification
// =============================================================================

export interface OwnershipResult {
  verified: boolean;
  response?: NextResponse;
}

/**
 * Verify that a user owns a resource
 */
export async function verifyOwnership(
  supabase: SupabaseClient,
  table: string,
  resourceId: string,
  userId: string,
  headers?: Record<string, string>
): Promise<OwnershipResult> {
  const { data: resource, error } = await supabase
    .from(table)
    .select("user_id")
    .eq("id", resourceId)
    .single();

  if (error || !resource) {
    return {
      verified: false,
      response: notFoundResponse("Resource", headers),
    };
  }

  if (resource.user_id !== userId) {
    return {
      verified: false,
      response: forbiddenResponse("Access denied", headers),
    };
  }

  return { verified: true };
}

// =============================================================================
// Feature Flag Check
// =============================================================================

/**
 * Return a feature disabled response
 */
export function featureDisabledResponse(
  featureName: string,
  headers?: Record<string, string>
): NextResponse {
  return NextResponse.json(
    { error: `${featureName} feature is disabled` },
    { status: 403, headers }
  );
}

// =============================================================================
// IP Address Handling
// =============================================================================

/**
 * Extract and anonymize client IP address from request.
 *
 * Handles X-Forwarded-For header for proxied requests and anonymizes
 * the IP for GDPR compliance.
 *
 * @param request - The incoming request
 * @returns Anonymized IP address or null if not available
 *
 * @example
 * const ip = getAnonymizedIp(request);
 * // "192.168.1.0" (IPv4) or "2001:db8:85a3::" (IPv6)
 */
export function getAnonymizedIp(request: NextRequest): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  const fullIp = forwarded ? forwarded.split(",")[0].trim() : null;
  return fullIp ? anonymizeIp(fullIp) : null;
}

// =============================================================================
// Admin Authentication for API Routes
// =============================================================================

export type RequireAdminResult =
  | { user: User; response?: never }
  | { user?: never; response: NextResponse };

/**
 * Require admin authentication for API routes.
 *
 * Unlike requireAdmin() from lib/auth which throws a redirect,
 * this returns a response suitable for API routes.
 *
 * @param headers - Optional headers to include in error responses
 * @returns User if authenticated as admin, or error response
 *
 * @example
 * const result = await requireAdminApi();
 * if (result.response) return result.response;
 * const user = result.user;
 */
export async function requireAdminApi(
  headers?: Record<string, string>
): Promise<RequireAdminResult> {
  const user = await getUser();

  if (!user) {
    return { response: unauthorizedResponse(headers) };
  }

  if (!isAdmin(user)) {
    return { response: forbiddenResponse("Admin access required", headers) };
  }

  return { user };
}

export type RequireSuperAdminResult = RequireAdminResult;

/**
 * Require super admin authentication for API routes.
 *
 * @param headers - Optional headers to include in error responses
 * @returns User if authenticated as super admin, or error response
 */
export async function requireSuperAdminApi(
  headers?: Record<string, string>
): Promise<RequireSuperAdminResult> {
  const user = await getUser();

  if (!user) {
    return { response: unauthorizedResponse(headers) };
  }

  if (!isSuperAdmin(user)) {
    return { response: forbiddenResponse("Super admin access required", headers) };
  }

  return { user };
}
