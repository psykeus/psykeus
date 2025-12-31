/**
 * Standardized API error messages.
 *
 * Use these constants for consistent error responses across all API routes.
 *
 * @example
 * return NextResponse.json({ error: API_ERRORS.AUTH_REQUIRED }, { status: 401 });
 */
export const API_ERRORS = {
  AUTH_REQUIRED: "Authentication required",
  ADMIN_REQUIRED: "Admin access required",
  SUPER_ADMIN_REQUIRED: "Super admin access required",
  NOT_FOUND: "Resource not found",
  RATE_LIMIT: "Too many requests. Please slow down.",
  INVALID_PARAMS: "Invalid parameters",
  INVALID_REQUEST: "Invalid request",
  FORBIDDEN: "Access denied",
  METHOD_NOT_ALLOWED: "Method not allowed",
  INTERNAL_ERROR: "An unexpected error occurred",
  FEATURE_DISABLED: "This feature is currently disabled",
  FILE_TOO_LARGE: "File size exceeds the maximum allowed",
  INVALID_FILE_TYPE: "File type not supported",
  DUPLICATE_ENTRY: "This entry already exists",
  VALIDATION_FAILED: "Validation failed",
} as const;

export type ApiErrorKey = keyof typeof API_ERRORS;
export type ApiErrorMessage = (typeof API_ERRORS)[ApiErrorKey];
