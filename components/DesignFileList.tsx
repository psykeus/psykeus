"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Eye, Download, FileIcon, Layers, Copy } from "lucide-react";
import { Spinner } from "@/components/ui/loading-states";
import { InlineError } from "@/components/ui/error-states";
import type { DesignFile } from "@/lib/types";
import {
  canPreview,
  canShowThumbnail,
  getPreviewType,
  getFileTypeColor,
  fetchSvgWithCorrectMime,
  thumbnailCache,
  cacheThumbnail,
  hasCachedThumbnail,
  getCachedThumbnail,
} from "@/lib/file-preview-utils";

// Dynamically import ModelViewer to avoid SSR issues
const ModelViewer = dynamic(() => import("@/components/ModelViewer"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-muted">
      <Spinner size="lg" />
    </div>
  ),
});

interface DesignFileListProps {
  designId: string;
  designSlug: string;
  files: DesignFile[];
  isAuthenticated: boolean;
}

/**
 * Lazy-loading thumbnail component for file previews
 * Shows generated previews for supported types, styled icons for others
 */
function FileThumbnail({
  fileId,
  fileType,
  designSlug,
  canPreviewThumbnail,
}: {
  fileId: string;
  fileType: string | null;
  designSlug: string;
  canPreviewThumbnail: boolean;
}) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(
    getCachedThumbnail(fileId)
  );
  const [isLoading, setIsLoading] = useState(
    canPreviewThumbnail && !hasCachedThumbnail(fileId)
  );
  const [hasError, setHasError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasStartedLoading = useRef(false);

  // Lazy load thumbnail when visible (only for previewable files)
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
  }, [fileId, canPreviewThumbnail, designSlug]);

  const loadThumbnail = async () => {
    try {
      const response = await fetch(
        `/api/designs/${designSlug}/files/${fileId}/preview`
      );
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

  const colorClass = getFileTypeColor(fileType);
  const typeLabel = fileType?.toUpperCase() || "FILE";

  // For non-previewable files or on error, show styled file type icon
  if (!canPreviewThumbnail || hasError) {
    return (
      <div
        className={`w-12 h-12 rounded flex flex-col items-center justify-center shrink-0 ${colorClass}`}
      >
        <FileIcon className="w-4 h-4" />
        <span className="text-[8px] font-bold mt-0.5 leading-none">
          {typeLabel.slice(0, 4)}
        </span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="w-12 h-12 rounded bg-muted overflow-hidden shrink-0 relative"
    >
      {isLoading && (
        <div className={`absolute inset-0 animate-pulse ${colorClass}`}>
          <div className="w-full h-full flex flex-col items-center justify-center">
            <FileIcon className="w-4 h-4 opacity-50" />
            <span className="text-[8px] font-bold mt-0.5 leading-none opacity-50">
              {typeLabel.slice(0, 4)}
            </span>
          </div>
        </div>
      )}
      {thumbnailUrl && !hasError && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumbnailUrl}
          alt=""
          className="w-full h-full object-cover"
          loading="lazy"
          onError={() => setHasError(true)}
        />
      )}
    </div>
  );
}

export function DesignFileList({
  designId,
  designSlug,
  files,
  isAuthenticated,
}: DesignFileListProps) {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [previewFile, setPreviewFile] = useState<DesignFile | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const handlePreviewFile = async (file: DesignFile) => {
    if (!canPreview(file.file_type)) return;

    setPreviewFile(file);
    setPreviewLoading(true);
    setPreviewError(null);
    setPreviewUrl(null);

    try {
      const response = await fetch(
        `/api/designs/${designSlug}/files/${file.id}/preview`
      );

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
  };

  const closePreview = () => {
    // Clean up blob URL if it was created
    if (previewUrl && previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewFile(null);
    setPreviewUrl(null);
    setPreviewError(null);
  };

  const handleDownloadFile = async (fileId: string) => {
    if (!isAuthenticated) {
      window.location.href = "/login";
      return;
    }

    setDownloadingId(fileId);
    try {
      const response = await fetch(
        `/api/download/${designId}/file/${fileId}`,
        { method: "POST" }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Download failed");
      }

      const { url } = await response.json();
      window.open(url, "_blank");
    } catch (err) {
      console.error("Download error:", err);
      alert(err instanceof Error ? err.message : "Download failed");
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDownloadZip = async () => {
    if (!isAuthenticated) {
      window.location.href = "/login";
      return;
    }

    setDownloadingZip(true);
    try {
      const response = await fetch(`/api/download/${designId}/zip`, {
        method: "POST",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Download failed");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `design-files.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("ZIP download error:", err);
      alert(err instanceof Error ? err.message : "Download failed");
    } finally {
      setDownloadingZip(false);
    }
  };

  const formatBytes = (bytes: number | null): string => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Group files by role
  const primaryFile = files.find((f) => f.file_role === "primary");
  const variants = files.filter((f) => f.file_role === "variant");
  const components = files.filter((f) => f.file_role === "component");

  // Calculate total size
  const totalSize = files.reduce((sum, f) => sum + (f.size_bytes || 0), 0);

  if (files.length === 0) {
    return null;
  }

  const previewType = previewFile ? getPreviewType(previewFile.file_type) : null;

  return (
    <>
      <Card className="mt-6">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              Project Files ({files.length})
            </CardTitle>
            {files.length > 1 && (
              <Button
                onClick={handleDownloadZip}
                disabled={downloadingZip || !isAuthenticated}
                size="sm"
              >
                {downloadingZip ? (
                  "Preparing..."
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Download All (ZIP)
                  </>
                )}
              </Button>
            )}
          </div>
          {totalSize > 0 && (
            <p className="text-sm text-muted-foreground">
              Total size: {formatBytes(totalSize)}
            </p>
          )}
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Primary File */}
          {primaryFile && (
            <FileRow
              file={primaryFile}
              designSlug={designSlug}
              isPrimary
              canPreview={canPreview(primaryFile.file_type)}
              onPreview={() => handlePreviewFile(primaryFile)}
              onDownload={() => handleDownloadFile(primaryFile.id)}
              isDownloading={downloadingId === primaryFile.id}
              isAuthenticated={isAuthenticated}
              formatBytes={formatBytes}
            />
          )}

          {/* Variants Section */}
          {variants.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Copy className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">
                  Format Variants ({variants.length})
                </span>
              </div>
              <div className="space-y-2 pl-6">
                {variants.map((file) => (
                  <FileRow
                    key={file.id}
                    file={file}
                    designSlug={designSlug}
                    isPrimary={false}
                    canPreview={canPreview(file.file_type)}
                    onPreview={() => handlePreviewFile(file)}
                    onDownload={() => handleDownloadFile(file.id)}
                    isDownloading={downloadingId === file.id}
                    isAuthenticated={isAuthenticated}
                    formatBytes={formatBytes}
                  />
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-1 pl-6">
                Same design in different file formats
              </p>
            </div>
          )}

          {/* Components Section */}
          {components.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Layers className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">
                  Project Components ({components.length})
                </span>
              </div>
              <div className="space-y-2 pl-6">
                {components.map((file) => (
                  <FileRow
                    key={file.id}
                    file={file}
                    designSlug={designSlug}
                    isPrimary={false}
                    canPreview={canPreview(file.file_type)}
                    onPreview={() => handlePreviewFile(file)}
                    onDownload={() => handleDownloadFile(file.id)}
                    isDownloading={downloadingId === file.id}
                    isAuthenticated={isAuthenticated}
                    formatBytes={formatBytes}
                  />
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-1 pl-6">
                Additional parts, layers, or pieces for this project
              </p>
            </div>
          )}

          {!isAuthenticated && (
            <p className="mt-4 text-sm text-muted-foreground text-center">
              <a href="/login" className="text-primary hover:underline">
                Sign in
              </a>{" "}
              to download files
            </p>
          )}
        </CardContent>
      </Card>

      {/* Preview Modal */}
      <Dialog open={!!previewFile} onOpenChange={(open) => !open && closePreview()}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle className="flex items-center gap-2">
              <Badge variant="outline" className="uppercase">
                {previewFile?.file_type}
              </Badge>
              {previewFile?.display_name || previewFile?.original_filename}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Preview of {previewFile?.original_filename}
            </DialogDescription>
          </DialogHeader>

          <div className="relative w-full h-[60vh] bg-muted">
            {previewLoading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Spinner size="lg" />
              </div>
            )}

            {previewError && (
              <div className="absolute inset-0 flex items-center justify-center p-4">
                <InlineError message={previewError} />
              </div>
            )}

            {previewUrl && previewType === "image" && (
              <Image
                src={previewUrl}
                alt={previewFile?.display_name || "Preview"}
                fill
                className="object-contain"
                onError={() => setPreviewError("Failed to load image")}
                unoptimized
              />
            )}

            {previewUrl && previewType === "svg" && (
              <div className="w-full h-full flex items-center justify-center p-8 bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt={previewFile?.display_name || "Preview"}
                  className="max-w-full max-h-full object-contain"
                  onError={() => setPreviewError("Failed to load SVG preview")}
                />
              </div>
            )}

            {previewUrl && previewType === "3d" && (
              <ModelViewer
                stlUrl={previewUrl}
                className="w-full h-full"
                autoRotate={true}
              />
            )}

            {previewUrl && previewType === "pdf" && (
              <iframe
                src={previewUrl}
                className="w-full h-full border-0"
                title={previewFile?.display_name || "PDF Preview"}
              />
            )}

            {previewUrl && previewType === "generated" && (
              <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-white">
                <div className="text-sm text-muted-foreground mb-4">
                  Preview of {previewFile?.file_type?.toUpperCase()} file
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt={previewFile?.display_name || "Preview"}
                  className="max-w-full max-h-[calc(100%-3rem)] object-contain"
                  onError={() => setPreviewError("Failed to load preview image")}
                />
              </div>
            )}
          </div>

          <div className="p-4 pt-2 flex justify-between items-center border-t">
            <span className="text-sm text-muted-foreground">
              {formatBytes(previewFile?.size_bytes || null)}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={closePreview}>
                Close
              </Button>
              {isAuthenticated && previewFile && (
                <Button onClick={() => handleDownloadFile(previewFile.id)}>
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

interface FileRowProps {
  file: DesignFile;
  designSlug: string;
  isPrimary: boolean;
  canPreview: boolean;
  onPreview: () => void;
  onDownload: () => void;
  isDownloading: boolean;
  isAuthenticated: boolean;
  formatBytes: (bytes: number | null) => string;
}

function FileRow({
  file,
  designSlug,
  isPrimary,
  canPreview,
  onPreview,
  onDownload,
  isDownloading,
  isAuthenticated,
  formatBytes,
}: FileRowProps) {
  return (
    <div
      className={`flex items-center justify-between p-3 border rounded-lg transition-colors ${
        canPreview ? "cursor-pointer hover:bg-accent/50" : "hover:bg-accent/30"
      }`}
      onClick={canPreview ? onPreview : undefined}
    >
      <div className="flex items-center gap-3 min-w-0">
        <FileThumbnail
          fileId={file.id}
          fileType={file.file_type}
          designSlug={designSlug}
          canPreviewThumbnail={canShowThumbnail(file.file_type)}
        />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-sm truncate">
              {file.display_name || file.original_filename || `File.${file.file_type}`}
            </p>
            <Badge variant="outline" className="uppercase text-xs shrink-0 hidden sm:inline-flex">
              {file.file_type || "?"}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {formatBytes(file.size_bytes)}
            {isPrimary && <span className="ml-2 text-primary">Main file</span>}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {canPreview && (
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onPreview();
            }}
            title="Preview"
          >
            <Eye className="w-4 h-4" />
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onDownload();
          }}
          disabled={isDownloading || !isAuthenticated}
          title="Download"
        >
          {isDownloading ? "..." : <Download className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
}
