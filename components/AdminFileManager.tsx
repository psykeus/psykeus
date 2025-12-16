"use client";

import { useState, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Eye, MoreVertical, FileIcon } from "lucide-react";
import type { DesignFile, FileRole } from "@/lib/types";
import {
  canPreview,
  canShowThumbnail,
  getPreviewType,
  getFileTypeColor,
  fetchSvgWithCorrectMime,
  cacheThumbnail,
  hasCachedThumbnail,
  getCachedThumbnail,
} from "@/lib/file-preview-utils";

// Dynamically import ModelViewer to avoid SSR issues
const ModelViewer = dynamic(() => import("@/components/ModelViewer"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-muted">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  ),
});

/**
 * Lazy-loading thumbnail component for file previews in admin
 */
function FileThumbnail({
  fileId,
  fileType,
  designId,
  canPreviewThumbnail,
}: {
  fileId: string;
  fileType: string | null;
  designId: string;
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
  }, [fileId, canPreviewThumbnail, designId]);

  const loadThumbnail = async () => {
    try {
      const response = await fetch(
        `/api/admin/designs/${designId}/files/${fileId}/preview`
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
        className={`w-10 h-10 rounded flex flex-col items-center justify-center shrink-0 ${colorClass}`}
      >
        <FileIcon className="w-3.5 h-3.5" />
        <span className="text-[7px] font-bold mt-0.5 leading-none">
          {typeLabel.slice(0, 4)}
        </span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="w-10 h-10 rounded bg-muted overflow-hidden shrink-0 relative"
    >
      {isLoading && (
        <div className={`absolute inset-0 animate-pulse ${colorClass}`}>
          <div className="w-full h-full flex flex-col items-center justify-center">
            <FileIcon className="w-3.5 h-3.5 opacity-50" />
            <span className="text-[7px] font-bold mt-0.5 leading-none opacity-50">
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

interface AdminFileManagerProps {
  designId: string;
  files: DesignFile[];
  primaryFileId: string | null;
  onFilesChange: () => void;
  onPreviewChange?: (newPreviewPath: string) => void;
}

export function AdminFileManager({
  designId,
  files,
  primaryFileId,
  onFilesChange,
  onPreviewChange,
}: AdminFileManagerProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<FileRole>("component");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Preview state
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
        `/api/admin/designs/${designId}/files/${file.id}/preview`
      );

      if (!response.ok) {
        throw new Error("Failed to load preview");
      }

      const data = await response.json();
      setPreviewUrl(data.url);
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setPreviewLoading(false);
    }
  };

  const closePreview = () => {
    setPreviewFile(null);
    setPreviewUrl(null);
    setPreviewError(null);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      for (const file of selectedFiles) {
        formData.append("files", file);
      }
      formData.append("fileRole", selectedRole);

      const response = await fetch(`/api/admin/designs/${designId}/files`, {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        setUploadError(result.error || "Upload failed");
        return;
      }

      onFilesChange();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const [settingPrimary, setSettingPrimary] = useState<string | null>(null);

  const handleSetPrimary = async (fileId: string) => {
    setSettingPrimary(fileId);
    try {
      const response = await fetch(`/api/admin/designs/${designId}/primary`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId, regeneratePreview: true }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to set primary file");
      }

      // Update preview if returned
      if (result.previewPath && onPreviewChange) {
        onPreviewChange(result.previewPath);
      }

      onFilesChange();
    } catch (err) {
      console.error("Set primary error:", err);
    } finally {
      setSettingPrimary(null);
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    if (!confirm("Are you sure you want to delete this file?")) return;

    try {
      const response = await fetch(
        `/api/admin/designs/${designId}/files/${fileId}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Failed to delete file");
      }

      onFilesChange();
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  const handleUpdateRole = async (fileId: string, newRole: FileRole) => {
    try {
      const response = await fetch(
        `/api/admin/designs/${designId}/files/${fileId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ file_role: newRole }),
        }
      );

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Failed to update file");
      }

      onFilesChange();
    } catch (err) {
      console.error("Update role error:", err);
    }
  };

  const formatBytes = (bytes: number | null): string => {
    if (!bytes) return "Unknown";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getRoleBadgeVariant = (role: FileRole) => {
    switch (role) {
      case "primary":
        return "default";
      case "variant":
        return "secondary";
      case "component":
        return "outline";
    }
  };

  // Group files by role
  const primaryFile = files.find((f) => f.id === primaryFileId);
  const variants = files.filter(
    (f) => f.file_role === "variant" && f.id !== primaryFileId
  );
  const components = files.filter((f) => f.file_role === "component");

  const previewType = previewFile ? getPreviewType(previewFile.file_type) : null;

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Project Files</CardTitle>
          <div className="flex items-center gap-2">
            <Select
              value={selectedRole}
              onValueChange={(v) => setSelectedRole(v as FileRole)}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="variant">Variant</SelectItem>
                <SelectItem value="component">Component</SelectItem>
              </SelectContent>
            </Select>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileUpload}
              className="hidden"
              accept=".stl,.obj,.gltf,.glb,.3mf,.svg,.dxf,.dwg,.ai,.eps,.pdf,.cdr,.png,.jpg,.jpeg,.webp"
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              size="sm"
            >
              {isUploading ? "Uploading..." : "Add Files"}
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {uploadError && (
            <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded-md text-sm">
              {uploadError}
            </div>
          )}

          {files.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No files uploaded yet.
            </p>
          ) : (
            <div className="space-y-4">
              {/* Primary File */}
              {primaryFile && (
                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block">
                    Primary File
                  </Label>
                  <FileItem
                    file={primaryFile}
                    designId={designId}
                    isPrimary
                    isSettingPrimary={settingPrimary === primaryFile.id}
                    canPreviewFile={canPreview(primaryFile.file_type)}
                    onPreview={() => handlePreviewFile(primaryFile)}
                    onSetPrimary={handleSetPrimary}
                    onDelete={handleDeleteFile}
                    onUpdateRole={handleUpdateRole}
                    formatBytes={formatBytes}
                    getRoleBadgeVariant={getRoleBadgeVariant}
                    canDelete={files.length > 1}
                  />
                </div>
              )}

              {/* Variant Files */}
              {variants.length > 0 && (
                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block">
                    Format Variants ({variants.length})
                  </Label>
                  <div className="space-y-2">
                    {variants.map((file) => (
                      <FileItem
                        key={file.id}
                        file={file}
                        designId={designId}
                        isPrimary={false}
                        isSettingPrimary={settingPrimary === file.id}
                        canPreviewFile={canPreview(file.file_type)}
                        onPreview={() => handlePreviewFile(file)}
                        onSetPrimary={handleSetPrimary}
                        onDelete={handleDeleteFile}
                        onUpdateRole={handleUpdateRole}
                        formatBytes={formatBytes}
                        getRoleBadgeVariant={getRoleBadgeVariant}
                        canDelete={files.length > 1}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Component Files */}
              {components.length > 0 && (
                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block">
                    Components ({components.length})
                  </Label>
                  <div className="space-y-2">
                    {components.map((file) => (
                      <FileItem
                        key={file.id}
                        file={file}
                        designId={designId}
                        isPrimary={false}
                        isSettingPrimary={settingPrimary === file.id}
                        canPreviewFile={canPreview(file.file_type)}
                        onPreview={() => handlePreviewFile(file)}
                        onSetPrimary={handleSetPrimary}
                        onDelete={handleDeleteFile}
                        onUpdateRole={handleUpdateRole}
                        formatBytes={formatBytes}
                        getRoleBadgeVariant={getRoleBadgeVariant}
                        canDelete={files.length > 1}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
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
              <Badge variant="secondary" className="ml-2">
                {previewFile?.file_role}
              </Badge>
            </DialogTitle>
            <DialogDescription className="sr-only">
              Preview of {previewFile?.original_filename}
            </DialogDescription>
          </DialogHeader>

          <div className="relative w-full h-[60vh] bg-muted">
            {previewLoading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            )}

            {previewError && (
              <div className="absolute inset-0 flex items-center justify-center text-destructive">
                {previewError}
              </div>
            )}

            {previewUrl && previewType === "image" && (
              <Image
                src={previewUrl}
                alt={previewFile?.display_name || "Preview"}
                fill
                className="object-contain"
              />
            )}

            {previewUrl && previewType === "svg" && (
              <div className="w-full h-full flex items-center justify-center p-8 bg-white dark:bg-gray-900">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt={previewFile?.display_name || "Preview"}
                  className="max-w-full max-h-full object-contain"
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
              <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-white dark:bg-gray-900">
                <div className="text-sm text-muted-foreground mb-4">
                  Generated preview of {previewFile?.file_type?.toUpperCase()} file
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt={previewFile?.display_name || "Preview"}
                  className="max-w-full max-h-[calc(100%-3rem)] object-contain"
                />
              </div>
            )}
          </div>

          <div className="p-4 pt-2 flex justify-between items-center border-t">
            <span className="text-sm text-muted-foreground">
              {formatBytes(previewFile?.size_bytes || null)}
            </span>
            <Button variant="outline" onClick={closePreview}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

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

function FileItem({
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
  return (
    <div
      className={`flex items-center justify-between p-3 border rounded-lg bg-card transition-colors ${
        isSettingPrimary ? "opacity-70" : ""
      } ${canPreviewFile ? "hover:bg-accent/50" : "hover:bg-accent/30"}`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <FileThumbnail
          fileId={file.id}
          fileType={file.file_type}
          designId={designId}
          canPreviewThumbnail={canShowThumbnail(file.file_type)}
        />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-sm truncate">
              {file.display_name || file.original_filename || "Unnamed file"}
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
          <Badge variant="secondary" className="animate-pulse">
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
            title="Preview file"
          >
            <Eye className="h-4 w-4" />
          </Button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" disabled={isSettingPrimary}>
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {canPreviewFile && (
              <DropdownMenuItem onClick={onPreview}>
                <Eye className="h-4 w-4 mr-2" />
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
}
