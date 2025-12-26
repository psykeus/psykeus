"use client";

/**
 * PreviewPriorityList Component
 *
 * Allows users to configure the priority order for preview file types.
 * Supports reordering via up/down buttons.
 *
 * Created: 2025-12-26
 * AI Model: Claude Opus 4.5 (claude-opus-4-5-20251101)
 */

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GripVertical, ChevronUp, ChevronDown } from "lucide-react";

interface PreviewPriorityListProps {
  priority: string[];
  onChange: (newPriority: string[]) => void;
}

export function PreviewPriorityList({ priority, onChange }: PreviewPriorityListProps) {
  const moveUp = (index: number) => {
    if (index === 0) return;
    const newPriority = [...priority];
    [newPriority[index - 1], newPriority[index]] = [newPriority[index], newPriority[index - 1]];
    onChange(newPriority);
  };

  const moveDown = (index: number) => {
    if (index === priority.length - 1) return;
    const newPriority = [...priority];
    [newPriority[index], newPriority[index + 1]] = [newPriority[index + 1], newPriority[index]];
    onChange(newPriority);
  };

  return (
    <div className="border rounded-lg divide-y bg-card">
      {priority.map((type, index) => (
        <div key={type} className="flex items-center gap-2 px-3 py-2 text-sm">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
          <span className="flex-1 font-mono uppercase">{type}</span>
          <Badge variant="outline" className="text-xs">
            #{index + 1}
          </Badge>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => moveUp(index)}
              disabled={index === 0}
            >
              <ChevronUp className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => moveDown(index)}
              disabled={index === priority.length - 1}
            >
              <ChevronDown className="h-3 w-3" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
