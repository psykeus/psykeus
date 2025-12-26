"use client";

/**
 * ProjectRow Component
 *
 * Displays a detected project row in the import wizard review step.
 * Shows project name, file count, detection reason, and confidence score.
 *
 * Created: 2025-12-26
 * AI Model: Claude Opus 4.5 (claude-opus-4-5-20251101)
 */

import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import type { DetectedProjectPreview } from "@/lib/types/import";

interface ProjectRowProps {
  project: DetectedProjectPreview;
  selected: boolean;
  onToggle: () => void;
}

export function ProjectRow({ project, selected, onToggle }: ProjectRowProps) {
  return (
    <div
      className={`flex items-center gap-3 p-2 rounded cursor-pointer hover:bg-muted/50 ${
        selected ? "bg-primary/5" : ""
      }`}
      onClick={onToggle}
    >
      <Checkbox checked={selected} />
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{project.inferred_name}</div>
        <div className="text-xs text-muted-foreground">
          {project.files.length} file{project.files.length !== 1 ? "s" : ""} &middot;{" "}
          {project.detection_reason} &middot; {Math.round(project.confidence * 100)}% confidence
        </div>
      </div>
      {project.primary_file && (
        <Badge variant="outline" className="text-xs">
          {project.primary_file.file_type.toUpperCase()}
        </Badge>
      )}
    </div>
  );
}
