"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, XCircle, Upload, Archive, FileIcon } from "lucide-react";
import { Spinner } from "@/components/ui/loading-states";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type UploadStatus = "idle" | "uploading" | "success" | "error";

interface FileResult {
  success: boolean;
  filename: string;
  fileId?: string;
  error?: string;
}

export function ZipUploadForm() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [projectTitle, setProjectTitle] = useState("");
  const [generateAiMetadata, setGenerateAiMetadata] = useState(true);
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [results, setResults] = useState<FileResult[]>([]);
  const [designId, setDesignId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.toLowerCase().endsWith(".zip")) {
        alert("Please select a ZIP file");
        return;
      }
      setSelectedFile(file);
      setStatus("idle");
      setMessage(null);
      setResults([]);
      setDesignId(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setStatus("uploading");
    setProgress(10);
    setMessage("Uploading ZIP file...");

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("generateAiMetadata", String(generateAiMetadata));
      if (projectTitle.trim()) {
        formData.append("title", projectTitle.trim());
      }

      // Simulate progress stages
      const progressInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev < 30) {
            setMessage("Extracting files from ZIP...");
            return prev + 5;
          } else if (prev < 50) {
            setMessage("Generating preview...");
            return prev + 3;
          } else if (prev < 70 && generateAiMetadata) {
            setMessage("AI analyzing design...");
            return prev + 2;
          } else if (prev < 85) {
            setMessage("Uploading files to storage...");
            return prev + 2;
          }
          return prev;
        });
      }, 1000);

      const response = await fetch("/api/admin/upload/zip", {
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
    setSelectedFile(null);
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

  return (
    <div className="space-y-6">
      {/* Info Card */}
      <Card className="p-4 bg-muted/50">
        <div className="flex items-start gap-3">
          <Archive className="h-5 w-5 text-primary mt-0.5" />
          <div className="text-sm">
            <p className="font-medium">Multi-file Project Upload</p>
            <p className="text-muted-foreground mt-1">
              Upload a ZIP file containing multiple design files (SVG, DXF, STL, etc.) to create
              a single project with multiple format options. The first valid file will be used
              as the primary file for preview and AI analysis.
            </p>
          </div>
        </div>
      </Card>

      {/* File Selection */}
      <Card
        className={`border-2 border-dashed p-8 text-center transition-all ${
          selectedFile ? "border-primary bg-primary/5" : "border-muted-foreground/25"
        } ${status === "uploading" ? "opacity-50 pointer-events-none" : "cursor-pointer hover:border-primary/50"}`}
        onClick={() => status !== "uploading" && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".zip"
          onChange={handleFileSelect}
          className="hidden"
          disabled={status === "uploading"}
        />

        {selectedFile ? (
          <div className="space-y-2">
            <Archive className="h-12 w-12 mx-auto text-primary" />
            <p className="font-medium">{selectedFile.name}</p>
            <p className="text-sm text-muted-foreground">{formatFileSize(selectedFile.size)}</p>
          </div>
        ) : (
          <div className="space-y-4">
            <Archive className="h-12 w-12 mx-auto text-muted-foreground" />
            <div>
              <p className="text-lg font-medium">Select a ZIP file</p>
              <p className="text-sm text-muted-foreground">
                containing multiple design files
              </p>
            </div>
            <Button variant="outline" disabled={status === "uploading"}>
              Browse Files
            </Button>
          </div>
        )}
      </Card>

      {/* Options */}
      {selectedFile && status === "idle" && (
        <div className="space-y-4">
          {/* Project Title */}
          <div className="space-y-2">
            <Label htmlFor="project-title">Project Title (optional)</Label>
            <Input
              id="project-title"
              value={projectTitle}
              onChange={(e) => setProjectTitle(e.target.value)}
              placeholder="Leave empty to auto-generate from filename"
            />
          </div>

          {/* AI Metadata Toggle */}
          <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
            <input
              type="checkbox"
              id="ai-metadata-zip"
              checked={generateAiMetadata}
              onChange={(e) => setGenerateAiMetadata(e.target.checked)}
              className="mt-1 rounded"
            />
            <div>
              <label htmlFor="ai-metadata-zip" className="font-medium cursor-pointer">
                Generate AI Metadata
              </label>
              <p className="text-sm text-muted-foreground mt-0.5">
                Analyze the primary file using AI to extract title, description, and tags.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-4">
            <Button variant="outline" onClick={reset}>
              Cancel
            </Button>
            <Button onClick={handleUpload}>
              <Upload className="h-4 w-4 mr-2" />
              Upload Project
            </Button>
          </div>
        </div>
      )}

      {/* Upload Progress */}
      {status === "uploading" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Spinner size="sm" />
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
