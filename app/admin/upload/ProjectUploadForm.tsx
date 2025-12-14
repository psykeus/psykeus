"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle, XCircle, Upload, FolderOpen, FileIcon, X, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

type UploadStatus = "idle" | "uploading" | "success" | "error";

interface FileResult {
  success: boolean;
  filename: string;
  fileId?: string;
  error?: string;
}

interface SelectedFile {
  file: File;
  id: string;
}

const SUPPORTED_EXTENSIONS = [
  ".svg", ".dxf", ".dwg", ".ai", ".eps", ".pdf", ".cdr",
  ".stl", ".obj", ".gltf", ".glb", ".3mf",
  ".png", ".jpg", ".jpeg", ".webp", ".gif"
];

export function ProjectUploadForm() {
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [projectTitle, setProjectTitle] = useState("");
  const [generateAiMetadata, setGenerateAiMetadata] = useState(true);
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [results, setResults] = useState<FileResult[]>([]);
  const [designId, setDesignId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const isValidFile = (file: File): boolean => {
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    return SUPPORTED_EXTENSIONS.includes(ext);
  };

  const addFiles = useCallback((files: FileList | File[]) => {
    const newFiles: SelectedFile[] = [];
    for (const file of Array.from(files)) {
      if (isValidFile(file)) {
        // Check for duplicates
        const isDuplicate = selectedFiles.some(sf => sf.file.name === file.name);
        if (!isDuplicate) {
          newFiles.push({
            file,
            id: crypto.randomUUID(),
          });
        }
      }
    }
    if (newFiles.length > 0) {
      setSelectedFiles(prev => [...prev, ...newFiles]);
    }
  }, [selectedFiles]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(e.target.files);
    }
    // Reset input so same files can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files) {
      addFiles(e.dataTransfer.files);
    }
  }, [addFiles]);

  const removeFile = (id: string) => {
    setSelectedFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;

    setStatus("uploading");
    setProgress(10);
    setMessage("Preparing files...");

    try {
      const formData = new FormData();
      for (const sf of selectedFiles) {
        formData.append("files", sf.file);
      }
      formData.append("generateAiMetadata", String(generateAiMetadata));
      if (projectTitle.trim()) {
        formData.append("title", projectTitle.trim());
      }

      // Simulate progress
      const progressInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev < 30) {
            setMessage("Uploading files...");
            return prev + 5;
          } else if (prev < 50) {
            setMessage("Generating preview...");
            return prev + 3;
          } else if (prev < 70 && generateAiMetadata) {
            setMessage("AI analyzing project...");
            return prev + 2;
          } else if (prev < 85) {
            setMessage("Saving to storage...");
            return prev + 2;
          }
          return prev;
        });
      }, 1000);

      const response = await fetch("/api/admin/upload/project", {
        method: "POST",
        body: formData,
      });

      clearInterval(progressInterval);

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Upload failed");
      }

      setProgress(100);
      setStatus("success");
      setMessage(`Created "${data.title}" with ${data.successCount} file(s)`);
      setResults(data.filesProcessed || []);
      setDesignId(data.designId);

      router.refresh();
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Upload failed");
    }
  };

  const reset = () => {
    setSelectedFiles([]);
    setProjectTitle("");
    setStatus("idle");
    setProgress(0);
    setMessage(null);
    setResults([]);
    setDesignId(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileExtension = (name: string): string => {
    return name.split(".").pop()?.toUpperCase() || "?";
  };

  const totalSize = selectedFiles.reduce((sum, sf) => sum + sf.file.size, 0);

  return (
    <div className="space-y-6">
      {/* Info Card */}
      <Card className="p-4 bg-muted/50">
        <div className="flex items-start gap-3">
          <FolderOpen className="h-5 w-5 text-primary mt-0.5" />
          <div className="text-sm">
            <p className="font-medium">Multi-File Project Upload</p>
            <p className="text-muted-foreground mt-1">
              Drag and drop multiple design files to create a single project. Files with the same
              name but different extensions are treated as format variants. Different names are
              treated as project components.
            </p>
          </div>
        </div>
      </Card>

      {/* Drop Zone */}
      <Card
        className={`border-2 border-dashed p-8 text-center transition-all ${
          isDragging
            ? "border-primary bg-primary/10"
            : selectedFiles.length > 0
              ? "border-primary/50 bg-primary/5"
              : "border-muted-foreground/25"
        } ${status === "uploading" ? "opacity-50 pointer-events-none" : "cursor-pointer hover:border-primary/50"}`}
        onClick={() => status !== "uploading" && fileInputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={SUPPORTED_EXTENSIONS.join(",")}
          multiple
          onChange={handleFileSelect}
          className="hidden"
          disabled={status === "uploading"}
        />

        {selectedFiles.length > 0 ? (
          <div className="space-y-2">
            <FolderOpen className="h-12 w-12 mx-auto text-primary" />
            <p className="font-medium">{selectedFiles.length} file(s) selected</p>
            <p className="text-sm text-muted-foreground">Total: {formatFileSize(totalSize)}</p>
            <p className="text-xs text-muted-foreground">Click or drop to add more files</p>
          </div>
        ) : (
          <div className="space-y-4">
            <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground" />
            <div>
              <p className="text-lg font-medium">Drop files here</p>
              <p className="text-sm text-muted-foreground">
                or click to browse
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-1 max-w-md mx-auto">
              {["SVG", "DXF", "STL", "OBJ", "PDF", "PNG"].map(ext => (
                <Badge key={ext} variant="outline" className="text-xs">
                  {ext}
                </Badge>
              ))}
              <Badge variant="outline" className="text-xs">+more</Badge>
            </div>
            <Button variant="outline" disabled={status === "uploading"}>
              Browse Files
            </Button>
          </div>
        )}
      </Card>

      {/* File List */}
      {selectedFiles.length > 0 && status === "idle" && (
        <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
          {selectedFiles.map((sf, index) => (
            <div
              key={sf.id}
              className="flex items-center gap-3 px-4 py-2 hover:bg-muted/50 group"
            >
              <GripVertical className="h-4 w-4 text-muted-foreground/50" />
              <LocalFileThumbnail file={sf.file} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium truncate">{sf.file.name}</p>
                  <Badge variant="outline" className="text-xs uppercase shrink-0 hidden sm:inline-flex">
                    {getFileExtension(sf.file.name)}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(sf.file.size)}
                  {index === 0 && (
                    <span className="ml-2 text-primary">Primary file</span>
                  )}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  removeFile(sf.id);
                }}
                className="opacity-0 group-hover:opacity-100"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Options */}
      {selectedFiles.length > 0 && status === "idle" && (
        <div className="space-y-4">
          {/* Project Title */}
          <div className="space-y-2">
            <Label htmlFor="project-title">Project Title (optional)</Label>
            <Input
              id="project-title"
              value={projectTitle}
              onChange={(e) => setProjectTitle(e.target.value)}
              placeholder="Leave empty to auto-generate from primary file"
            />
          </div>

          {/* AI Metadata Toggle */}
          <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
            <input
              type="checkbox"
              id="ai-metadata-project"
              checked={generateAiMetadata}
              onChange={(e) => setGenerateAiMetadata(e.target.checked)}
              className="mt-1 rounded"
            />
            <div>
              <label htmlFor="ai-metadata-project" className="font-medium cursor-pointer">
                Generate AI Metadata
              </label>
              <p className="text-sm text-muted-foreground mt-0.5">
                Analyze the project using AI to extract title, description, and tags.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-4">
            <Button variant="outline" onClick={reset}>
              Clear All
            </Button>
            <Button onClick={handleUpload}>
              <Upload className="h-4 w-4 mr-2" />
              Upload Project ({selectedFiles.length} files)
            </Button>
          </div>
        </div>
      )}

      {/* Upload Progress */}
      {status === "uploading" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm">{message}</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      )}

      {/* Success State */}
      {status === "success" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-green-600">
            <CheckCircle className="h-5 w-5" />
            <span className="font-medium">{message}</span>
          </div>

          {/* File Results */}
          {results.length > 0 && (
            <div className="border rounded-lg divide-y">
              {results.map((result, index) => (
                <div
                  key={index}
                  className={`flex items-center gap-3 px-4 py-2 ${
                    result.success ? "bg-green-50 dark:bg-green-950/20" : "bg-red-50 dark:bg-red-950/20"
                  }`}
                >
                  {result.success ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive" />
                  )}
                  <FileIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm flex-1">{result.filename}</span>
                  {!result.success && result.error && (
                    <span className="text-xs text-destructive">{result.error}</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-4">
            <Button variant="outline" onClick={reset}>
              Upload Another
            </Button>
            {designId && (
              <Button asChild>
                <a href={`/admin/designs/${designId}`}>Edit Project</a>
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Error State */}
      {status === "error" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-destructive">
            <XCircle className="h-5 w-5" />
            <span>{message}</span>
          </div>
          <div className="flex justify-end gap-4">
            <Button variant="outline" onClick={reset}>
              Try Again
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
