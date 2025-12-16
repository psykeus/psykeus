"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  canPreview,
  getPreviewType,
  fetchSvgWithCorrectMime,
  getCachedThumbnail,
  cacheThumbnail,
  hasCachedThumbnail,
  type PreviewType,
} from "@/lib/file-preview-utils";

// =============================================================================
// File Preview Modal Hook
// =============================================================================

export interface PreviewableFile {
  id: string;
  file_type: string | null;
  display_name?: string | null;
  original_filename?: string | null;
  size_bytes?: number | null;
}

export interface UseFilePreviewOptions {
  /** Base URL for fetching preview (e.g., /api/designs/{slug}/files) */
  previewBaseUrl: string;
}

export interface UseFilePreviewReturn {
  /** Currently previewing file, null if modal closed */
  previewFile: PreviewableFile | null;
  /** Preview URL (may be blob URL for SVGs) */
  previewUrl: string | null;
  /** Whether preview is loading */
  previewLoading: boolean;
  /** Error message if preview failed */
  previewError: string | null;
  /** Preview type for rendering */
  previewType: PreviewType | null;
  /** Open preview for a file */
  openPreview: (file: PreviewableFile) => Promise<void>;
  /** Close the preview modal */
  closePreview: () => void;
}

/**
 * Hook for managing file preview modal state
 *
 * Handles fetching preview URLs, SVG MIME type correction,
 * and blob URL cleanup.
 *
 * @example
 * ```tsx
 * const {
 *   previewFile,
 *   previewUrl,
 *   previewLoading,
 *   previewError,
 *   previewType,
 *   openPreview,
 *   closePreview,
 * } = useFilePreview({
 *   previewBaseUrl: `/api/designs/${designSlug}/files`,
 * });
 *
 * // In JSX
 * <Dialog open={!!previewFile} onOpenChange={(open) => !open && closePreview()}>
 *   {previewType === "3d" && previewUrl && (
 *     <ModelViewer stlUrl={previewUrl} />
 *   )}
 * </Dialog>
 * ```
 */
export function useFilePreview(options: UseFilePreviewOptions): UseFilePreviewReturn {
  const { previewBaseUrl } = options;

  const [previewFile, setPreviewFile] = useState<PreviewableFile | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const openPreview = useCallback(async (file: PreviewableFile) => {
    if (!canPreview(file.file_type)) return;

    setPreviewFile(file);
    setPreviewLoading(true);
    setPreviewError(null);
    setPreviewUrl(null);

    try {
      const response = await fetch(`${previewBaseUrl}/${file.id}/preview`);

      if (!response.ok) {
        throw new Error("Failed to load preview");
      }

      const data = await response.json();
      const fileType = file.file_type?.toLowerCase() || "";

      // For SVG files, fetch with correct MIME type
      if (fileType === "svg") {
        const correctedUrl = await fetchSvgWithCorrectMime(data.url);
        setPreviewUrl(correctedUrl);
      } else {
        setPreviewUrl(data.url);
      }
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setPreviewLoading(false);
    }
  }, [previewBaseUrl]);

  const closePreview = useCallback(() => {
    // Clean up blob URL if it was created (SVG MIME correction)
    if (previewUrl && previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewFile(null);
    setPreviewUrl(null);
    setPreviewError(null);
  }, [previewUrl]);

  const previewType = previewFile ? getPreviewType(previewFile.file_type) : null;

  return {
    previewFile,
    previewUrl,
    previewLoading,
    previewError,
    previewType,
    openPreview,
    closePreview,
  };
}

// =============================================================================
// Lazy Thumbnail Hook
// =============================================================================

export interface UseLazyThumbnailOptions {
  fileId: string;
  fileType: string | null;
  /** Function to fetch thumbnail URL, receives fileId */
  fetchThumbnail: (fileId: string) => Promise<string>;
  /** Whether this file type can have a thumbnail */
  canShowThumbnail: boolean;
}

export interface UseLazyThumbnailReturn {
  /** Reference to attach to container element */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** Thumbnail URL, null if not loaded */
  thumbnailUrl: string | null;
  /** Whether thumbnail is currently loading */
  isLoading: boolean;
  /** Whether thumbnail loading failed */
  hasError: boolean;
}

/**
 * Hook for lazy-loading thumbnails with IntersectionObserver
 *
 * Loads thumbnails when they become visible in viewport,
 * with caching to avoid refetching.
 *
 * @example
 * ```tsx
 * const { containerRef, thumbnailUrl, isLoading, hasError } = useLazyThumbnail({
 *   fileId: file.id,
 *   fileType: file.file_type,
 *   canShowThumbnail: canShowThumbnail(file.file_type),
 *   fetchThumbnail: async (id) => {
 *     const res = await fetch(`/api/designs/${slug}/files/${id}/preview`);
 *     const data = await res.json();
 *     return data.url;
 *   },
 * });
 *
 * return (
 *   <div ref={containerRef}>
 *     {thumbnailUrl && <img src={thumbnailUrl} />}
 *   </div>
 * );
 * ```
 */
export function useLazyThumbnail(options: UseLazyThumbnailOptions): UseLazyThumbnailReturn {
  const { fileId, fileType, fetchThumbnail, canShowThumbnail } = options;

  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(
    getCachedThumbnail(fileId)
  );
  const [isLoading, setIsLoading] = useState(
    canShowThumbnail && !hasCachedThumbnail(fileId)
  );
  const [hasError, setHasError] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hasStartedLoading = useRef(false);

  useEffect(() => {
    if (!canShowThumbnail || hasStartedLoading.current || hasCachedThumbnail(fileId)) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !hasStartedLoading.current) {
          hasStartedLoading.current = true;
          loadThumbnail();
          observer.disconnect();
        }
      },
      { rootMargin: "100px" } // Start loading 100px before visible
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [fileId, canShowThumbnail]);

  const loadThumbnail = async () => {
    try {
      let url = await fetchThumbnail(fileId);

      // For SVG files, create blob URL with correct MIME type
      const type = fileType?.toLowerCase() || "";
      if (type === "svg") {
        url = await fetchSvgWithCorrectMime(url);
      }

      cacheThumbnail(fileId, url);
      setThumbnailUrl(url);
    } catch {
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  };

  return { containerRef, thumbnailUrl, isLoading, hasError };
}
