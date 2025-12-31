"use client";

import { memo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, Download } from "lucide-react";
import type { DesignFile } from "@/lib/types";
import { canShowThumbnail } from "@/lib/file-preview-utils";
import { FileThumbnail } from "./FileThumbnail";

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

/**
 * User-facing file row component with preview and download buttons.
 * Used in the public design detail page file list.
 * Memoized to prevent unnecessary re-renders in lists.
 */
export const FileRow = memo(function FileRow({
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
  const fileName = file.display_name || file.original_filename || `File.${file.file_type}`;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (canPreview && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      onPreview();
    }
  };

  return (
    <div
      className={`flex items-center justify-between p-3 border rounded-lg transition-colors ${
        canPreview ? "cursor-pointer hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" : "hover:bg-accent/30"
      }`}
      onClick={canPreview ? onPreview : undefined}
      onKeyDown={handleKeyDown}
      role={canPreview ? "button" : undefined}
      tabIndex={canPreview ? 0 : undefined}
      aria-label={canPreview ? `Preview ${fileName}` : undefined}
    >
      <div className="flex items-center gap-3 min-w-0">
        <FileThumbnail
          fileId={file.id}
          fileType={file.file_type}
          previewApiPath={`/api/designs/${designSlug}/files`}
          size="md"
          canPreviewThumbnail={canShowThumbnail(file.file_type)}
          fileName={fileName}
        />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-sm truncate">
              {fileName}
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
            aria-label={`Preview ${fileName}`}
          >
            <Eye className="w-4 h-4" aria-hidden="true" />
            <span className="sr-only">Preview</span>
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
          aria-label={`Download ${fileName}`}
          aria-busy={isDownloading}
        >
          {isDownloading ? (
            <span aria-hidden="true">...</span>
          ) : (
            <Download className="w-4 h-4" aria-hidden="true" />
          )}
          <span className="sr-only">{isDownloading ? "Downloading" : "Download"}</span>
        </Button>
      </div>
    </div>
  );
});
