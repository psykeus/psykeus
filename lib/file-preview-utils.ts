/**
 * File Preview Utilities
 *
 * Shared constants and functions for file preview functionality
 * used by DesignFileList and AdminFileManager components.
 */

// =============================================================================
// Previewable File Type Categories
// =============================================================================

/** Image formats that can be displayed directly */
export const PREVIEWABLE_IMAGES = ["png", "jpg", "jpeg", "webp", "gif"] as const;

/** Vector formats rendered directly in browser */
export const PREVIEWABLE_VECTORS = ["svg"] as const;

/** 3D formats viewable with ModelViewer */
export const PREVIEWABLE_3D = ["stl", "obj", "gltf", "glb", "3mf"] as const;

/** PDF formats shown via iframe */
export const PREVIEWABLE_PDF = ["pdf"] as const;

/** Formats that have server-generated preview images */
export const PREVIEWABLE_WITH_GENERATED = ["dxf", "dwg", "ai", "eps"] as const;

// =============================================================================
// Preview Type Determination
// =============================================================================

export type PreviewType = "image" | "svg" | "3d" | "pdf" | "generated";

/**
 * Check if a file type can be previewed at all
 */
export function canPreview(fileType: string | null): boolean {
  if (!fileType) return false;
  const type = fileType.toLowerCase();
  return (
    PREVIEWABLE_IMAGES.includes(type as typeof PREVIEWABLE_IMAGES[number]) ||
    PREVIEWABLE_VECTORS.includes(type as typeof PREVIEWABLE_VECTORS[number]) ||
    PREVIEWABLE_3D.includes(type as typeof PREVIEWABLE_3D[number]) ||
    PREVIEWABLE_PDF.includes(type as typeof PREVIEWABLE_PDF[number]) ||
    PREVIEWABLE_WITH_GENERATED.includes(type as typeof PREVIEWABLE_WITH_GENERATED[number])
  );
}

/**
 * Check if file type can be shown as an img thumbnail.
 * PDFs and 3D models require special viewers, so no img thumbnail.
 */
export function canShowThumbnail(fileType: string | null): boolean {
  if (!fileType) return false;
  const type = fileType.toLowerCase();
  return (
    PREVIEWABLE_IMAGES.includes(type as typeof PREVIEWABLE_IMAGES[number]) ||
    PREVIEWABLE_VECTORS.includes(type as typeof PREVIEWABLE_VECTORS[number]) ||
    PREVIEWABLE_WITH_GENERATED.includes(type as typeof PREVIEWABLE_WITH_GENERATED[number])
  );
}

/**
 * Get the preview type for a file, determining how it should be rendered
 */
export function getPreviewType(fileType: string | null): PreviewType | null {
  if (!fileType) return null;
  const type = fileType.toLowerCase();

  if (PREVIEWABLE_IMAGES.includes(type as typeof PREVIEWABLE_IMAGES[number])) return "image";
  if (PREVIEWABLE_VECTORS.includes(type as typeof PREVIEWABLE_VECTORS[number])) return "svg";
  if (PREVIEWABLE_3D.includes(type as typeof PREVIEWABLE_3D[number])) return "3d";
  if (PREVIEWABLE_PDF.includes(type as typeof PREVIEWABLE_PDF[number])) return "pdf";
  if (PREVIEWABLE_WITH_GENERATED.includes(type as typeof PREVIEWABLE_WITH_GENERATED[number])) return "generated";

  return null;
}

// =============================================================================
// File Type Colors for Icons
// =============================================================================

/**
 * Tailwind color classes for file type icons/badges
 * Keys are lowercase file extensions without dot
 */
export const FILE_TYPE_COLORS: Record<string, string> = {
  // Vector formats
  svg: "text-orange-500 bg-orange-50 dark:bg-orange-950",
  dxf: "text-blue-500 bg-blue-50 dark:bg-blue-950",
  dwg: "text-blue-600 bg-blue-50 dark:bg-blue-950",
  ai: "text-orange-600 bg-orange-50 dark:bg-orange-950",
  eps: "text-purple-500 bg-purple-50 dark:bg-purple-950",
  cdr: "text-green-600 bg-green-50 dark:bg-green-950",
  // Image formats
  png: "text-green-500 bg-green-50 dark:bg-green-950",
  jpg: "text-green-600 bg-green-50 dark:bg-green-950",
  jpeg: "text-green-600 bg-green-50 dark:bg-green-950",
  webp: "text-green-500 bg-green-50 dark:bg-green-950",
  gif: "text-pink-500 bg-pink-50 dark:bg-pink-950",
  // 3D formats
  stl: "text-cyan-500 bg-cyan-50 dark:bg-cyan-950",
  obj: "text-cyan-600 bg-cyan-50 dark:bg-cyan-950",
  gltf: "text-cyan-500 bg-cyan-50 dark:bg-cyan-950",
  glb: "text-cyan-600 bg-cyan-50 dark:bg-cyan-950",
  "3mf": "text-cyan-500 bg-cyan-50 dark:bg-cyan-950",
  // Documents
  pdf: "text-red-500 bg-red-50 dark:bg-red-950",
  // CAM/CNC formats
  gcode: "text-yellow-600 bg-yellow-50 dark:bg-yellow-950",
  nc: "text-yellow-600 bg-yellow-50 dark:bg-yellow-950",
  ngc: "text-yellow-600 bg-yellow-50 dark:bg-yellow-950",
  tap: "text-yellow-500 bg-yellow-50 dark:bg-yellow-950",
  // Default
  default: "text-gray-500 bg-gray-100 dark:bg-gray-800",
};

/**
 * Get the color classes for a file type
 */
export function getFileTypeColor(fileType: string | null): string {
  if (!fileType) return FILE_TYPE_COLORS.default;
  return FILE_TYPE_COLORS[fileType.toLowerCase()] || FILE_TYPE_COLORS.default;
}

// =============================================================================
// SVG MIME Type Correction
// =============================================================================

/**
 * Fetch SVG content and create blob URL with correct MIME type.
 * Storage servers often return application/octet-stream which breaks SVG rendering.
 *
 * @param url - Original URL to the SVG file
 * @returns Blob URL with correct image/svg+xml MIME type, or original URL on failure
 */
export async function fetchSvgWithCorrectMime(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    if (!response.ok) return url;

    const blob = await response.blob();
    const correctedBlob = new Blob([blob], { type: "image/svg+xml" });
    return URL.createObjectURL(correctedBlob);
  } catch {
    return url;
  }
}

// =============================================================================
// Thumbnail Cache
// =============================================================================

/**
 * Global cache for thumbnail URLs to avoid refetching
 * Can be used across component instances
 */
export const thumbnailCache = new Map<string, string>();

/**
 * Get cached thumbnail URL or null
 */
export function getCachedThumbnail(fileId: string): string | null {
  return thumbnailCache.get(fileId) || null;
}

/**
 * Store thumbnail URL in cache
 */
export function cacheThumbnail(fileId: string, url: string): void {
  thumbnailCache.set(fileId, url);
}

/**
 * Check if thumbnail is already cached
 */
export function hasCachedThumbnail(fileId: string): boolean {
  return thumbnailCache.has(fileId);
}
