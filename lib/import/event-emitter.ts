/**
 * Import Event Emitter
 *
 * Handles real-time progress updates via pub/sub pattern.
 * Used to stream import job progress to connected clients via SSE.
 *
 * Created: 2025-12-26
 * AI Model: Claude Opus 4.5 (claude-opus-4-5-20251101)
 */

import type { ImportEvent } from "@/lib/types/import";

// Type for event callback functions
export type EventCallback = (event: ImportEvent) => void;

// Map of job IDs to their registered event listeners
const eventListeners = new Map<string, Set<EventCallback>>();

/**
 * Subscribe to events for a specific job.
 *
 * @param jobId - The job ID to subscribe to
 * @param callback - Function to call when events occur
 * @returns Unsubscribe function
 */
export function subscribeToJob(jobId: string, callback: EventCallback): () => void {
  if (!eventListeners.has(jobId)) {
    eventListeners.set(jobId, new Set());
  }
  eventListeners.get(jobId)!.add(callback);

  // Return unsubscribe function
  return () => {
    eventListeners.get(jobId)?.delete(callback);
    if (eventListeners.get(jobId)?.size === 0) {
      eventListeners.delete(jobId);
    }
  };
}

/**
 * Emit an event to all subscribers of a job.
 *
 * @param jobId - The job ID to emit to
 * @param event - The event to emit
 */
export function emitEvent(jobId: string, event: ImportEvent): void {
  const listeners = eventListeners.get(jobId);
  if (listeners) {
    for (const callback of listeners) {
      try {
        callback(event);
      } catch (err) {
        console.error("Event callback error:", err);
      }
    }
  }
}

/**
 * Emit a per-item step event to show granular progress.
 * Used to provide real-time feedback during long operations.
 *
 * @param jobId - The job ID
 * @param filename - The file being processed
 * @param step - The current processing step
 * @param detail - Optional additional detail
 */
export function emitItemStep(
  jobId: string,
  filename: string,
  step: "reading" | "hash" | "preview" | "ai_metadata" | "uploading" | "saving",
  detail?: string
): void {
  const stepLabels: Record<string, string> = {
    reading: "Reading file",
    hash: "Computing hash",
    preview: "Generating preview",
    ai_metadata: "AI metadata extraction",
    uploading: "Uploading to storage",
    saving: "Saving to database",
  };

  emitEvent(jobId, {
    type: "item:step",
    job_id: jobId,
    timestamp: new Date().toISOString(),
    data: {
      filename,
      step,
      step_label: stepLabels[step] || step,
      detail,
    },
  });
}

/**
 * Emit an activity update for real-time feedback during long operations.
 *
 * @param jobId - The job ID
 * @param message - The activity message
 * @param filename - Optional filename being processed
 */
export function emitActivity(jobId: string, message: string, filename?: string): void {
  emitEvent(jobId, {
    type: "activity:update",
    job_id: jobId,
    timestamp: new Date().toISOString(),
    data: {
      message,
      filename,
    },
  });
}

/**
 * Check if a job has any active listeners.
 *
 * @param jobId - The job ID to check
 * @returns True if there are active listeners
 */
export function hasListeners(jobId: string): boolean {
  return (eventListeners.get(jobId)?.size ?? 0) > 0;
}

/**
 * Get the count of active listeners for a job.
 *
 * @param jobId - The job ID to check
 * @returns Number of active listeners
 */
export function getListenerCount(jobId: string): number {
  return eventListeners.get(jobId)?.size ?? 0;
}
