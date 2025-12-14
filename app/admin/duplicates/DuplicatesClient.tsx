"use client";

import { useState } from "react";
import { DuplicateCard } from "@/components/DuplicateCard";
import type { DuplicatePair } from "./page";

interface DuplicatesClientProps {
  initialDuplicates: DuplicatePair[];
}

export function DuplicatesClient({ initialDuplicates }: DuplicatesClientProps) {
  const [duplicates, setDuplicates] = useState(initialDuplicates);
  const [dismissedPairs, setDismissedPairs] = useState<Set<string>>(new Set());

  const handleDismiss = (design1Id: string, design2Id: string) => {
    const pairKey = [design1Id, design2Id].sort().join("-");
    setDismissedPairs((prev) => new Set([...prev, pairKey]));
  };

  const handleDelete = (deletedDesignId: string) => {
    // Remove all pairs that include this design
    setDuplicates((prev) =>
      prev.filter(
        (dup) =>
          dup.design1.id !== deletedDesignId && dup.design2.id !== deletedDesignId
      )
    );
  };

  const visibleDuplicates = duplicates.filter((dup) => {
    const pairKey = [dup.design1.id, dup.design2.id].sort().join("-");
    return !dismissedPairs.has(pairKey);
  });

  const dismissedCount = dismissedPairs.size;
  const totalRemoved = initialDuplicates.length - duplicates.length;

  return (
    <div>
      {(dismissedCount > 0 || totalRemoved > 0) && (
        <div className="mb-4 p-3 bg-muted rounded-lg flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {dismissedCount > 0 && `${dismissedCount} pair(s) dismissed. `}
            {totalRemoved > 0 && `${totalRemoved} design(s) deleted/merged. `}
            Showing {visibleDuplicates.length} of {initialDuplicates.length} pairs.
          </span>
          {dismissedCount > 0 && (
            <button
              onClick={() => setDismissedPairs(new Set())}
              className="text-sm text-primary hover:underline"
            >
              Show dismissed
            </button>
          )}
        </div>
      )}

      {visibleDuplicates.length > 0 ? (
        <div className="space-y-6">
          {visibleDuplicates.map((dup, index) => (
            <DuplicateCard
              key={`${dup.design1.id}-${dup.design2.id}`}
              design1={dup.design1}
              design2={dup.design2}
              similarity={dup.similarity}
              onDismiss={() => handleDismiss(dup.design1.id, dup.design2.id)}
              onDelete={handleDelete}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-card border rounded-lg">
          <p className="text-muted-foreground">
            {initialDuplicates.length === 0
              ? "No potential duplicates found."
              : "All duplicate pairs have been reviewed."}
          </p>
          {dismissedPairs.size > 0 && (
            <button
              onClick={() => setDismissedPairs(new Set())}
              className="mt-4 text-sm text-primary hover:underline"
            >
              Show {dismissedPairs.size} dismissed pair(s)
            </button>
          )}
        </div>
      )}
    </div>
  );
}
