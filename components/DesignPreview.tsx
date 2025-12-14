"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
import { AlertTriangle } from "lucide-react";
import type { ModelType } from "./ModelViewer";
import {
  PREVIEW_SIZES,
  ASPECT_RATIO,
  PREVIEW_CONTAINER_CLASSES,
  IMAGE_FIT,
  is3DModelType,
  clampAspectRatio,
} from "@/lib/preview-config";
import { ImageLightbox } from "@/components/ImageLightbox";

// Dynamically import ModelViewer to avoid SSR issues with Three.js
const ModelViewer = dynamic(() => import("./ModelViewer"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-muted">
      <div className="flex flex-col items-center gap-2">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-muted-foreground">Loading 3D viewer...</span>
      </div>
    </div>
  ),
});

interface DesignPreviewProps {
  designId: string;
  previewPath: string;
  title: string;
  fileType: string | null;
  /** Design slug for fetching high-quality preview in lightbox */
  designSlug?: string;
  /** Use flexible aspect ratio based on image dimensions instead of forced square */
  flexibleAspect?: boolean;
  /** Minimum aspect ratio (width/height) to prevent extremely tall images */
  minAspectRatio?: number;
  /** Maximum aspect ratio (width/height) to prevent extremely wide images */
  maxAspectRatio?: number;
}

// Size threshold for warning (50MB)
const LARGE_FILE_THRESHOLD = 50 * 1024 * 1024;

// Format bytes to human readable string
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DesignPreview({
  designId,
  previewPath,
  title,
  fileType,
  designSlug,
  flexibleAspect = true,
  minAspectRatio = ASPECT_RATIO.min,
  maxAspectRatio = ASPECT_RATIO.max,
}: DesignPreviewProps) {
  const [viewMode, setViewMode] = useState<"image" | "3d">("image");
  const [modelUrl, setModelUrl] = useState<string | null>(null);
  const [modelType, setModelType] = useState<ModelType>("stl");
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [loadingUrl, setLoadingUrl] = useState(false);
  const [showLargeFileWarning, setShowLargeFileWarning] = useState(false);
  const [confirmedLargeFile, setConfirmedLargeFile] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<number>(1);
  const [imageLoaded, setImageLoaded] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);

  const is3DModel = is3DModelType(fileType);
  const isLargeFile = fileSize && fileSize > LARGE_FILE_THRESHOLD;

  // Calculate clamped aspect ratio for flexible mode using shared utility
  const clampedAspectRatio = clampAspectRatio(aspectRatio);
  const useFlexible = flexibleAspect && imageLoaded && !is3DModel;

  // Fetch model metadata when switching to 3D mode
  useEffect(() => {
    if (viewMode === "3d" && is3DModel && !modelUrl && !showLargeFileWarning) {
      setLoadingUrl(true);
      fetch(`/api/designs/${designId}/model`)
        .then((res) => {
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          return res.json();
        })
        .then((data) => {
          if (data.url) {
            setModelType(data.modelType || "stl");
            setFileSize(data.fileSize || null);

            // Check if file is too large and user hasn't confirmed
            if (data.fileSize && data.fileSize > LARGE_FILE_THRESHOLD && !confirmedLargeFile) {
              setShowLargeFileWarning(true);
            } else {
              setModelUrl(data.url);
            }
          } else if (data.error) {
            console.error("Model API error:", data.error);
          }
        })
        .catch((err) => {
          console.error("Failed to get model URL:", err);
        })
        .finally(() => {
          setLoadingUrl(false);
        });
    }
  }, [viewMode, is3DModel, modelUrl, designId, showLargeFileWarning, confirmedLargeFile]);

  // Handle user confirming to load large file
  const handleLoadLargeFile = () => {
    setConfirmedLargeFile(true);
    setShowLargeFileWarning(false);
    // Trigger the fetch again
    setLoadingUrl(true);
    fetch(`/api/designs/${designId}/model`)
      .then((res) => res.json())
      .then((data) => {
        if (data.url) {
          setModelUrl(data.url);
        }
      })
      .catch((err) => {
        console.error("Failed to get model URL:", err);
      })
      .finally(() => {
        setLoadingUrl(false);
      });
  };

  // Handle canceling large file load
  const handleCancelLargeFile = () => {
    setShowLargeFileWarning(false);
    setViewMode("image");
  };

  // Handle image load to get natural dimensions
  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (img.naturalWidth && img.naturalHeight) {
      setAspectRatio(img.naturalWidth / img.naturalHeight);
      setImageLoaded(true);
    }
  };

  return (
    <div
      className={`${PREVIEW_CONTAINER_CLASSES.base} ${PREVIEW_CONTAINER_CLASSES.rounded} transition-all duration-300`}
      style={{
        // Use flexible aspect ratio when available, otherwise default to square
        aspectRatio: useFlexible ? clampedAspectRatio : ASPECT_RATIO.default,
      }}
    >
      {/* View mode toggle for 3D files */}
      {is3DModel && (
        <div className="absolute top-3 right-3 z-10 flex rounded-lg overflow-hidden border bg-background shadow-sm">
          <button
            onClick={() => setViewMode("image")}
            className={`px-3 py-1.5 text-sm transition-colors ${
              viewMode === "image"
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted"
            }`}
          >
            Preview
          </button>
          <button
            onClick={() => setViewMode("3d")}
            className={`px-3 py-1.5 text-sm transition-colors ${
              viewMode === "3d"
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted"
            }`}
          >
            3D View
          </button>
        </div>
      )}

      {/* Image preview with lightbox */}
      {viewMode === "image" && (
        <div className="absolute inset-0">
          <ImageLightbox src={previewPath} alt={title} designSlug={designSlug}>
            <Image
              src={previewPath}
              alt={title}
              fill
              sizes={PREVIEW_SIZES.detail.sizes}
              className={IMAGE_FIT.contain}
              quality={PREVIEW_SIZES.detail.quality}
              priority
              unoptimized={previewPath.endsWith(".svg")}
              onLoad={handleImageLoad}
            />
          </ImageLightbox>
        </div>
      )}

      {/* 3D viewer */}
      {viewMode === "3d" && is3DModel && (
        <div className="w-full h-full">
          {loadingUrl ? (
            <div className="w-full h-full flex items-center justify-center">
              <div className="flex flex-col items-center gap-2">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-muted-foreground">Loading model...</span>
              </div>
            </div>
          ) : showLargeFileWarning ? (
            <div className="w-full h-full flex items-center justify-center bg-muted p-6">
              <div className="flex flex-col items-center gap-4 text-center max-w-sm">
                <AlertTriangle className="h-12 w-12 text-amber-500" />
                <div>
                  <h3 className="font-semibold text-lg mb-1">Large File Warning</h3>
                  <p className="text-sm text-muted-foreground">
                    This 3D model is {fileSize ? formatFileSize(fileSize) : "very large"}.
                    Loading it may slow down your browser or cause it to become unresponsive.
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleCancelLargeFile}
                    className="px-4 py-2 text-sm rounded-md border hover:bg-muted transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleLoadLargeFile}
                    className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    Load Anyway
                  </button>
                </div>
              </div>
            </div>
          ) : modelUrl ? (
            <ModelViewer
              modelUrl={modelUrl}
              modelType={modelType}
              className="w-full h-full"
              autoRotate={false}
              fileSize={fileSize}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-sm text-muted-foreground">Failed to load 3D model</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
