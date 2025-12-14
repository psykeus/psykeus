/**
 * Centralized constants for the CNC Design Library
 *
 * This file contains application-wide constants that were previously
 * duplicated across multiple files. Import from here to ensure consistency.
 */

// =============================================================================
// Storage Buckets
// =============================================================================

/**
 * Supabase storage bucket names
 */
export const STORAGE_BUCKETS = {
  /** Main bucket for design files */
  DESIGNS: "designs",
  /** Bucket for generated preview images */
  PREVIEWS: "previews",
} as const;

export type StorageBucket = (typeof STORAGE_BUCKETS)[keyof typeof STORAGE_BUCKETS];

// =============================================================================
// Pagination
// =============================================================================

/**
 * Default pagination settings used across the application
 */
export const PAGINATION = {
  /** Default page number (1-indexed) */
  DEFAULT_PAGE: 1,
  /** Default number of items per page */
  DEFAULT_PAGE_SIZE: 30,
  /** Maximum allowed page size */
  MAX_PAGE_SIZE: 100,
  /** Admin default page size (larger for management views) */
  ADMIN_DEFAULT_PAGE_SIZE: 50,
  /** Admin max page size for logs */
  ADMIN_MAX_LOG_PAGE_SIZE: 200,
} as const;

// =============================================================================
// Timeouts
// =============================================================================

/**
 * Timeout values in milliseconds
 */
export const TIMEOUTS = {
  /** Preview generation timeout */
  PREVIEW_GENERATION_MS: 30000,
  /** Default API request timeout */
  API_REQUEST_MS: 30000,
  /** Signed URL expiration (1 hour) */
  SIGNED_URL_SECONDS: 3600,
} as const;

// =============================================================================
// Feature Limits
// =============================================================================

/**
 * Default limits for various features
 * Note: These may be overridden by config/ai-config.json at runtime
 */
export const FEATURE_LIMITS = {
  /** Maximum favorites per user */
  MAX_FAVORITES_PER_USER: 1000,
  /** Maximum collections per user */
  MAX_COLLECTIONS_PER_USER: 50,
  /** Maximum items per collection */
  MAX_ITEMS_PER_COLLECTION: 500,
  /** Maximum related design suggestions */
  MAX_RELATED_SUGGESTIONS: 6,
  /** Default similarity threshold for related designs (percentage) */
  SIMILARITY_THRESHOLD: 70,
} as const;

// =============================================================================
// Import Processing
// =============================================================================

/**
 * Default settings for bulk import processing
 */
export const IMPORT_DEFAULTS = {
  /** Number of concurrent workers */
  CONCURRENCY: 5,
  /** Save checkpoint every N files */
  CHECKPOINT_INTERVAL: 10,
  /** Maximum retry attempts for failed files */
  MAX_RETRIES: 3,
  /** Default confidence threshold for project detection */
  PROJECT_CONFIDENCE_THRESHOLD: 0.7,
  /** Default near-duplicate threshold (percentage) */
  NEAR_DUPLICATE_THRESHOLD: 85,
} as const;

// =============================================================================
// Preview Generation
// =============================================================================

/**
 * Preview image generation settings
 */
export const PREVIEW_SETTINGS = {
  /** Maximum dimension for preview images */
  MAX_SIZE: 1200,
  /** JPEG quality for previews */
  JPEG_QUALITY: 85,
  /** PNG compression level (0-9) */
  PNG_COMPRESSION: 6,
} as const;
