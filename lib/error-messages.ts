/**
 * Centralized error messages for the CNC Design Library
 *
 * This file contains standardized error messages that were previously
 * duplicated across multiple API routes. Import from here to ensure
 * consistent user-facing error messages.
 */

// =============================================================================
// Authentication & Authorization
// =============================================================================

export const AUTH_ERRORS = {
  /** User must be logged in */
  AUTHENTICATION_REQUIRED: "Authentication required",
  /** User must have admin role */
  ADMIN_REQUIRED: "Admin access required",
  /** User must have super_admin role */
  SUPER_ADMIN_REQUIRED: "Super admin access required",
  /** Generic unauthorized */
  UNAUTHORIZED: "Unauthorized",
  /** Invalid credentials */
  INVALID_CREDENTIALS: "Invalid email or password",
  /** Session expired */
  SESSION_EXPIRED: "Session expired. Please log in again.",
} as const;

// =============================================================================
// Rate Limiting
// =============================================================================

export const RATE_LIMIT_ERRORS = {
  /** Generic rate limit message */
  TOO_MANY_REQUESTS: "Too many requests. Please slow down.",
  /** With retry info */
  RETRY_AFTER: (seconds: number) =>
    `Too many requests. Please try again in ${seconds} seconds.`,
} as const;

// =============================================================================
// Resource Not Found
// =============================================================================

export const NOT_FOUND_ERRORS = {
  /** Design not found */
  DESIGN: "Design not found",
  /** File not found */
  FILE: "File not found",
  /** Collection not found or no access */
  COLLECTION: "Collection not found or access denied",
  /** Tag not found */
  TAG: "Tag not found",
  /** User not found */
  USER: "User not found",
  /** Import job not found */
  IMPORT_JOB: "Import job not found",
  /** Generic resource not found */
  RESOURCE: "Resource not found",
} as const;

// =============================================================================
// Feature Flags
// =============================================================================

/**
 * Generate a feature disabled message
 * @param feature - The feature name (e.g., "Favorites", "Collections")
 */
export const featureDisabledError = (feature: string): string =>
  `${feature} feature is disabled`;

export const FEATURE_ERRORS = {
  /** Favorites feature disabled */
  FAVORITES_DISABLED: "Favorites feature is disabled",
  /** Collections feature disabled */
  COLLECTIONS_DISABLED: "Collections feature is disabled",
  /** Related designs feature disabled */
  RELATED_DISABLED: "Related designs feature is disabled",
  /** Analytics feature disabled */
  ANALYTICS_DISABLED: "Analytics feature is disabled",
} as const;

// =============================================================================
// Validation Errors
// =============================================================================

export const VALIDATION_ERRORS = {
  /** Invalid request body */
  INVALID_BODY: "Invalid request body",
  /** Missing required field */
  MISSING_FIELD: (field: string) => `Missing required field: ${field}`,
  /** Invalid field value */
  INVALID_FIELD: (field: string) => `Invalid value for field: ${field}`,
  /** Invalid UUID format */
  INVALID_UUID: "Invalid UUID format",
  /** Invalid file type */
  INVALID_FILE_TYPE: (ext: string) => `Unsupported file type: ${ext}`,
  /** File too large */
  FILE_TOO_LARGE: (maxSize: string) => `File exceeds maximum size of ${maxSize}`,
  /** Invalid page number */
  INVALID_PAGE: "Invalid page number",
  /** Invalid page size */
  INVALID_PAGE_SIZE: "Invalid page size",
} as const;

// =============================================================================
// Operation Errors
// =============================================================================

export const OPERATION_ERRORS = {
  /** Generic operation failed */
  OPERATION_FAILED: "Operation failed",
  /** Database error */
  DATABASE_ERROR: "Database operation failed",
  /** Storage error */
  STORAGE_ERROR: "Storage operation failed",
  /** Upload failed */
  UPLOAD_FAILED: "Failed to upload file",
  /** Download failed */
  DOWNLOAD_FAILED: "Failed to download file",
  /** Preview generation failed */
  PREVIEW_FAILED: "Failed to generate preview",
  /** AI metadata generation failed */
  AI_METADATA_FAILED: "Failed to generate AI metadata",
  /** Import failed */
  IMPORT_FAILED: "Import operation failed",
  /** Delete failed */
  DELETE_FAILED: "Failed to delete resource",
  /** Update failed */
  UPDATE_FAILED: "Failed to update resource",
} as const;

// =============================================================================
// Collection-Specific Errors
// =============================================================================

export const COLLECTION_ERRORS = {
  /** Collection limit reached */
  LIMIT_REACHED: "You have reached the maximum number of collections",
  /** Item limit reached */
  ITEM_LIMIT_REACHED: "This collection has reached its maximum capacity",
  /** Design already in collection */
  ALREADY_IN_COLLECTION: "Design is already in this collection",
  /** Design not in collection */
  NOT_IN_COLLECTION: "Design is not in this collection",
  /** Cannot delete non-empty collection */
  NOT_EMPTY: "Cannot delete a collection that contains items",
} as const;

// =============================================================================
// Favorite-Specific Errors
// =============================================================================

export const FAVORITE_ERRORS = {
  /** Favorite limit reached */
  LIMIT_REACHED: "You have reached the maximum number of favorites",
  /** Already favorited */
  ALREADY_FAVORITED: "Design is already in your favorites",
  /** Not favorited */
  NOT_FAVORITED: "Design is not in your favorites",
} as const;

// =============================================================================
// Import-Specific Errors
// =============================================================================

export const IMPORT_ERRORS = {
  /** Job already running */
  JOB_ALREADY_RUNNING: "Import job is already running",
  /** Job not in correct state */
  INVALID_JOB_STATE: (expected: string, actual: string) =>
    `Job must be in '${expected}' state, but is currently '${actual}'`,
  /** Scan failed */
  SCAN_FAILED: "Failed to scan directory for files",
  /** No files found */
  NO_FILES_FOUND: "No supported files found in the specified path",
  /** Path not accessible */
  PATH_NOT_ACCESSIBLE: "The specified path is not accessible",
} as const;
