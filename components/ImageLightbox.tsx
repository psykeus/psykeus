"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Image from "next/image";
import { X, ZoomIn, ZoomOut, Move, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PREVIEW_SIZES, IMAGE_FIT } from "@/lib/preview-config";

interface Props {
  src: string;
  alt: string;
  children: React.ReactNode;
  /** Design slug to fetch high-quality original file for lightbox */
  designSlug?: string;
}

export function ImageLightbox({ src, alt, children, designSlug }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const positionStart = useRef({ x: 0, y: 0 });

  // High-quality image state
  const [highQualitySrc, setHighQualitySrc] = useState<string | null>(null);
  const [highQualityFileType, setHighQualityFileType] = useState<string | null>(null);
  const [loadingHighQuality, setLoadingHighQuality] = useState(false);
  const [highQualityError, setHighQualityError] = useState(false);
  // Track blob URLs for cleanup to prevent memory leaks
  const blobUrlRef = useRef<string | null>(null);

  const handleOpen = useCallback(() => {
    setIsOpen(true);
    setScale(1);
    setPosition({ x: 0, y: 0 });

    // Fetch high-quality image if designSlug is provided and not already loaded
    if (designSlug && !highQualitySrc && !loadingHighQuality) {
      setLoadingHighQuality(true);
      setHighQualityError(false);

      fetch(`/api/designs/${designSlug}/preview`)
        .then((res) => {
          if (!res.ok) throw new Error("Failed to fetch");
          return res.json();
        })
        .then((data) => {
          if (data.url) {
            const fileType = data.fileType?.toLowerCase() || "";
            setHighQualityFileType(fileType);

            // For SVG files, fetch and create blob URL with correct MIME type
            if (fileType === "svg") {
              fetch(data.url)
                .then((res) => res.blob())
                .then((blob) => {
                  const correctedBlob = new Blob([blob], { type: "image/svg+xml" });
                  const blobUrl = URL.createObjectURL(correctedBlob);
                  blobUrlRef.current = blobUrl; // Track for cleanup
                  setHighQualitySrc(blobUrl);
                })
                .catch(() => setHighQualitySrc(data.url));
            } else {
              setHighQualitySrc(data.url);
            }
          }
        })
        .catch((err) => {
          console.error("Failed to load high-quality preview:", err);
          setHighQualityError(true);
        })
        .finally(() => {
          setLoadingHighQuality(false);
        });
    }
  }, [designSlug, highQualitySrc, loadingHighQuality]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  const handleZoomIn = useCallback(() => {
    setScale((prev) => Math.min(prev + 0.25, 3));
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale((prev) => {
      const newScale = Math.max(prev - 0.25, 0.5);
      // Reset position when zooming out to 1x or below
      if (newScale <= 1) {
        setPosition({ x: 0, y: 0 });
      }
      return newScale;
    });
  }, []);

  const handleResetView = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  // Mouse drag handlers
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (scale <= 1) return; // Only allow panning when zoomed in
      e.preventDefault();
      setIsDragging(true);
      dragStart.current = { x: e.clientX, y: e.clientY };
      positionStart.current = { ...position };
    },
    [scale, position]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging) return;
      const deltaX = e.clientX - dragStart.current.x;
      const deltaY = e.clientY - dragStart.current.y;
      setPosition({
        x: positionStart.current.x + deltaX,
        y: positionStart.current.y + deltaY,
      });
    },
    [isDragging]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Touch drag handlers
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (scale <= 1) return;
      const touch = e.touches[0];
      setIsDragging(true);
      dragStart.current = { x: touch.clientX, y: touch.clientY };
      positionStart.current = { ...position };
    },
    [scale, position]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isDragging) return;
      const touch = e.touches[0];
      const deltaX = touch.clientX - dragStart.current.x;
      const deltaY = touch.clientY - dragStart.current.y;
      setPosition({
        x: positionStart.current.x + deltaX,
        y: positionStart.current.y + deltaY,
      });
    },
    [isDragging]
  );

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [isOpen, handleClose]);

  // Cleanup blob URL on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
      }
    };
  }, []);

  return (
    <>
      {/* Trigger - must be relative with full dimensions for fill images */}
      <div onClick={handleOpen} className="cursor-zoom-in relative w-full h-full">
        {children}
      </div>

      {/* Lightbox Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center animate-fade-in"
          onClick={handleClose}
        >
          {/* Controls */}
          <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                handleZoomOut();
              }}
              className="text-white hover:bg-white/20"
              disabled={scale <= 0.5}
            >
              <ZoomOut className="h-5 w-5" />
            </Button>
            <span className="text-white text-sm min-w-[4rem] text-center">
              {Math.round(scale * 100)}%
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                handleZoomIn();
              }}
              className="text-white hover:bg-white/20"
              disabled={scale >= 3}
            >
              <ZoomIn className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                handleResetView();
              }}
              className="text-white hover:bg-white/20"
              disabled={scale === 1 && position.x === 0 && position.y === 0}
              title="Reset view"
            >
              <Move className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              className="text-white hover:bg-white/20"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Image */}
          <div
            className={`relative max-w-[90vw] max-h-[90vh] select-none ${
              isDragging ? "" : "transition-transform duration-200"
            } ${scale > 1 ? "cursor-grab" : ""} ${isDragging ? "cursor-grabbing" : ""}`}
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {/* Loading indicator for high-quality image */}
            {loadingHighQuality && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
                <Loader2 className="h-8 w-8 text-white animate-spin" />
              </div>
            )}

            {/* Render high-quality image if available */}
            {highQualitySrc && highQualityFileType === "svg" ? (
              // SVG: use native img for proper vector rendering
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={highQualitySrc}
                alt={alt}
                className={`${IMAGE_FIT.contain} max-h-[90vh] max-w-[90vw] w-auto pointer-events-none`}
                draggable={false}
              />
            ) : highQualitySrc ? (
              // Other formats: use Next.js Image with unoptimized for signed URLs
              <Image
                src={highQualitySrc}
                alt={alt}
                width={1920}
                height={1920}
                sizes={PREVIEW_SIZES.lightbox.sizes}
                className={`${IMAGE_FIT.contain} max-h-[90vh] w-auto pointer-events-none`}
                priority
                draggable={false}
                unoptimized
              />
            ) : (
              // Fallback to thumbnail
              <Image
                src={src}
                alt={alt}
                width={1200}
                height={1200}
                sizes={PREVIEW_SIZES.lightbox.sizes}
                quality={PREVIEW_SIZES.lightbox.quality}
                className={`${IMAGE_FIT.contain} max-h-[90vh] w-auto pointer-events-none`}
                priority
                draggable={false}
              />
            )}
          </div>

          {/* Caption and pan hint */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white text-sm bg-black/50 px-4 py-2 rounded-full text-center">
            <div>{alt}</div>
            {scale > 1 && (
              <div className="text-xs text-white/70 mt-1">
                Drag to pan • Click outside to close
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
