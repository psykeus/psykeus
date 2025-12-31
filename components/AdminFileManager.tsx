"use client";

import { useState, useRef, useCallback, useMemo } from "react";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/loading-states";
import { InlineError } from "@/components/ui/error-states";
import type { DesignFile, FileRole } from "@/lib/types";
import { formatBytes } from "@/lib/utils";
import { canPreview, getPreviewType } from "@/lib/file-preview-utils";
import { FileItem } from "@/components/FilePreview";

// Dynamically import ModelViewer to avoid SSR issues
const ModelViewer = dynamic(() => import("@/components/ModelViewer"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-muted">
      <Spinner size="lg" />
    </div>
  ),
});

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

  const handlePreviewFile = useCallback(async (file: DesignFile) => {
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
  }, [designId]);

  const closePreview = useCallback(() => {
    setPreviewFile(null);
    setPreviewUrl(null);
    setPreviewError(null);
  }, []);

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

  const handleSetPrimary = useCallback(async (fileId: string) => {
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
  }, [designId, onFilesChange, onPreviewChange]);

  const handleDeleteFile = useCallback(async (fileId: string) => {
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
  }, [designId, onFilesChange]);

  const handleUpdateRole = useCallback(async (fileId: string, newRole: FileRole) => {
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
  }, [designId, onFilesChange]);

  // formatBytes imported from @/lib/utils
  const formatBytesWithDefault = useCallback((bytes: number | null) =>
    formatBytes(bytes, { nullValue: "Unknown" }), []);

  const getRoleBadgeVariant = useCallback((role: FileRole) => {
    switch (role) {
      case "primary":
        return "default";
      case "variant":
        return "secondary";
      case "component":
        return "outline";
    }
  }, []);

  // Memoize file groupings to prevent recalculation on every render
  const { primaryFile, otherFiles } = useMemo(() => ({
    primaryFile: files.find((f) => f.id === primaryFileId),
    otherFiles: files.filter((f) => f.id !== primaryFileId),
  }), [files, primaryFileId]);

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
                    formatBytes={formatBytesWithDefault}
                    getRoleBadgeVariant={getRoleBadgeVariant}
                    canDelete={files.length > 1}
                  />
                </div>
              )}

              {/* Other Files (variants, components, additional files) */}
              {otherFiles.length > 0 && (
                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block">
                    Additional Files ({otherFiles.length})
                  </Label>
                  <div className="space-y-2">
                    {otherFiles.map((file) => (
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
                        formatBytes={formatBytesWithDefault}
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
              {formatBytesWithDefault(previewFile?.size_bytes || null)}
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

