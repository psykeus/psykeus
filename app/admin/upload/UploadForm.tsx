"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { DESIGN_EXTENSIONS, isSupportedExtension } from "@/lib/file-types";
import { Loader2, CheckCircle, XCircle, Clock, Upload, X, FileIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

// File types that can show local thumbnails
const LOCAL_PREVIEWABLE = ["png", "jpg", "jpeg", "webp", "gif", "svg"];

function canShowLocalThumbnail(filename: string): boolean {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  return LOCAL_PREVIEWABLE.includes(ext);
}

// File type colors for icons
const FILE_TYPE_COLORS: Record<string, string> = {
  svg: "text-orange-500 bg-orange-50 dark:bg-orange-950",
  dxf: "text-blue-500 bg-blue-50 dark:bg-blue-950",
  dwg: "text-blue-600 bg-blue-50 dark:bg-blue-950",
  ai: "text-orange-600 bg-orange-50 dark:bg-orange-950",
  eps: "text-purple-500 bg-purple-50 dark:bg-purple-950",
  png: "text-green-500 bg-green-50 dark:bg-green-950",
  jpg: "text-green-600 bg-green-50 dark:bg-green-950",
  jpeg: "text-green-600 bg-green-50 dark:bg-green-950",
  webp: "text-green-500 bg-green-50 dark:bg-green-950",
  gif: "text-pink-500 bg-pink-50 dark:bg-pink-950",
  stl: "text-cyan-500 bg-cyan-50 dark:bg-cyan-950",
  obj: "text-cyan-600 bg-cyan-50 dark:bg-cyan-950",
  gltf: "text-cyan-500 bg-cyan-50 dark:bg-cyan-950",
  glb: "text-cyan-600 bg-cyan-50 dark:bg-cyan-950",
  "3mf": "text-cyan-500 bg-cyan-50 dark:bg-cyan-950",
  pdf: "text-red-500 bg-red-50 dark:bg-red-950",
  cdr: "text-green-600 bg-green-50 dark:bg-green-950",
  default: "text-gray-500 bg-gray-100 dark:bg-gray-800",
};

function getFileTypeColor(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  return FILE_TYPE_COLORS[ext] || FILE_TYPE_COLORS.default;
}

/**
 * Thumbnail component for local files (not yet uploaded)
 */
function LocalFileThumbnail({ file }: { file: File }) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);

  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  const canPreview = canShowLocalThumbnail(file.name);

  useEffect(() => {
    if (!canPreview) return;

    const url = URL.createObjectURL(file);
    setThumbnailUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file, canPreview]);

  const colorClass = getFileTypeColor(file.name);
  const typeLabel = ext.toUpperCase();

  // For non-previewable files or on error, show styled icon
  if (!canPreview || hasError) {
    return (
      <div className={`w-10 h-10 rounded flex flex-col items-center justify-center shrink-0 ${colorClass}`}>
        <FileIcon className="w-3.5 h-3.5" />
        <span className="text-[7px] font-bold mt-0.5 leading-none">
          {typeLabel.slice(0, 4)}
        </span>
      </div>
    );
  }

  return (
    <div className="w-10 h-10 rounded bg-muted overflow-hidden shrink-0">
      {thumbnailUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumbnailUrl}
          alt=""
          className="w-full h-full object-cover"
          onError={() => setHasError(true)}
        />
      )}
    </div>
  );
}

type FileStatus = "pending" | "uploading" | "success" | "error";
type UploadStage = "uploading" | "preview" | "analyzing" | "saving";

interface FileWithStatus {
  file: File;
  status: FileStatus;
  progress: number;
  stage?: UploadStage;
  error?: string;
  designId?: string;
}

const STAGE_INFO: Record<UploadStage, { label: string; progress: number }> = {
  uploading: { label: "Uploading file...", progress: 15 },
  preview: { label: "Generating preview...", progress: 40 },
  analyzing: { label: "AI analyzing...", progress: 70 },
  saving: { label: "Saving to library...", progress: 90 },
};

// Estimate processing time based on file type
function getEstimatedTime(filename: string): string {
  const ext = filename.toLowerCase().split(".").pop() || "";
  const is3D = ["stl", "obj", "gltf", "glb", "3mf"].includes(ext);
  if (is3D) {
    return "~20-40 seconds (3D model)";
  }
  return "~5-15 seconds";
}

interface UploadResult {
  success: boolean;
  filename: string;
  designId?: string;
  error?: string;
}

export function UploadForm() {
  const [files, setFiles] = useState<FileWithStatus[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [generateAiMetadata, setGenerateAiMetadata] = useState(true);
  const [overallProgress, setOverallProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const validateAndAddFiles = useCallback((newFiles: FileList | File[]) => {
    const validFiles: FileWithStatus[] = [];
    const invalidFiles: string[] = [];

    Array.from(newFiles).forEach((file) => {
      if (isSupportedExtension(file.name)) {
        validFiles.push({
          file,
          status: "pending",
          progress: 0,
        });
      } else {
        invalidFiles.push(file.name);
      }
    });

    if (invalidFiles.length > 0) {
      alert(`Unsupported files skipped: ${invalidFiles.join(", ")}`);
    }

    setFiles((prev) => [...prev, ...validFiles]);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      validateAndAddFiles(e.dataTransfer.files);
    },
    [validateAndAddFiles]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        validateAndAddFiles(e.target.files);
      }
    },
    [validateAndAddFiles]
  );

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const clearAll = useCallback(() => {
    setFiles([]);
    setOverallProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const clearCompleted = useCallback(() => {
    setFiles((prev) => prev.filter((f) => f.status !== "success"));
  }, []);

  const uploadSingleFile = async (fileWithStatus: FileWithStatus, index: number): Promise<void> => {
    // Update status to uploading with initial stage
    setFiles((prev) =>
      prev.map((f, i) =>
        i === index ? { ...f, status: "uploading" as FileStatus, stage: "uploading" as UploadStage, progress: 10 } : f
      )
    );

    try {
      const formData = new FormData();
      formData.append("files", fileWithStatus.file);
      formData.append("generateAiMetadata", String(generateAiMetadata));

      // Determine if this is a 3D file (takes longer)
      const ext = fileWithStatus.file.name.toLowerCase().split(".").pop() || "";
      const is3D = ["stl", "obj", "gltf", "glb", "3mf"].includes(ext);
      const stages: UploadStage[] = is3D && generateAiMetadata
        ? ["uploading", "preview", "analyzing", "saving"]
        : generateAiMetadata
        ? ["uploading", "analyzing", "saving"]
        : ["uploading", "saving"];

      let currentStageIndex = 0;
      const stageInterval = is3D ? 8000 : 3000; // 3D files take longer per stage

      // Simulate progress through stages during upload
      const progressInterval = setInterval(() => {
        setFiles((prev) =>
          prev.map((f, i) => {
            if (i !== index || f.status !== "uploading") return f;

            // Advance to next stage periodically
            if (currentStageIndex < stages.length - 1) {
              const timeSinceStart = Date.now() - uploadStartTime;
              const expectedStage = Math.min(
                Math.floor(timeSinceStart / stageInterval),
                stages.length - 1
              );
              if (expectedStage > currentStageIndex) {
                currentStageIndex = expectedStage;
              }
            }

            const stage = stages[currentStageIndex];
            const stageProgress = STAGE_INFO[stage].progress;
            const nextProgress = Math.min(f.progress + 5, stageProgress);

            return { ...f, stage, progress: nextProgress };
          })
        );
      }, 1000);

      const uploadStartTime = Date.now();

      const response = await fetch("/api/admin/upload", {
        method: "POST",
        body: formData,
      });

      clearInterval(progressInterval);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Upload failed");
      }

      const data = await response.json();
      const result: UploadResult = data.results?.[0];

      if (result?.success) {
        setFiles((prev) =>
          prev.map((f, i) =>
            i === index
              ? { ...f, status: "success" as FileStatus, progress: 100, stage: undefined, designId: result.designId }
              : f
          )
        );
      } else {
        throw new Error(result?.error || "Upload failed");
      }
    } catch (err) {
      setFiles((prev) =>
        prev.map((f, i) =>
          i === index
            ? {
                ...f,
                status: "error" as FileStatus,
                progress: 0,
                stage: undefined,
                error: err instanceof Error ? err.message : "Upload failed",
              }
            : f
        )
      );
    }
  };

  const handleUpload = async () => {
    const pendingFiles = files.filter((f) => f.status === "pending");
    if (pendingFiles.length === 0) return;

    setIsUploading(true);
    setOverallProgress(0);

    // Upload files sequentially
    for (let i = 0; i < files.length; i++) {
      if (files[i].status === "pending") {
        await uploadSingleFile(files[i], i);

        // Update overall progress
        const completed = files.filter((f) => f.status === "success" || f.status === "error").length + 1;
        setOverallProgress(Math.round((completed / files.length) * 100));
      }
    }

    setIsUploading(false);
    router.refresh();
  };

  const retryFailed = async () => {
    const failedIndices = files
      .map((f, i) => (f.status === "error" ? i : -1))
      .filter((i) => i !== -1);

    if (failedIndices.length === 0) return;

    // Reset failed files to pending
    setFiles((prev) =>
      prev.map((f) =>
        f.status === "error" ? { ...f, status: "pending" as FileStatus, progress: 0, error: undefined } : f
      )
    );

    setIsUploading(true);

    for (const index of failedIndices) {
      await uploadSingleFile(files[index], index);
    }

    setIsUploading(false);
    router.refresh();
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getStatusIcon = (status: FileStatus) => {
    switch (status) {
      case "pending":
        return <Clock className="h-5 w-5 text-muted-foreground" />;
      case "uploading":
        return <Loader2 className="h-5 w-5 text-primary animate-spin" />;
      case "success":
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case "error":
        return <XCircle className="h-5 w-5 text-destructive" />;
    }
  };

  const getStatusText = (fileWithStatus: FileWithStatus) => {
    switch (fileWithStatus.status) {
      case "pending":
        return `Waiting... (${getEstimatedTime(fileWithStatus.file.name)})`;
      case "uploading":
        return fileWithStatus.stage ? STAGE_INFO[fileWithStatus.stage].label : "Processing...";
      case "success":
        return "Complete";
      case "error":
        return "Failed";
    }
  };

  const pendingCount = files.filter((f) => f.status === "pending").length;
  const successCount = files.filter((f) => f.status === "success").length;
  const errorCount = files.filter((f) => f.status === "error").length;
  const uploadingCount = files.filter((f) => f.status === "uploading").length;

  return (
    <div className="space-y-6">
      {/* Drop Zone */}
      <Card
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          border-2 border-dashed p-12 text-center transition-all cursor-pointer
          ${isDragging
            ? "border-primary bg-primary/5 scale-[1.02]"
            : "border-muted-foreground/25 hover:border-primary/50"
          }
          ${isUploading ? "pointer-events-none opacity-50" : ""}
        `}
        onClick={() => !isUploading && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={DESIGN_EXTENSIONS.join(",")}
          onChange={handleFileSelect}
          className="hidden"
          disabled={isUploading}
        />

        <div className="space-y-4">
          <div className="mx-auto w-16 h-16 text-muted-foreground">
            <Upload className="w-full h-full" />
          </div>

          <div>
            <p className="text-lg font-medium">
              Drag and drop your design files here
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              or click to browse
            </p>
          </div>

          <Button variant="default" disabled={isUploading}>
            Select Files
          </Button>

          <p className="text-xs text-muted-foreground">
            Supported: {DESIGN_EXTENSIONS.join(", ")}
          </p>
        </div>
      </Card>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-4">
          {/* Header with stats */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <h3 className="font-semibold">
                Files ({files.length})
              </h3>
              <div className="flex gap-3 text-sm">
                {pendingCount > 0 && (
                  <span className="text-muted-foreground">{pendingCount} pending</span>
                )}
                {uploadingCount > 0 && (
                  <span className="text-primary">{uploadingCount} uploading</span>
                )}
                {successCount > 0 && (
                  <span className="text-green-600">{successCount} complete</span>
                )}
                {errorCount > 0 && (
                  <span className="text-destructive">{errorCount} failed</span>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              {successCount > 0 && (
                <Button variant="outline" size="sm" onClick={clearCompleted}>
                  Clear completed
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={clearAll} disabled={isUploading}>
                Clear all
              </Button>
            </div>
          </div>

          {/* Overall Progress */}
          {isUploading && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Overall progress</span>
                <span className="font-medium">{overallProgress}%</span>
              </div>
              <Progress value={overallProgress} className="h-2" />
            </div>
          )}

          {/* File List */}
          <div className="border rounded-lg divide-y max-h-[400px] overflow-y-auto">
            {files.map((fileWithStatus, index) => (
              <div
                key={`${fileWithStatus.file.name}-${index}`}
                className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                  fileWithStatus.status === "success"
                    ? "bg-green-50 dark:bg-green-950/20"
                    : fileWithStatus.status === "error"
                    ? "bg-red-50 dark:bg-red-950/20"
                    : fileWithStatus.status === "uploading"
                    ? "bg-primary/5"
                    : ""
                }`}
              >
                {/* Status Icon */}
                <div className="flex-shrink-0">
                  {getStatusIcon(fileWithStatus.status)}
                </div>

                {/* Thumbnail */}
                <LocalFileThumbnail file={fileWithStatus.file} />

                {/* File Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{fileWithStatus.file.name}</p>
                    <Badge variant="outline" className="text-xs uppercase shrink-0 hidden sm:inline-flex">
                      {fileWithStatus.file.name.split(".").pop()?.toUpperCase() || "?"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-muted-foreground">
                      {formatFileSize(fileWithStatus.file.size)}
                    </span>
                    <span className={`text-xs ${
                      fileWithStatus.status === "success"
                        ? "text-green-600"
                        : fileWithStatus.status === "error"
                        ? "text-destructive"
                        : fileWithStatus.status === "uploading"
                        ? "text-primary"
                        : "text-muted-foreground"
                    }`}>
                      {fileWithStatus.error || getStatusText(fileWithStatus)}
                    </span>
                  </div>

                  {/* Individual Progress Bar */}
                  {fileWithStatus.status === "uploading" && (
                    <div className="mt-2">
                      <Progress value={fileWithStatus.progress} className="h-1" />
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex-shrink-0 flex items-center gap-2">
                  {fileWithStatus.status === "success" && fileWithStatus.designId && (
                    <a
                      href={`/admin/designs/${fileWithStatus.designId}`}
                      className="text-xs text-primary hover:underline"
                    >
                      Edit
                    </a>
                  )}
                  {fileWithStatus.status === "pending" && !isUploading && (
                    <button
                      onClick={() => removeFile(index)}
                      className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                      aria-label="Remove file"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* AI Metadata Toggle */}
          <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
            <input
              type="checkbox"
              id="ai-metadata"
              checked={generateAiMetadata}
              onChange={(e) => setGenerateAiMetadata(e.target.checked)}
              className="mt-1 rounded"
              disabled={isUploading}
            />
            <div>
              <label htmlFor="ai-metadata" className="font-medium cursor-pointer">
                Generate AI Metadata
              </label>
              <p className="text-sm text-muted-foreground mt-0.5">
                Automatically analyze designs using AI to extract title, description,
                difficulty, materials, and style.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-4">
            {errorCount > 0 && !isUploading && (
              <Button variant="outline" onClick={retryFailed}>
                Retry failed ({errorCount})
              </Button>
            )}
            <Button
              onClick={handleUpload}
              disabled={isUploading || pendingCount === 0}
              className="min-w-[150px]"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload {pendingCount > 0 ? `${pendingCount} file${pendingCount !== 1 ? "s" : ""}` : "files"}
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
