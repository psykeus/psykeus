/**
 * Background Job Queue using BullMQ
 *
 * Provides async job processing for heavy tasks:
 * - Preview generation
 * - AI metadata extraction
 * - Scheduled publishing
 * - Webhook delivery
 *
 * Falls back gracefully when Redis is not available.
 */

import type { Queue, Worker, Job } from "bullmq";

// =============================================================================
// Types
// =============================================================================

export type JobType =
  | "preview:generate"
  | "ai:extract-metadata"
  | "design:publish"
  | "design:unpublish"
  | "webhook:deliver"
  | "import:process-item"
  | "import:start-scheduled";

export interface PreviewGenerateJob {
  type: "preview:generate";
  designId: string;
  fileId: string;
  storagePath: string;
  fileType: string;
}

export interface AIExtractMetadataJob {
  type: "ai:extract-metadata";
  designId: string;
  fileId: string;
  storagePath: string;
  fileType: string;
}

export interface DesignPublishJob {
  type: "design:publish";
  designId: string;
}

export interface DesignUnpublishJob {
  type: "design:unpublish";
  designId: string;
}

export interface WebhookDeliverJob {
  type: "webhook:deliver";
  webhookId: string;
  event: string;
  payload: Record<string, unknown>;
  attempt?: number;
}

export interface ImportProcessItemJob {
  type: "import:process-item";
  jobId: string;
  itemId: string;
}

export interface ImportStartScheduledJob {
  type: "import:start-scheduled";
  jobId: string;
}

export type JobData =
  | PreviewGenerateJob
  | AIExtractMetadataJob
  | DesignPublishJob
  | DesignUnpublishJob
  | WebhookDeliverJob
  | ImportProcessItemJob
  | ImportStartScheduledJob;

export interface JobResult {
  success: boolean;
  message?: string;
  data?: Record<string, unknown>;
  error?: string;
}

export interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

// =============================================================================
// Queue Manager
// =============================================================================

const QUEUE_NAME = "cnc-design-library";

class JobQueueManager {
  private queue: Queue<JobData, JobResult> | null = null;
  private worker: Worker<JobData, JobResult> | null = null;
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  /**
   * Initialize the queue connection
   */
  async init(): Promise<boolean> {
    if (this.initialized) return this.queue !== null;

    if (this.initPromise) {
      await this.initPromise;
      return this.queue !== null;
    }

    this.initPromise = this._init();
    await this.initPromise;
    return this.queue !== null;
  }

  private async _init(): Promise<void> {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      console.log("[JobQueue] No REDIS_URL configured, background jobs disabled");
      this.initialized = true;
      return;
    }

    try {
      // Dynamic import to avoid bundling if not used
      const { Queue: BullQueue, Worker: BullWorker } = await import("bullmq");

      // Parse Redis URL for connection options
      const connection = this.parseRedisUrl(redisUrl);

      // Create queue
      this.queue = new BullQueue<JobData, JobResult>(QUEUE_NAME, {
        connection,
        defaultJobOptions: {
          removeOnComplete: { count: 1000 }, // Keep last 1000 completed
          removeOnFail: { count: 5000 }, // Keep last 5000 failed for debugging
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 1000,
          },
        },
      });

      // Create worker (only in server context, not during build)
      if (typeof window === "undefined" && process.env.NODE_ENV !== "test") {
        this.worker = new BullWorker<JobData, JobResult>(
          QUEUE_NAME,
          async (job) => this.processJob(job),
          {
            connection,
            concurrency: 5,
          }
        );

        this.worker.on("completed", (job) => {
          console.log(`[JobQueue] Job ${job.id} completed: ${job.name}`);
        });

        this.worker.on("failed", (job, err) => {
          console.error(`[JobQueue] Job ${job?.id} failed:`, err.message);
        });
      }

      console.log("[JobQueue] Connected to Redis, background jobs enabled");
      this.initialized = true;
    } catch (error) {
      console.warn("[JobQueue] Failed to initialize:", error);
      this.initialized = true;
    }
  }

  private parseRedisUrl(url: string): { host: string; port: number; password?: string } {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: parseInt(parsed.port) || 6379,
      password: parsed.password || undefined,
    };
  }

  /**
   * Process a job based on its type
   */
  private async processJob(job: Job<JobData, JobResult>): Promise<JobResult> {
    const { data } = job;

    try {
      switch (data.type) {
        case "preview:generate":
          return await this.processPreviewGenerate(data);

        case "ai:extract-metadata":
          return await this.processAIExtractMetadata(data);

        case "design:publish":
          return await this.processDesignPublish(data);

        case "design:unpublish":
          return await this.processDesignUnpublish(data);

        case "webhook:deliver":
          return await this.processWebhookDeliver(data);

        case "import:process-item":
          return await this.processImportItem(data);

        case "import:start-scheduled":
          return await this.processScheduledImportStart(data);

        default:
          return { success: false, error: `Unknown job type: ${(data as JobData).type}` };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error(`[JobQueue] Error processing ${data.type}:`, message);
      throw error; // Re-throw to trigger retry
    }
  }

  // ===========================================================================
  // Job Processors
  // ===========================================================================

  private async processPreviewGenerate(job: PreviewGenerateJob): Promise<JobResult> {
    const { generatePreview } = await import("@/lib/preview-generator");
    const { createServiceClient } = await import("@/lib/supabase/server");

    const supabase = createServiceClient();

    // Download file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("designs")
      .download(job.storagePath);

    if (downloadError || !fileData) {
      return { success: false, error: `Failed to download file: ${downloadError?.message}` };
    }

    const buffer = Buffer.from(await fileData.arrayBuffer());
    const result = await generatePreview(buffer, job.fileType, job.storagePath);

    if (!result.success || !result.buffer) {
      return { success: false, error: result.error || "Preview generation failed" };
    }

    // Upload preview
    const previewPath = `previews/${job.designId}/${job.fileId}.png`;
    const { error: uploadError } = await supabase.storage
      .from("previews")
      .upload(previewPath, result.buffer, {
        contentType: "image/png",
        upsert: true,
      });

    if (uploadError) {
      return { success: false, error: `Failed to upload preview: ${uploadError.message}` };
    }

    // Update design with preview path
    const { data: publicUrl } = supabase.storage.from("previews").getPublicUrl(previewPath);

    await supabase
      .from("designs")
      .update({ preview_path: publicUrl.publicUrl })
      .eq("id", job.designId);

    return {
      success: true,
      message: "Preview generated successfully",
      data: { previewPath: publicUrl.publicUrl, phash: result.phash },
    };
  }

  private async processAIExtractMetadata(job: AIExtractMetadataJob): Promise<JobResult> {
    const { extractAIMetadata } = await import("@/lib/ai-metadata");
    const { createServiceClient } = await import("@/lib/supabase/server");

    const supabase = createServiceClient();

    // Download file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("designs")
      .download(job.storagePath);

    if (downloadError || !fileData) {
      return { success: false, error: `Failed to download file: ${downloadError?.message}` };
    }

    const buffer = Buffer.from(await fileData.arrayBuffer());
    const metadata = await extractAIMetadata(buffer, job.storagePath, "application/octet-stream");

    // Update design with metadata
    await supabase
      .from("designs")
      .update({
        title: metadata.title,
        description: metadata.description,
        project_type: metadata.project_type,
        difficulty: metadata.difficulty,
        categories: metadata.categories,
        style: metadata.style,
        approx_dimensions: metadata.approx_dimensions,
      })
      .eq("id", job.designId);

    return {
      success: true,
      message: "AI metadata extracted successfully",
      data: { metadata },
    };
  }

  private async processDesignPublish(job: DesignPublishJob): Promise<JobResult> {
    const { createServiceClient } = await import("@/lib/supabase/server");
    const supabase = createServiceClient();

    const { error } = await supabase
      .from("designs")
      .update({ is_public: true })
      .eq("id", job.designId);

    if (error) {
      return { success: false, error: `Failed to publish design: ${error.message}` };
    }

    return { success: true, message: "Design published successfully" };
  }

  private async processDesignUnpublish(job: DesignUnpublishJob): Promise<JobResult> {
    const { createServiceClient } = await import("@/lib/supabase/server");
    const supabase = createServiceClient();

    const { error } = await supabase
      .from("designs")
      .update({ is_public: false })
      .eq("id", job.designId);

    if (error) {
      return { success: false, error: `Failed to unpublish design: ${error.message}` };
    }

    return { success: true, message: "Design unpublished successfully" };
  }

  private async processWebhookDeliver(job: WebhookDeliverJob): Promise<JobResult> {
    const { createServiceClient } = await import("@/lib/supabase/server");
    const crypto = await import("crypto");

    const supabase = createServiceClient();

    // Get webhook configuration
    const { data: webhook, error: webhookError } = await supabase
      .from("webhooks")
      .select("*")
      .eq("id", job.webhookId)
      .single();

    if (webhookError || !webhook) {
      return { success: false, error: "Webhook not found" };
    }

    // Create signature
    const payload = JSON.stringify(job.payload);
    const signature = crypto
      .createHmac("sha256", webhook.secret)
      .update(payload)
      .digest("hex");

    // Deliver webhook
    const startTime = Date.now();
    try {
      const response = await fetch(webhook.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Signature": `sha256=${signature}`,
          "X-Webhook-Event": job.event,
          ...(webhook.headers || {}),
        },
        body: payload,
        signal: AbortSignal.timeout(webhook.timeout_ms || 30000),
      });

      const duration = Date.now() - startTime;

      // Record delivery
      await supabase.from("webhook_deliveries").insert({
        webhook_id: job.webhookId,
        event: job.event,
        payload: job.payload,
        response_status: response.status,
        response_body: await response.text().catch(() => null),
        duration_ms: duration,
        success: response.ok,
      });

      // Update webhook last triggered
      await supabase
        .from("webhooks")
        .update({
          last_triggered_at: new Date().toISOString(),
          last_status: response.status,
          last_error: response.ok ? null : `HTTP ${response.status}`,
        })
        .eq("id", job.webhookId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return { success: true, message: "Webhook delivered successfully" };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";

      // Record failed delivery
      await supabase.from("webhook_deliveries").insert({
        webhook_id: job.webhookId,
        event: job.event,
        payload: job.payload,
        response_status: 0,
        error_message: message,
        duration_ms: Date.now() - startTime,
        success: false,
      });

      await supabase
        .from("webhooks")
        .update({
          last_triggered_at: new Date().toISOString(),
          last_status: 0,
          last_error: message,
        })
        .eq("id", job.webhookId);

      throw error; // Re-throw to trigger retry
    }
  }

  private async processImportItem(job: ImportProcessItemJob): Promise<JobResult> {
    // Import processing is handled by the existing job processor
    // This is a placeholder for when we migrate to full async processing
    return {
      success: true,
      message: "Import item processed (delegated to import processor)",
      data: { jobId: job.jobId, itemId: job.itemId },
    };
  }

  private async processScheduledImportStart(job: ImportStartScheduledJob): Promise<JobResult> {
    const { startJobProcessing } = await import("@/lib/import/job-processor");
    const { getImportJob } = await import("@/lib/services/import-job-service");
    const { clearImportSchedule } = await import("@/lib/services/scheduled-import-service");
    const { DEFAULT_PROCESSING_OPTIONS } = await import("@/lib/types/import");

    const importJob = await getImportJob(job.jobId);
    if (!importJob) {
      return { success: false, error: "Import job not found" };
    }

    if (importJob.status !== "pending") {
      return {
        success: false,
        error: `Job is not pending (status: ${importJob.status})`,
      };
    }

    // Clear the schedule
    await clearImportSchedule(job.jobId);

    // Build processing options from job settings
    const options = {
      ...DEFAULT_PROCESSING_OPTIONS,
      generate_previews: importJob.generate_previews,
      generate_ai_metadata: importJob.generate_ai_metadata,
      detect_duplicates: importJob.detect_duplicates,
      auto_publish: importJob.auto_publish,
    };

    // Start processing
    await startJobProcessing(importJob, options);

    return { success: true, message: `Scheduled import ${job.jobId} started` };
  }

  // ===========================================================================
  // Public API
  // ===========================================================================

  /**
   * Add a job to the queue
   */
  async addJob(
    data: JobData,
    options?: { delay?: number; priority?: number; jobId?: string }
  ): Promise<{ queued: boolean; jobId?: string; error?: string }> {
    await this.init();

    if (!this.queue) {
      // Fallback: process synchronously if queue not available
      console.log(`[JobQueue] No queue available, skipping job: ${data.type}`);
      return { queued: false, error: "Queue not available (Redis not configured)" };
    }

    try {
      const job = await this.queue.add(data.type, data, {
        delay: options?.delay,
        priority: options?.priority,
        jobId: options?.jobId,
      });

      return { queued: true, jobId: job.id };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return { queued: false, error: message };
    }
  }

  /**
   * Schedule a job for a specific time
   */
  async scheduleJob(
    data: JobData,
    runAt: Date
  ): Promise<{ queued: boolean; jobId?: string; error?: string }> {
    const delay = Math.max(0, runAt.getTime() - Date.now());
    return this.addJob(data, { delay });
  }

  /**
   * Get job by ID
   */
  async getJob(jobId: string): Promise<Job<JobData, JobResult> | null> {
    await this.init();
    if (!this.queue) return null;

    try {
      const job = await this.queue.getJob(jobId);
      return job || null;
    } catch {
      return null;
    }
  }

  /**
   * Get queue statistics
   */
  async getStats(): Promise<QueueStats | null> {
    await this.init();
    if (!this.queue) return null;

    try {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        this.queue.getWaitingCount(),
        this.queue.getActiveCount(),
        this.queue.getCompletedCount(),
        this.queue.getFailedCount(),
        this.queue.getDelayedCount(),
      ]);

      return { waiting, active, completed, failed, delayed };
    } catch {
      return null;
    }
  }

  /**
   * Check if queue is available
   */
  async isAvailable(): Promise<boolean> {
    await this.init();
    return this.queue !== null;
  }

  /**
   * Gracefully shutdown the queue
   */
  async shutdown(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
    }
    if (this.queue) {
      await this.queue.close();
    }
  }
}

// Singleton instance
export const jobQueue = new JobQueueManager();

// Convenience function for adding jobs
export async function enqueueJob(
  data: JobData,
  options?: { delay?: number; priority?: number; jobId?: string }
): Promise<{ queued: boolean; jobId?: string; error?: string }> {
  return jobQueue.addJob(data, options);
}

// Convenience function for scheduling jobs
export async function scheduleJob(
  data: JobData,
  runAt: Date
): Promise<{ queued: boolean; jobId?: string; error?: string }> {
  return jobQueue.scheduleJob(data, runAt);
}
