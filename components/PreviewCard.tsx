"use client";

import { forwardRef, memo } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import {
  PREVIEW_SIZES,
  PREVIEW_CONTAINER_CLASSES,
  IMAGE_FIT,
} from "@/lib/preview-config";

// =============================================================================
// Preview Image Container
// =============================================================================

interface PreviewContainerProps {
  /** Aspect ratio class (e.g., "aspect-square", "aspect-video") */
  aspect?: string;
  /** Whether to show rounded corners */
  rounded?: boolean;
  /** Whether to add hover scale effect */
  hoverScale?: boolean;
  /** Additional classes for the container */
  className?: string;
  children: React.ReactNode;
}

/**
 * Container for preview images with letterbox background
 */
export const PreviewContainer = forwardRef<HTMLDivElement, PreviewContainerProps>(
  function PreviewContainer(
    { aspect = "aspect-square", rounded = false, hoverScale = false, className, children },
    ref
  ) {
    return (
      <div
        ref={ref}
        className={cn(
          PREVIEW_CONTAINER_CLASSES.base,
          aspect,
          rounded && PREVIEW_CONTAINER_CLASSES.rounded,
          hoverScale && "group",
          className
        )}
      >
        {/* Letterbox background pattern */}
        <div className={cn("absolute inset-0", PREVIEW_CONTAINER_CLASSES.letterbox)} />
        {children}
      </div>
    );
  }
);

// =============================================================================
// Preview Image
// =============================================================================

interface PreviewImageProps {
  /** Image source URL */
  src: string | null | undefined;
  /** Alt text for the image */
  alt: string;
  /** Size preset for responsive sizing */
  sizePreset?: keyof typeof PREVIEW_SIZES;
  /** Whether to use priority loading (for above-fold images) */
  priority?: boolean;
  /** Whether to scale on hover (requires parent with group class) */
  hoverScale?: boolean;
  /** Whether to use lazy loading */
  lazy?: boolean;
  /** Additional classes */
  className?: string;
  /** Called when image fails to load */
  onError?: () => void;
}

/**
 * Image component optimized for design previews
 */
export const PreviewImage = memo(function PreviewImage({
  src,
  alt,
  sizePreset = "thumbnail",
  priority = false,
  hoverScale = false,
  lazy = true,
  className,
  onError,
}: PreviewImageProps) {
  if (!src) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        No preview
      </div>
    );
  }

  const preset = PREVIEW_SIZES[sizePreset];

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={preset.sizes}
      quality={preset.quality}
      priority={priority}
      loading={lazy && !priority ? "lazy" : undefined}
      className={cn(
        IMAGE_FIT.contain,
        "p-1",
        hoverScale && "transition-transform duration-500 group-hover:scale-105",
        className
      )}
      onError={onError}
    />
  );
});

// =============================================================================
// Preview Badge Slots
// =============================================================================

interface BadgeSlotProps {
  /** Position of the badge */
  position: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  children: React.ReactNode;
  className?: string;
}

const positionClasses = {
  "top-left": "top-2 left-2",
  "top-right": "top-2 right-2",
  "bottom-left": "bottom-2 left-2",
  "bottom-right": "bottom-2 right-2",
};

/**
 * Positioned slot for overlay badges on preview images
 */
export function BadgeSlot({ position, children, className }: BadgeSlotProps) {
  return (
    <div className={cn("absolute z-10", positionClasses[position], className)}>
      {children}
    </div>
  );
}

// =============================================================================
// Hover Overlay
// =============================================================================

interface HoverOverlayProps {
  /** Gradient direction */
  gradient?: "to-t" | "to-b" | "to-l" | "to-r";
  /** Overlay opacity on hover (0-100) */
  opacity?: number;
  className?: string;
}

/**
 * Gradient overlay that appears on hover (parent must have group class)
 */
export function HoverOverlay({ gradient = "to-t", opacity = 20, className }: HoverOverlayProps) {
  return (
    <div
      className={cn(
        "absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none",
        `bg-gradient-${gradient} from-black/${opacity} to-transparent`,
        className
      )}
    />
  );
}

// =============================================================================
// Complete Preview Card
// =============================================================================

interface PreviewCardProps {
  /** Image source URL */
  src: string | null | undefined;
  /** Alt text for the image */
  alt: string;
  /** Aspect ratio class */
  aspect?: string;
  /** Size preset */
  sizePreset?: keyof typeof PREVIEW_SIZES;
  /** Use priority loading */
  priority?: boolean;
  /** Show hover effects */
  hover?: boolean;
  /** Add rounded corners */
  rounded?: boolean;
  /** Slot for top-left badge */
  topLeftBadge?: React.ReactNode;
  /** Slot for top-right badge */
  topRightBadge?: React.ReactNode;
  /** Slot for bottom-left badge */
  bottomLeftBadge?: React.ReactNode;
  /** Slot for bottom-right badge */
  bottomRightBadge?: React.ReactNode;
  /** Additional container classes */
  className?: string;
}

/**
 * Complete preview card component with image, letterbox, badges, and hover effects
 *
 * @example
 * ```tsx
 * <PreviewCard
 *   src={design.preview_path}
 *   alt={design.title}
 *   hover
 *   topRightBadge={<FavoriteButton designId={design.id} />}
 *   topLeftBadge={
 *     design.access_level === "premium" && (
 *       <Badge>Premium</Badge>
 *     )
 *   }
 * />
 * ```
 */
export const PreviewCard = memo(function PreviewCard({
  src,
  alt,
  aspect = "aspect-square",
  sizePreset = "thumbnail",
  priority = false,
  hover = false,
  rounded = false,
  topLeftBadge,
  topRightBadge,
  bottomLeftBadge,
  bottomRightBadge,
  className,
}: PreviewCardProps) {
  return (
    <PreviewContainer
      aspect={aspect}
      rounded={rounded}
      hoverScale={hover}
      className={className}
    >
      <PreviewImage
        src={src}
        alt={alt}
        sizePreset={sizePreset}
        priority={priority}
        hoverScale={hover}
      />

      {hover && <HoverOverlay />}

      {topLeftBadge && <BadgeSlot position="top-left">{topLeftBadge}</BadgeSlot>}
      {topRightBadge && <BadgeSlot position="top-right">{topRightBadge}</BadgeSlot>}
      {bottomLeftBadge && <BadgeSlot position="bottom-left">{bottomLeftBadge}</BadgeSlot>}
      {bottomRightBadge && <BadgeSlot position="bottom-right">{bottomRightBadge}</BadgeSlot>}
    </PreviewContainer>
  );
});

// Export default for simpler imports
export default PreviewCard;
