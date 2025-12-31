"use client";

import { memo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Eye, MoreVertical } from "lucide-react";
import type { DesignFile, FileRole } from "@/lib/types";
import { canShowThumbnail } from "@/lib/file-preview-utils";
import { FileThumbnail } from "./FileThumbnail";

interface FileItemProps {
  file: DesignFile;
  designId: string;
  isPrimary: boolean;
  isSettingPrimary: boolean;
  canPreviewFile: boolean;
  onPreview: () => void;
  onSetPrimary: (fileId: string) => void;
  onDelete: (fileId: string) => void;
  onUpdateRole: (fileId: string, role: FileRole) => void;
  formatBytes: (bytes: number | null) => string;
  getRoleBadgeVariant: (role: FileRole) => "default" | "secondary" | "outline";
  canDelete: boolean;
}

/**
 * Admin file item component with role management and actions dropdown.
 * Used in the admin design file manager.
 * Memoized to prevent unnecessary re-renders in lists.
 */
export const FileItem = memo(function FileItem({
  file,
  designId,
  isPrimary,
  isSettingPrimary,
  canPreviewFile,
  onPreview,
  onSetPrimary,
  onDelete,
  onUpdateRole,
  formatBytes,
  getRoleBadgeVariant,
  canDelete,
}: FileItemProps) {
  const fileName = file.display_name || file.original_filename || "Unnamed file";

  return (
    <div
      className={`flex items-center justify-between p-3 border rounded-lg bg-card transition-colors ${
        isSettingPrimary ? "opacity-70" : ""
      } ${canPreviewFile ? "hover:bg-accent/50" : "hover:bg-accent/30"}`}
      aria-busy={isSettingPrimary}
    >
      <div className="flex items-center gap-3 min-w-0">
        <FileThumbnail
          fileId={file.id}
          fileType={file.file_type}
          previewApiPath={`/api/admin/designs/${designId}/files`}
          size="sm"
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
            {file.file_description && ` - ${file.file_description}`}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {isSettingPrimary ? (
          <Badge variant="secondary" className="animate-pulse" aria-live="polite">
            Updating...
          </Badge>
        ) : (
          <Badge variant={getRoleBadgeVariant(file.file_role)}>
            {file.file_role}
          </Badge>
        )}

        {/* Preview button */}
        {canPreviewFile && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onPreview}
            disabled={isSettingPrimary}
            aria-label={`Preview ${fileName}`}
          >
            <Eye className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">Preview</span>
          </Button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              disabled={isSettingPrimary}
              aria-label={`Actions for ${fileName}`}
            >
              <MoreVertical className="h-4 w-4" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {canPreviewFile && (
              <DropdownMenuItem onClick={onPreview}>
                <Eye className="h-4 w-4 mr-2" aria-hidden="true" />
                Preview
              </DropdownMenuItem>
            )}
            {!isPrimary && (
              <DropdownMenuItem onClick={() => onSetPrimary(file.id)}>
                Set as Primary (regenerates preview)
              </DropdownMenuItem>
            )}
            {file.file_role !== "variant" && !isPrimary && (
              <DropdownMenuItem onClick={() => onUpdateRole(file.id, "variant")}>
                Change to Variant
              </DropdownMenuItem>
            )}
            {file.file_role !== "component" && !isPrimary && (
              <DropdownMenuItem onClick={() => onUpdateRole(file.id, "component")}>
                Change to Component
              </DropdownMenuItem>
            )}
            {canDelete && (
              <DropdownMenuItem
                onClick={() => onDelete(file.id)}
                className="text-destructive focus:text-destructive"
              >
                Delete File
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
});
