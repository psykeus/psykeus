/**
 * Scheduled Import Service
 *
 * Handles scheduling and processing of scheduled import jobs.
 * Supports both BullMQ queue (when Redis available) and polling fallback.
 */

import { createServiceClient } from "@/lib/supabase/server";
import { enqueueJob, jobQueue } from "@/lib/jobs";
import type { ImportJob, ScheduleImportOptions } from "@/lib/types/import";

/**
 * Schedule an import job for later execution
 *
 * @param jobId - The import job ID to schedule
 * @param options - Scheduling options (datetime or delay)
 * @returns Success status and scheduled time
 */
export async function scheduleImportJob(
  jobId: string,
  options: ScheduleImportOptions
): Promise<{ success: boolean; scheduled_at: string | null; error?: string }> {
  const supabase = createServiceClient();

  // Calculate the scheduled start time
  let scheduledAt: Date;

  if (options.type === "datetime" && options.datetime) {
    scheduledAt = new Date(options.datetime);
    if (scheduledAt <= new Date()) {
      return {
        success: false,
        scheduled_at: null,
        error: "Scheduled time must be in the future",
      };
    }
  } else if (options.type === "delay" && options.delayMinutes) {
    if (options.delayMinutes < 1) {
      return {
        success: false,
        scheduled_at: null,
        error: "Delay must be at least 1 minute",
      };
    }
    if (options.delayMinutes > 10080) {
      // Max 7 days
      return {
        success: false,
        scheduled_at: null,
        error: "Delay cannot exceed 7 days (10080 minutes)",
      };
    }
    scheduledAt = new Date(Date.now() + options.delayMinutes * 60 * 1000);
  } else {
    return {
      success: false,
      scheduled_at: null,
      error: "Invalid schedule options",
    };
  }

  // Update the job with schedule info
  const { error } = await supabase
    .from("import_jobs")
    .update({
      scheduled_start_at: scheduledAt.toISOString(),
      schedule_type: options.type,
    })
    .eq("id", jobId)
    .eq("status", "pending"); // Only schedule pending jobs

  if (error) {
    return { success: false, scheduled_at: null, error: error.message };
  }

  // If queue is available, schedule a job trigger
  const queueAvailable = await jobQueue.isAvailable();
  if (queueAvailable) {
    const delay = scheduledAt.getTime() - Date.now();
    try {
      await enqueueJob(
        { type: "import:start-scheduled", jobId } as Parameters<typeof enqueueJob>[0],
        { delay, jobId: `scheduled-import-${jobId}` }
      );
      console.log(
        `[ScheduledImport] Queued job ${jobId} for ${scheduledAt.toISOString()} via BullMQ`
      );
    } catch (err) {
      console.warn(
        `[ScheduledImport] Failed to queue job ${jobId}, falling back to polling:`,
        err
      );
      // Not a fatal error - polling will pick it up
    }
  } else {
    console.log(
      `[ScheduledImport] Scheduled job ${jobId} for ${scheduledAt.toISOString()} (polling fallback)`
    );
  }

  return { success: true, scheduled_at: scheduledAt.toISOString() };
}

/**
 * Clear schedule from an import job
 *
 * @param jobId - The import job ID to clear schedule from
 * @returns Success status
 */
export async function clearImportSchedule(
  jobId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServiceClient();

  const { error } = await supabase
    .from("import_jobs")
    .update({
      scheduled_start_at: null,
      schedule_type: null,
    })
    .eq("id", jobId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Get scheduled jobs due for processing
 * Used by polling fallback when Redis is not available
 *
 * @returns Array of jobs ready to start
 */
export async function getScheduledJobsDue(): Promise<ImportJob[]> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("import_jobs")
    .select("*")
    .eq("status", "pending")
    .not("scheduled_start_at", "is", null)
    .lte("scheduled_start_at", new Date().toISOString())
    .order("scheduled_start_at", { ascending: true });

  if (error) {
    console.error("[ScheduledImport] Error fetching scheduled jobs:", error);
    return [];
  }

  return data || [];
}

/**
 * Process all due scheduled imports
 * Called by cron job or manual trigger
 *
 * @returns Result with count of started jobs and any errors
 */
export async function processScheduledImports(): Promise<{
  success: boolean;
  started: number;
  errors: string[];
}> {
  const { startJobProcessing } = await import("@/lib/import/job-processor");
  const { getImportJob } = await import("@/lib/services/import-job-service");
  const { DEFAULT_PROCESSING_OPTIONS } = await import("@/lib/types/import");

  const dueJobs = await getScheduledJobsDue();
  const errors: string[] = [];
  let started = 0;

  console.log(`[ScheduledImport] Processing ${dueJobs.length} due job(s)`);

  for (const job of dueJobs) {
    try {
      // Re-fetch job to ensure it's still pending
      const currentJob = await getImportJob(job.id);
      if (!currentJob || currentJob.status !== "pending") {
        console.log(
          `[ScheduledImport] Job ${job.id} is no longer pending, skipping`
        );
        continue;
      }

      // Clear the schedule (so it doesn't trigger again)
      await clearImportSchedule(job.id);

      // Build processing options from job settings
      const options = {
        ...DEFAULT_PROCESSING_OPTIONS,
        generate_previews: job.generate_previews,
        generate_ai_metadata: job.generate_ai_metadata,
        detect_duplicates: job.detect_duplicates,
        auto_publish: job.auto_publish,
      };

      // Start processing
      await startJobProcessing(currentJob, options);

      console.log(`[ScheduledImport] Started scheduled job ${job.id}`);
      started++;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      errors.push(`Job ${job.id}: ${message}`);
      console.error(`[ScheduledImport] Failed to start job ${job.id}:`, err);
    }
  }

  return { success: errors.length === 0, started, errors };
}

/**
 * Get scheduled import jobs for display
 * Returns pending jobs that have a scheduled start time in the future
 *
 * @returns Array of scheduled import jobs
 */
export async function getScheduledImports(): Promise<ImportJob[]> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("import_jobs")
    .select("*")
    .eq("status", "pending")
    .not("scheduled_start_at", "is", null)
    .gt("scheduled_start_at", new Date().toISOString())
    .order("scheduled_start_at", { ascending: true })
    .limit(50);

  if (error) {
    console.error("[ScheduledImport] Error fetching scheduled imports:", error);
    return [];
  }

  return data || [];
}

/**
 * Get time until scheduled start for a job
 *
 * @param job - The import job to check
 * @returns Seconds until start, or null if not scheduled
 */
export function getTimeUntilStart(job: ImportJob): number | null {
  if (!job.scheduled_start_at) return null;

  const scheduledTime = new Date(job.scheduled_start_at).getTime();
  const now = Date.now();

  if (scheduledTime <= now) return 0;

  return Math.floor((scheduledTime - now) / 1000);
}
