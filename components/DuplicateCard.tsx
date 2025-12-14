"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  PREVIEW_SIZES,
  PREVIEW_CONTAINER_CLASSES,
  IMAGE_FIT,
} from "@/lib/preview-config";

interface DesignInfo {
  id: string;
  title: string;
  slug: string;
  preview_path: string;
}

interface DuplicateCardProps {
  design1: DesignInfo;
  design2: DesignInfo;
  similarity: number;
  onDismiss?: () => void;
  onDelete?: (designId: string) => void;
}

export function DuplicateCard({
  design1,
  design2,
  similarity,
  onDismiss,
  onDelete,
}: DuplicateCardProps) {
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isMerging, setIsMerging] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [mergeTarget, setMergeTarget] = useState<string | null>(null);

  if (isDismissed) {
    return null;
  }

  const handleDelete = async (designId: string, title: string) => {
    if (!confirm(`Are you sure you want to delete "${title}"? This cannot be undone.`)) {
      return;
    }

    setIsDeleting(designId);
    try {
      const response = await fetch("/api/admin/duplicates/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", designId }),
      });

      if (!response.ok) {
        const data = await response.json();
        alert(data.error || "Failed to delete design");
        return;
      }

      onDelete?.(designId);
    } catch (error) {
      console.error("Delete error:", error);
      alert("Failed to delete design");
    } finally {
      setIsDeleting(null);
    }
  };

  const handleMerge = async (keepId: string, mergeId: string) => {
    const keepDesign = keepId === design1.id ? design1 : design2;
    const mergeDesign = mergeId === design1.id ? design1 : design2;

    if (
      !confirm(
        `Merge "${mergeDesign.title}" into "${keepDesign.title}"?\n\n` +
          `Files from "${mergeDesign.title}" will be moved to "${keepDesign.title}" as variants, ` +
          `and "${mergeDesign.title}" will be deleted.`
      )
    ) {
      return;
    }

    setIsMerging(true);
    setMergeTarget(keepId);
    try {
      const response = await fetch("/api/admin/duplicates/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "merge",
          designId1: keepId,
          designId2: mergeId,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        alert(data.error || "Failed to merge designs");
        return;
      }

      onDelete?.(mergeId);
    } catch (error) {
      console.error("Merge error:", error);
      alert("Failed to merge designs");
    } finally {
      setIsMerging(false);
      setMergeTarget(null);
    }
  };

  const handleDismiss = async () => {
    try {
      await fetch("/api/admin/duplicates/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "dismiss",
          designId1: design1.id,
          designId2: design2.id,
        }),
      });
      setIsDismissed(true);
      onDismiss?.();
    } catch (error) {
      console.error("Dismiss error:", error);
    }
  };

  const renderDesignCard = (design: DesignInfo, otherDesign: DesignInfo) => {
    const isBeingDeleted = isDeleting === design.id;
    const isBeingMergedAway = isMerging && mergeTarget !== design.id;

    return (
      <div className={`${isBeingDeleted || isBeingMergedAway ? "opacity-50" : ""}`}>
        <div className={`${PREVIEW_CONTAINER_CLASSES.base} ${PREVIEW_CONTAINER_CLASSES.rounded} aspect-square mb-2`}>
          {/* Letterbox background */}
          <div className={`absolute inset-0 ${PREVIEW_CONTAINER_CLASSES.letterbox}`} />
          <Image
            src={design.preview_path}
            alt={design.title}
            fill
            sizes={PREVIEW_SIZES.comparison.sizes}
            quality={PREVIEW_SIZES.comparison.quality}
            className={`${IMAGE_FIT.contain} p-1`}
          />
        </div>
        <p className="font-medium truncate mb-2" title={design.title}>
          {design.title}
        </p>
        <div className="flex flex-col gap-2">
          <Link
            href={`/admin/designs/${design.id}`}
            className="text-sm text-primary hover:underline"
          >
            Edit design
          </Link>
          <div className="flex gap-2">
            <button
              onClick={() => handleDelete(design.id, design.title)}
              disabled={isDeleting !== null || isMerging}
              className="flex-1 px-3 py-1.5 text-sm bg-destructive text-destructive-foreground rounded hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isBeingDeleted ? "Deleting..." : "Delete"}
            </button>
            <button
              onClick={() => handleMerge(design.id, otherDesign.id)}
              disabled={isDeleting !== null || isMerging}
              className="flex-1 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              title={`Keep this, merge the other one into it`}
            >
              {isMerging && mergeTarget === design.id ? "Merging..." : "Keep"}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-card border rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <span
          className={`text-sm font-medium px-2 py-1 rounded ${
            similarity >= 90
              ? "bg-red-500/20 text-red-600 dark:text-red-400"
              : similarity >= 75
              ? "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400"
              : "bg-blue-500/20 text-blue-600 dark:text-blue-400"
          }`}
        >
          {similarity}% similar
        </span>
        <button
          onClick={handleDismiss}
          disabled={isDeleting !== null || isMerging}
          className="text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          Dismiss
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {renderDesignCard(design1, design2)}
        {renderDesignCard(design2, design1)}
      </div>
    </div>
  );
}
