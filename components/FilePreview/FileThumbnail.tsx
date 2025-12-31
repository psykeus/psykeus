"use client";

import { useState, useRef, useEffect } from "react";
import { FileIcon } from "lucide-react";
import {
  canShowThumbnail,
  getFileTypeColor,
  fetchSvgWithCorrectMime,
  cacheThumbnail,
  hasCachedThumbnail,
  getCachedThumbnail,
} from "@/lib/file-preview-utils";

export type ThumbnailSize = "sm" | "md" | "lg";

interface FileThumbnailProps {
  fileId: string;
  fileType: string | null;
  /** API path to fetch preview - should be the full path without fileId suffix */
  previewApiPath: string;
  /** Size variant: sm (10x10), md (12x12), lg (16x16) */
  size?: ThumbnailSize;
  /** Override automatic canShowThumbnail check */
  canPreviewThumbnail?: boolean;
  /** Accessible label for the file (used for alt text) */
  fileName?: string;
}

const sizeConfig: Record<ThumbnailSize, {
  container: string;
  icon: string;
  text: string;
}> = {
  sm: {
    container: "w-10 h-10",
    icon: "w-3.5 h-3.5",
    text: "text-[7px]",
  },
  md: {
    container: "w-12 h-12",
    icon: "w-4 h-4",
    text: "text-[8px]",
  },
  lg: {
    container: "w-16 h-16",
    icon: "w-5 h-5",
    text: "text-[9px]",
  },
};

/**
 * Lazy-loading thumbnail component for file previews.
 * Shows generated previews for supported types, styled icons for others.
 * Uses IntersectionObserver to load thumbnails only when visible.
 */
export function FileThumbnail({
  fileId,
  fileType,
  previewApiPath,
  size = "md",
  canPreviewThumbnail: canPreviewProp,
  fileName,
}: FileThumbnailProps) {
  const canPreviewThumbnail = canPreviewProp ?? canShowThumbnail(fileType);

  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(
    getCachedThumbnail(fileId)
  );
  const [isLoading, setIsLoading] = useState(
    canPreviewThumbnail && !hasCachedThumbnail(fileId)
  );
  const [hasError, setHasError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasStartedLoading = useRef(false);

  useEffect(() => {
    if (!canPreviewThumbnail || hasStartedLoading.current || hasCachedThumbnail(fileId)) {
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
      { rootMargin: "100px" }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [fileId, canPreviewThumbnail, previewApiPath]);

  const loadThumbnail = async () => {
    try {
      const response = await fetch(`${previewApiPath}/${fileId}/preview`);
      if (!response.ok) throw new Error("Failed to fetch");

      const data = await response.json();
      let url = data.url;

      // For SVG files, create blob URL with correct MIME type
      const type = fileType?.toLowerCase() || "";
      if (type === "svg") {
        url = await fetchSvgWithCorrectMime(data.url);
      }

      cacheThumbnail(fileId, url);
      setThumbnailUrl(url);
    } catch {
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  };

  const { container, icon, text } = sizeConfig[size];
  const colorClass = getFileTypeColor(fileType);
  const typeLabel = fileType?.toUpperCase() || "FILE";

  const altText = fileName
    ? `Thumbnail for ${fileName}`
    : `${typeLabel} file thumbnail`;

  // For non-previewable files or on error, show styled file type icon
  if (!canPreviewThumbnail || hasError) {
    return (
      <div
        className={`${container} rounded flex flex-col items-center justify-center shrink-0 ${colorClass}`}
        role="img"
        aria-label={altText}
      >
        <FileIcon className={icon} aria-hidden="true" />
        <span className={`${text} font-bold mt-0.5 leading-none`} aria-hidden="true">
          {typeLabel.slice(0, 4)}
        </span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`${container} rounded bg-muted overflow-hidden shrink-0 relative`}
      role="img"
      aria-label={isLoading ? `Loading ${altText}` : altText}
    >
      {isLoading && (
        <div className={`absolute inset-0 animate-pulse ${colorClass}`} aria-hidden="true">
          <div className="w-full h-full flex flex-col items-center justify-center">
            <FileIcon className={`${icon} opacity-50`} />
            <span className={`${text} font-bold mt-0.5 leading-none opacity-50`}>
              {typeLabel.slice(0, 4)}
            </span>
          </div>
        </div>
      )}
      {thumbnailUrl && !hasError && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumbnailUrl}
          alt={altText}
          className="w-full h-full object-cover"
          loading="lazy"
          onError={() => setHasError(true)}
        />
      )}
    </div>
  );
}
