/**
 * Unified preview sizing and aspect ratio configuration
 *
 * This module provides consistent preview dimensions across all components
 * to ensure a unified look and feel throughout the application.
 *
 * Created: 2025-12-07
 * AI Model: Claude Opus 4.5 (claude-opus-4-5-20251101)
 */

/**
 * Preview size presets for different contexts
 */
export const PREVIEW_SIZES = {
  /** Thumbnail in grid views (DesignCard, RelatedDesigns) */
  thumbnail: {
    sizes: "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw",
    quality: 85,
  },
  /** Main preview on design detail page */
  detail: {
    sizes: "(max-width: 768px) 100vw, (max-width: 1200px) 600px, 800px",
    quality: 85,
  },
  /** Small preview in admin tables */
  adminTable: {
    sizes: "48px",
    quality: 75,
  },
  /** Medium preview in duplicate comparison */
  comparison: {
    sizes: "(max-width: 768px) 50vw, 25vw",
    quality: 85,
  },
  /** Full-screen lightbox */
  lightbox: {
    sizes: "90vw",
    quality: 85,
  },
} as const;

export type PreviewSizeKey = keyof typeof PREVIEW_SIZES;

/**
 * Aspect ratio configuration for previews
 */
export const ASPECT_RATIO = {
  /** Default aspect ratio when image dimensions are unknown */
  default: 1,
  /** Minimum allowed aspect ratio (width/height) - prevents very tall images */
  min: 0.5,
  /** Maximum allowed aspect ratio (width/height) - prevents very wide images */
  max: 2.0,
} as const;

/**
 * Clamp an aspect ratio to prevent extreme values
 *
 * @param ratio - The aspect ratio (width/height) to clamp
 * @returns Clamped aspect ratio between min and max
 */
export function clampAspectRatio(ratio: number): number {
  return Math.max(ASPECT_RATIO.min, Math.min(ASPECT_RATIO.max, ratio));
}

/**
 * Calculate aspect ratio from image dimensions
 *
 * @param width - Image width in pixels
 * @param height - Image height in pixels
 * @param clamp - Whether to clamp the result (default: true)
 * @returns Aspect ratio (width/height)
 */
export function calculateAspectRatio(
  width: number,
  height: number,
  clamp: boolean = true
): number {
  if (!width || !height || height === 0) {
    return ASPECT_RATIO.default;
  }
  const ratio = width / height;
  return clamp ? clampAspectRatio(ratio) : ratio;
}

/**
 * Get CSS aspect-ratio value for a container
 *
 * @param ratio - The aspect ratio to use (or "square" for 1:1)
 * @returns CSS aspect-ratio value
 */
export function getAspectRatioStyle(ratio: number | "square"): string {
  if (ratio === "square") {
    return "1 / 1";
  }
  return `${ratio} / 1`;
}

/**
 * Tailwind classes for consistent preview containers
 */
export const PREVIEW_CONTAINER_CLASSES = {
  /** Base classes for all preview containers */
  base: "relative bg-muted overflow-hidden",
  /** Rounded corners */
  rounded: "rounded-lg",
  /** With subtle letterbox background gradient */
  letterbox:
    "bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-muted/30 via-muted/50 to-muted/30",
} as const;

/**
 * Image display modes
 */
export const IMAGE_FIT = {
  /** Contain - show full image with letterboxing */
  contain: "object-contain",
  /** Cover - fill container, may crop */
  cover: "object-cover",
} as const;

export type ImageFit = keyof typeof IMAGE_FIT;

/**
 * Get the appropriate sizes attribute for a preview context
 *
 * @param context - The preview context
 * @returns The sizes attribute value
 */
export function getPreviewSizes(context: PreviewSizeKey): string {
  return PREVIEW_SIZES[context].sizes;
}

/**
 * Get the appropriate quality setting for a preview context
 *
 * @param context - The preview context
 * @returns The quality value (1-100)
 */
export function getPreviewQuality(context: PreviewSizeKey): number {
  return PREVIEW_SIZES[context].quality;
}

/**
 * Determine if an image should use object-contain or object-cover
 * based on whether it's a design preview (contain) or decorative (cover)
 *
 * @param isDesignPreview - True if this is showing a design that shouldn't be cropped
 * @returns The appropriate object-fit class
 */
export function getImageFitClass(isDesignPreview: boolean = true): string {
  return isDesignPreview ? IMAGE_FIT.contain : IMAGE_FIT.cover;
}

/**
 * Check if a file type is a 3D model
 *
 * @param fileType - The file extension (without dot)
 * @returns True if the file is a 3D model
 */
export function is3DModelType(fileType: string | null | undefined): boolean {
  if (!fileType) return false;
  const THREE_D_TYPES = ["stl", "obj", "gltf", "glb", "3mf"];
  return THREE_D_TYPES.includes(fileType.toLowerCase());
}

/**
 * Check if a file type is an image
 *
 * @param fileType - The file extension (without dot)
 * @returns True if the file is an image
 */
export function isImageType(fileType: string | null | undefined): boolean {
  if (!fileType) return false;
  const IMAGE_TYPES = ["png", "jpg", "jpeg", "webp", "gif", "svg"];
  return IMAGE_TYPES.includes(fileType.toLowerCase());
}

/**
 * Check if a file type is a 2D vector format
 *
 * @param fileType - The file extension (without dot)
 * @returns True if the file is a 2D vector
 */
export function is2DVectorType(fileType: string | null | undefined): boolean {
  if (!fileType) return false;
  const VECTOR_TYPES = ["svg", "dxf", "dwg", "ai", "eps", "pdf", "cdr"];
  return VECTOR_TYPES.includes(fileType.toLowerCase());
}
