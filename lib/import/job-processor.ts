/**
 * Job Processor
 *
 * Main orchestrator for processing import jobs with concurrent workers.
 * Handles file processing, duplicate detection, preview generation,
 * AI metadata extraction, and project bundling.
 *
 * Updated: 2025-12-26
 * AI Model: Claude Opus 4.5 (claude-opus-4-5-20251101)
 */

import { createServiceClient } from "@/lib/supabase/server";
import {
  getFileExtension,
  generateSlug,
  getMimeType,
  DESIGN_EXTENSIONS,
  IMAGE_EXTENSIONS,
} from "@/lib/file-types";
import { generatePreview, supportsPreview } from "@/lib/preview-generator";
import { extractAIMetadata, extract3DModelMetadata, type Model3DContext } from "@/lib/ai-metadata";
import {
  analyzeGeometry,
  formatDimensions,
  formatVolume,
  formatSurfaceArea,
  estimateMaterialUsage,
  getComplexityDescription,
  type Triangle,
} from "@/lib/geometry-analysis";
import { parseStlBuffer, toGenericTriangles } from "@/lib/parsers/stl-parser";
import { parseObjBuffer } from "@/lib/parsers/obj-parser";
import { parseGltfBuffer } from "@/lib/parsers/gltf-parser";
import { parse3mfBuffer } from "@/lib/parsers/3mf-parser";
import { generatePhash, findSimilarHashes } from "@/lib/phash";
import {
  generateStlMultiViewPreview,
  generateObjMultiViewPreview,
  generateGltfMultiViewPreview,
  generate3mfMultiViewPreview,
} from "@/lib/preview-generator";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";

import * as jobService from "@/lib/services/import-job-service";
import * as itemService from "@/lib/services/import-item-service";
import * as logService from "@/lib/services/import-log-service";

// Import from extracted modules
import {
  subscribeToJob,
  emitEvent,
  emitItemStep,
  emitActivity,
} from "./event-emitter";
import { loadExistingHashes, loadExistingPhashes } from "./hash-loader";

// Re-export subscribeToJob for external consumers
export { subscribeToJob } from "./event-emitter";

import type {
  ImportJob,
  ImportItem,
  ProcessingOptions,
  ProcessingProgress,
  ProcessingResult,
  ImportProcessingStep,
  ImportLogDetails,
} from "@/lib/types/import";

/**
 * Active job processors (for pause/cancel support)
 */
const activeProcessors = new Map<string, { paused: boolean; cancelled: boolean }>();

/**
 * Start processing a job
 */
export async function startJobProcessing(
  job: ImportJob,
  options: ProcessingOptions
): Promise<void> {
  const jobId = job.id;

  // Initialize processor state
  activeProcessors.set(jobId, { paused: false, cancelled: false });

  try {
    // Update job status
    await jobService.updateJobStatus(jobId, "processing");

    emitEvent(jobId, {
      type: "job:started",
      job_id: jobId,
      timestamp: new Date().toISOString(),
      data: { total_files: job.total_files, options },
    });

    // Create pending log entries for all items in the job
    // This pre-populates the log so we can see all files even before they're processed
    const logsCreated = await logService.createPendingLogsForJob(jobId);
    console.log(`[IMPORT] Created ${logsCreated} pending log entries for job ${jobId}`);

    // Load existing hashes for duplicate detection
    const existingHashes = await loadExistingHashes();
    const existingPhashes = await loadExistingPhashes();

    // Process items in batches with concurrency
    await processItemsWithConcurrency(
      jobId,
      options,
      existingHashes,
      existingPhashes
    );

    // Check final status
    const state = activeProcessors.get(jobId);
    if (state?.cancelled) {
      await jobService.updateJobStatus(jobId, "cancelled");
      emitEvent(jobId, {
        type: "job:cancelled",
        job_id: jobId,
        timestamp: new Date().toISOString(),
        data: {},
      });
    } else {
      // Get final counts
      const counts = await itemService.getItemStatusCounts(jobId);
      await jobService.updateJobProgress(jobId, {
        files_succeeded: counts.completed,
        files_failed: counts.failed,
        files_skipped: counts.skipped + counts.duplicate,
      });

      await jobService.updateJobStatus(jobId, "completed");
      emitEvent(jobId, {
        type: "job:completed",
        job_id: jobId,
        timestamp: new Date().toISOString(),
        data: { counts },
      });
    }
  } catch (error) {
    console.error(`Job ${jobId} failed:`, error);
    await jobService.setJobError(
      jobId,
      error instanceof Error ? error.message : "Unknown error"
    );
    emitEvent(jobId, {
      type: "job:failed",
      job_id: jobId,
      timestamp: new Date().toISOString(),
      data: { error: error instanceof Error ? error.message : "Unknown error" },
    });
  } finally {
    activeProcessors.delete(jobId);
  }
}

/**
 * Pause a running job
 */
export function pauseJob(jobId: string): void {
  const state = activeProcessors.get(jobId);
  if (state) {
    state.paused = true;
  }
}

/**
 * Resume a paused job
 */
export function resumeJob(jobId: string): void {
  const state = activeProcessors.get(jobId);
  if (state) {
    state.paused = false;
  }
}

/**
 * Cancel a running job
 */
export function cancelJob(jobId: string): void {
  const state = activeProcessors.get(jobId);
  if (state) {
    state.cancelled = true;
    state.paused = false;
  }
}

/**
 * Process items with concurrency control
 * Processes items by project to bundle related files together
 */
async function processItemsWithConcurrency(
  jobId: string,
  options: ProcessingOptions,
  existingHashes: Map<string, string>,
  existingPhashes: Map<string, { design_id: string; title: string }>
): Promise<void> {
  const concurrency = options.concurrency || 5;
  let processedCount = 0;
  let checkpointCount = 0;

  while (true) {
    const state = activeProcessors.get(jobId);
    if (state?.cancelled) break;

    // Wait if paused
    while (state?.paused && !state?.cancelled) {
      await sleep(1000);
    }

    // Get pending items grouped by project
    const itemsByProject = await itemService.getPendingItemsByProject(jobId, concurrency * 3);

    if (itemsByProject.size === 0) {
      // Check for failed items to retry
      const failedItems = await itemService.getFailedItems(jobId, 3);
      if (failedItems.length === 0) break;

      // Process failed items
      for (const item of failedItems) {
        if (state?.cancelled) break;
        await itemService.resetItemForRetry(item.id);
      }
      continue;
    }

    // Process projects/items
    const projectsToProcess: Array<{ projectId: string | null; items: ImportItem[] }> = [];

    for (const [projectId, items] of itemsByProject) {
      if (projectId) {
        // For items with a project, get ALL pending items for that project
        const allProjectItems = await itemService.getPendingItemsForProject(jobId, projectId);
        if (allProjectItems.length > 0) {
          projectsToProcess.push({ projectId, items: allProjectItems });
        }
      } else {
        // Items without a project are processed individually
        for (const item of items) {
          projectsToProcess.push({ projectId: null, items: [item] });
        }
      }

      // Limit batch size
      if (projectsToProcess.length >= concurrency) break;
    }

    if (projectsToProcess.length === 0) continue;

    // Process batch concurrently
    const results = await Promise.allSettled(
      projectsToProcess.map((proj) => {
        if (proj.projectId && proj.items.length > 1) {
          // Process as a bundled project
          return processProjectBundle(proj.items, options, existingHashes, existingPhashes);
        } else {
          // Process as individual item
          return processItem(proj.items[0], options, existingHashes, existingPhashes);
        }
      })
    );

    // Count items processed
    let itemsInBatch = 0;
    for (const proj of projectsToProcess) {
      itemsInBatch += proj.items.length;
    }

    // Update counts
    processedCount += itemsInBatch;
    checkpointCount += itemsInBatch;

    // Get current counts and update with batch results
    const currentCounts = await itemService.getItemStatusCounts(jobId);

    // Update database with latest counts
    await jobService.updateJobProgress(jobId, {
      files_processed: processedCount,
      files_succeeded: currentCounts.completed,
      files_failed: currentCounts.failed,
      files_skipped: currentCounts.skipped + currentCounts.duplicate,
    });

    // Emit progress update
    const job = await jobService.getImportJob(jobId);
    if (job) {
      const progress: ProcessingProgress = {
        job_id: jobId,
        status: job.status,
        files_processed: processedCount,
        files_succeeded: job.files_succeeded,
        files_failed: job.files_failed,
        files_skipped: job.files_skipped,
        total_files: job.total_files,
        progress_percentage: Math.round((processedCount / job.total_files) * 100),
        current_file: projectsToProcess[0]?.items[0]?.filename,
      };

      emitEvent(jobId, {
        type: "progress:update",
        job_id: jobId,
        timestamp: new Date().toISOString(),
        data: progress as unknown as Record<string, unknown>,
      });
    }

    // Checkpoint save
    if (checkpointCount >= options.checkpoint_interval) {
      emitEvent(jobId, {
        type: "checkpoint:saved",
        job_id: jobId,
        timestamp: new Date().toISOString(),
        data: { processed: processedCount },
      });
      checkpointCount = 0;
    }
  }
}

/**
 * Process a bundle of items that belong to the same project
 * Creates one design and adds all files as design_files
 *
 * Key behavior:
 * - Design files (STL, SVG, etc.) are prioritized as the "primary" file for metadata extraction
 * - Image files (JPG, PNG) are used as preview source when available (better visual quality)
 */
async function processProjectBundle(
  items: ImportItem[],
  options: ProcessingOptions,
  existingHashes: Map<string, string>,
  existingPhashes: Map<string, { design_id: string; title: string }>
): Promise<ProcessingResult> {
  const startTime = Date.now();

  // Sort items so design files come first (for metadata extraction), images come later
  // Design files (STL, SVG, etc.) should be primary, not preview images
  const sortedItems = sortByDesignFilePriority(items, options.preview_type_priority);

  // Find the primary item - prefer actual design files over image-only files
  const primaryItem = sortedItems[0];
  const otherItems = sortedItems.slice(1);

  // Find the best preview source from the bundle (prefer images over auto-generated)
  // Sort by preview_type_priority to find the best image source
  const previewSourceItem = findBestPreviewSource(items, options.preview_type_priority);

  try {
    // Mark all items as processing
    await Promise.all(items.map((i) => itemService.markItemProcessing(i.id)));

    // Process primary item first to create the design
    const primaryResult = await processItem(primaryItem, options, existingHashes, existingPhashes);

    if (!primaryResult.success || !primaryResult.design_id) {
      // Check if primary was a duplicate - if so, try to add variants to the existing design
      if (primaryResult.is_duplicate && primaryResult.duplicate_of) {
        // Primary was a near-duplicate of an existing design
        // Try to add variant files to that existing design instead
        for (const item of otherItems) {
          try {
            const fileResult = await addFileToExistingDesign(
              item,
              primaryResult.duplicate_of,
              options,
              existingHashes
            );

            if (fileResult.success) {
              await itemService.markItemCompleted(item.id, {
                design_id: primaryResult.duplicate_of,
                design_file_id: fileResult.design_file_id,
                preview_generated: false,
                ai_metadata_generated: false,
              });
            } else if (fileResult.error === "Duplicate file") {
              // Variant was also a duplicate - mark it as such
              await itemService.markItemDuplicate(item.id, primaryResult.duplicate_of, primaryResult.near_duplicate_similarity || 100);
            } else {
              // Failed to add for other reason - mark as duplicate since primary was
              await itemService.markItemDuplicate(item.id, primaryResult.duplicate_of, primaryResult.near_duplicate_similarity || 100);
            }
          } catch (err) {
            // On error, log and mark as duplicate since primary was duplicate
            console.error(`Error adding variant ${item.filename} to existing design:`, err);
            await itemService.markItemDuplicate(item.id, primaryResult.duplicate_of, primaryResult.near_duplicate_similarity || 100);
          }
        }
        return primaryResult;
      }

      // Primary genuinely failed (not a duplicate) - mark variants as failed too
      const failReason = primaryResult.error || (primaryResult.is_duplicate ? "Primary was duplicate" : "Unknown");
      for (const item of otherItems) {
        await itemService.markItemFailed(item.id, `Primary file failed: ${failReason}`);
      }
      return primaryResult;
    }

    // Process other items and add them to the same design
    for (const item of otherItems) {
      try {
        const fileResult = await addFileToExistingDesign(
          item,
          primaryResult.design_id,
          options,
          existingHashes
        );

        if (fileResult.success) {
          await itemService.markItemCompleted(item.id, {
            design_id: primaryResult.design_id,
            design_file_id: fileResult.design_file_id,
            preview_generated: false,
            ai_metadata_generated: false,
          });
        } else {
          await itemService.markItemFailed(item.id, fileResult.error || "Failed to add file");
        }
      } catch (err) {
        await itemService.markItemFailed(
          item.id,
          err instanceof Error ? err.message : "Unknown error"
        );
      }
    }

    // If we have a better preview source (image file) than the primary's auto-generated preview,
    // update the design's preview_path with the image
    if (previewSourceItem && previewSourceItem.id !== primaryItem.id) {
      await updateDesignPreviewFromImage(primaryResult.design_id, previewSourceItem);
    }

    return primaryResult;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    // Mark all items as failed
    for (const item of items) {
      await itemService.markItemFailed(item.id, errorMessage);
    }

    return {
      item_id: primaryItem.id,
      success: false,
      error: errorMessage,
      processing_time_ms: Date.now() - startTime,
    };
  }
}

/**
 * Add a file to an existing design (for bundled projects)
 */
async function addFileToExistingDesign(
  item: ImportItem,
  designId: string,
  options: ProcessingOptions,
  existingHashes: Map<string, string>
): Promise<{ success: boolean; design_file_id?: string; error?: string }> {
  const supabase = createServiceClient();

  try {
    // Read file
    const buffer = await fs.readFile(item.source_path);

    // Compute hash for duplicate detection
    const contentHash = crypto.createHash("sha256").update(buffer).digest("hex");

    // Check for exact duplicate
    const existingDesignId = existingHashes.get(contentHash);
    if (options.detect_duplicates && existingDesignId) {
      await itemService.markItemDuplicate(item.id, existingDesignId, 100);
      return { success: false, error: "Duplicate file" };
    }

    // Update item with hash
    await itemService.updateItemHash(item.id, contentHash);

    const fileExt = getFileExtension(item.filename).toLowerCase();
    const baseName = item.filename.replace(/\.[^/.]+$/, "");

    // Get the next sort order for this design
    const { data: existingFiles } = await supabase
      .from("design_files")
      .select("sort_order")
      .eq("design_id", designId)
      .order("sort_order", { ascending: false })
      .limit(1);

    const nextSortOrder = (existingFiles?.[0]?.sort_order ?? -1) + 1;

    // Upload file to storage
    const storagePath = `files/${designId}/v1-${nextSortOrder}${fileExt}`;
    const { error: uploadError } = await supabase.storage
      .from("designs")
      .upload(storagePath, buffer, {
        contentType: getMimeType(fileExt),
        upsert: true, // Allow overwriting files from failed/retried imports
      });

    if (uploadError) {
      throw new Error(`Failed to upload file: ${uploadError.message}`);
    }

    // Create design_files record
    const { data: designFile, error: fileError } = await supabase
      .from("design_files")
      .insert({
        design_id: designId,
        storage_path: storagePath,
        file_type: fileExt.slice(1),
        size_bytes: buffer.length,
        content_hash: contentHash,
        version_number: 1,
        is_active: true,
        file_role: item.project_role || "variant",
        original_filename: item.filename,
        display_name: baseName,
        sort_order: nextSortOrder,
      })
      .select()
      .single();

    if (fileError || !designFile) {
      throw new Error(`Failed to create file record: ${fileError?.message}`);
    }

    // Add to existing hashes
    existingHashes.set(contentHash, designId);

    return { success: true, design_file_id: designFile.id };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Process a single import item
 */
async function processItem(
  item: ImportItem,
  options: ProcessingOptions,
  existingHashes: Map<string, string>,
  existingPhashes: Map<string, { design_id: string; title: string }>
): Promise<ProcessingResult> {
  const startTime = Date.now();
  const stepsCompleted: ImportProcessingStep[] = [];
  const logDetails: ImportLogDetails = {};

  // Get or create log entry for this item
  let log = await logService.getLogByItemId(item.id);
  if (log) {
    // Mark log as processing
    await logService.markLogProcessing(log.id);
  }

  try {
    // Mark as processing
    await itemService.markItemProcessing(item.id);

    // Emit item started event
    emitEvent(item.job_id, {
      type: "item:started",
      job_id: item.job_id,
      timestamp: new Date().toISOString(),
      data: { filename: item.filename, item_id: item.id },
    });

    // Read file
    emitItemStep(item.job_id, item.filename, "reading");
    let buffer: Buffer;
    try {
      buffer = await fs.readFile(item.source_path);
      stepsCompleted.push("file_read");
    } catch (err) {
      const errorMsg = `Failed to read file: ${err instanceof Error ? err.message : "Unknown"}`;
      logDetails.fail_reason = "file_read_error";
      logDetails.fail_step = "file_read";
      logDetails.error_stack = err instanceof Error ? err.stack : undefined;

      if (log) {
        await logService.markLogFailed(log.id, {
          reason: errorMsg,
          steps_completed: stepsCompleted,
          details: logDetails,
        });
      }
      throw new Error(errorMsg);
    }

    // Compute hash for duplicate detection
    emitItemStep(item.job_id, item.filename, "hash");
    const contentHash = crypto.createHash("sha256").update(buffer).digest("hex");
    stepsCompleted.push("hash_computed");
    logDetails.duplicate_hash = contentHash;

    // Check for exact duplicate
    const existingDesignId = existingHashes.get(contentHash);
    if (options.detect_duplicates && existingDesignId) {
      stepsCompleted.push("duplicate_check");
      await itemService.markItemDuplicate(item.id, existingDesignId, 100);

      // Update log as duplicate
      if (log) {
        await logService.markLogDuplicate(log.id, {
          duplicate_of_design_id: existingDesignId,
          duplicate_type: "exact",
          duplicate_similarity: 100,
          reason: "Exact duplicate (identical file hash)",
          details: {
            ...logDetails,
            skip_reason: "exact_duplicate",
            duplicate_hash: contentHash,
          },
        });
      }

      return {
        item_id: item.id,
        success: false,
        is_duplicate: true,
        duplicate_of: existingDesignId,
        processing_time_ms: Date.now() - startTime,
      };
    }

    stepsCompleted.push("duplicate_check");

    // Update item with hash
    await itemService.updateItemHash(item.id, contentHash);

    const fileExt = getFileExtension(item.filename).toLowerCase();
    const baseName = item.filename.replace(/\.[^/.]+$/, "");

    // Generate preview
    // Also generate for AI metadata extraction (OpenAI Vision requires actual image data)
    let previewBuffer: Buffer | undefined;
    let previewPhash: string | undefined;
    const isImageFile = [".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(fileExt);
    const needsPreviewForAI = options.generate_ai_metadata && !isImageFile && supportsPreview(fileExt);

    if ((options.generate_previews || needsPreviewForAI) && supportsPreview(fileExt)) {
      try {
        emitItemStep(item.job_id, item.filename, "preview");
        const previewResult = await generatePreview(buffer, fileExt, item.filename);
        if (previewResult.success && previewResult.buffer) {
          previewBuffer = previewResult.buffer;
          previewPhash = previewResult.phash;
          stepsCompleted.push("preview_generated");
          logDetails.preview_format = "png";
          logDetails.preview_size_bytes = previewBuffer.length;
          logDetails.duplicate_phash = previewPhash;

          // Check for near-duplicates using phash (unless exact_duplicates_only is enabled)
          if (options.detect_duplicates && !options.exact_duplicates_only && previewPhash) {
            const hashList = Array.from(existingPhashes.entries()).map(([hash, info]) => ({
              id: info.design_id,
              hash,
            }));

            // Convert percentage threshold to Hamming distance (64 bits total)
            // threshold% similarity = (100-threshold)% bits different = (100-threshold) * 64 / 100 max distance
            const threshold = options.near_duplicate_threshold ?? 85;
            const maxHammingDistance = Math.floor((100 - threshold) * 64 / 100);

            const similar = findSimilarHashes(previewPhash, hashList, maxHammingDistance);

            if (similar.length > 0) {
              const match = similar[0];
              const duplicateTitle = existingPhashes.get(match.hash)?.title || "Unknown";
              await itemService.markItemDuplicate(item.id, match.id, match.similarity);

              // Update log as near-duplicate
              if (log) {
                await logService.markLogDuplicate(log.id, {
                  duplicate_of_design_id: match.id,
                  duplicate_type: "near",
                  duplicate_similarity: match.similarity,
                  reason: `Near-duplicate (${match.similarity.toFixed(1)}% similar to "${duplicateTitle}")`,
                  details: {
                    ...logDetails,
                    skip_reason: "near_duplicate",
                    duplicate_phash: previewPhash,
                    duplicate_title: duplicateTitle,
                  },
                });
              }

              return {
                item_id: item.id,
                success: false,
                is_duplicate: true,
                duplicate_of: match.id,
                near_duplicate_similarity: match.similarity,
                processing_time_ms: Date.now() - startTime,
              };
            }
          }
        }
      } catch (err) {
        console.error(`Preview generation failed for ${item.filename}:`, err);
        logDetails.error_code = "preview_generation_error";
        // Don't fail the whole import just because preview failed - continue processing
      }
    }

    // Generate title
    let title = baseName
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());

    // AI metadata extraction
    let description = "";
    let projectType: string | null = null;
    let difficulty: string | null = null;
    let categories: string[] = [];
    let style: string | null = null;
    let approxDimensions: string | null = null;
    let tags: string[] = [];
    let aiMetadataActuallyGenerated = false;

    if (options.generate_ai_metadata) {
      emitItemStep(item.job_id, item.filename, "ai_metadata");
      console.log(`[IMPORT] Starting AI metadata extraction for ${item.filename}`);
      try {
        const is3DFile = [".stl", ".obj", ".gltf", ".glb", ".3mf"].includes(fileExt);

        if (is3DFile) {
          // Parallelize geometry parsing and multi-view generation for 3D files
          // This provides significant speedup as both are CPU-intensive

          // Define async functions for parallel execution
          const parseGeometry = async (): Promise<Triangle[]> => {
            try {
              if (fileExt === ".stl") {
                const stlResult = parseStlBuffer(buffer);
                return toGenericTriangles(stlResult.triangles);
              } else if (fileExt === ".obj") {
                const objResult = parseObjBuffer(buffer);
                return objResult.triangles;
              } else if (fileExt === ".gltf" || fileExt === ".glb") {
                const gltfResult = await parseGltfBuffer(buffer, fileExt === ".glb");
                return gltfResult.triangles;
              } else if (fileExt === ".3mf") {
                const result3mf = await parse3mfBuffer(buffer);
                return result3mf.triangles;
              }
            } catch (parseError) {
              console.error(`Failed to parse ${fileExt} for geometry:`, parseError);
            }
            return [];
          };

          const generateMultiView = async (): Promise<Buffer> => {
            try {
              if (fileExt === ".stl") {
                const multiView = await generateStlMultiViewPreview(buffer);
                if (multiView.success && multiView.buffer) return multiView.buffer;
              } else if (fileExt === ".obj") {
                const multiView = await generateObjMultiViewPreview(buffer);
                if (multiView.success && multiView.buffer) return multiView.buffer;
              } else if (fileExt === ".gltf" || fileExt === ".glb") {
                const multiView = await generateGltfMultiViewPreview(buffer, fileExt.slice(1));
                if (multiView.success && multiView.buffer) return multiView.buffer;
              } else if (fileExt === ".3mf") {
                const multiView = await generate3mfMultiViewPreview(buffer);
                if (multiView.success && multiView.buffer) return multiView.buffer;
              }
            } catch (multiViewError) {
              console.error(`Failed to generate multi-view for ${fileExt}:`, multiViewError);
            }
            return previewBuffer || buffer;
          };

          // Run geometry parsing and multi-view generation in parallel
          const [triangles, aiImageBuffer] = await Promise.all([
            parseGeometry(),
            generateMultiView(),
          ]);

          const geometryMetrics = analyzeGeometry(triangles);
          const materialEstimate = estimateMaterialUsage(
            geometryMetrics.volumeEstimate,
            geometryMetrics.detectedUnit
          );

          const model3DContext: Model3DContext = {
            filename: item.filename,
            dimensions: formatDimensions(geometryMetrics),
            triangleCount: geometryMetrics.triangleCount,
            vertexCount: geometryMetrics.vertexCount,
            volumeEstimate: formatVolume(geometryMetrics.volumeEstimate, geometryMetrics.detectedUnit),
            surfaceArea: formatSurfaceArea(geometryMetrics.surfaceArea, geometryMetrics.detectedUnit),
            complexity: getComplexityDescription(geometryMetrics),
            detectedUnit: `${geometryMetrics.detectedUnit}`,
            aspectRatio: geometryMetrics.aspectRatio,
            materialEstimate: `~${materialEstimate.grams}g at 20% infill`,
          };

          console.log(`[IMPORT] Calling AI for 3D model: ${item.filename}`);
          const aiMetadata = await extract3DModelMetadata(aiImageBuffer, model3DContext);

          // Check if AI actually generated useful metadata (not just basic fallback)
          const hasAiContent = aiMetadata.description || aiMetadata.tags.length > 0;
          if (hasAiContent) {
            aiMetadataActuallyGenerated = true;
            console.log(`[IMPORT] AI SUCCESS for 3D: ${item.filename} - title: "${aiMetadata.title}", tags: ${aiMetadata.tags.length}`);
          } else {
            console.log(`[IMPORT] AI returned basic metadata for 3D: ${item.filename} (no API key or API error)`);
          }

          title = aiMetadata.title || title;
          description = aiMetadata.description || "";
          projectType = aiMetadata.project_type;
          difficulty = aiMetadata.difficulty;
          categories = aiMetadata.categories;
          style = aiMetadata.style;
          approxDimensions = model3DContext.dimensions;
          tags = aiMetadata.tags || [];

          if (aiMetadataActuallyGenerated) {
            stepsCompleted.push("ai_metadata_generated");
          }
        } else {
          // For 2D files, we need a proper image for AI Vision
          // If no preview exists and file isn't an image, AI can't analyze it properly
          if (!previewBuffer && !isImageFile) {
            console.log(`[IMPORT] AI skipped for ${item.filename}: no preview available for non-image file`);
          } else {
            const aiImageBuffer = previewBuffer || buffer;
            const mimeType = previewBuffer ? "image/png" : getMimeType(fileExt);
            console.log(`[IMPORT] Calling AI for 2D file: ${item.filename}`);
            const aiMetadata = await extractAIMetadata(aiImageBuffer, item.filename, mimeType);

            // Check if AI actually generated useful metadata
            const hasAiContent = aiMetadata.description || aiMetadata.tags.length > 0;
            if (hasAiContent) {
              aiMetadataActuallyGenerated = true;
              console.log(`[IMPORT] AI SUCCESS for 2D: ${item.filename} - title: "${aiMetadata.title}", tags: ${aiMetadata.tags.length}`);
            } else {
              console.log(`[IMPORT] AI returned basic metadata for 2D: ${item.filename} (no API key or API error)`);
            }

            title = aiMetadata.title || title;
            description = aiMetadata.description || "";
            projectType = aiMetadata.project_type;
            difficulty = aiMetadata.difficulty;
            categories = aiMetadata.categories;
            style = aiMetadata.style;
            approxDimensions = aiMetadata.approx_dimensions;
            tags = aiMetadata.tags || [];

            if (aiMetadataActuallyGenerated) {
              stepsCompleted.push("ai_metadata_generated");
            }
          }
        }
      } catch (aiError) {
        const errorMsg = aiError instanceof Error ? aiError.message : String(aiError);
        console.error(`[IMPORT] AI metadata extraction FAILED for ${item.filename}: ${errorMsg}`);
        logDetails.error_code = "ai_metadata_error";
        // Don't fail import just because AI failed - continue with basic metadata
      }
    } else {
      console.log(`[IMPORT] AI metadata generation not requested for ${item.filename}`);
    }

    // Create design record with unique slug handling
    const supabase = createServiceClient();

    // Generate base slug and add unique suffix using content hash to avoid race conditions
    const baseSlug = generateSlug(title);
    const uniqueSuffix = contentHash.slice(0, 8);
    let slug = `${baseSlug}-${uniqueSuffix}`;

    // Check if slug exists and add timestamp if needed
    const { data: existingSlug } = await supabase
      .from("designs")
      .select("slug")
      .eq("slug", slug)
      .single();

    if (existingSlug) {
      slug = `${baseSlug}-${uniqueSuffix}-${Date.now().toString(36)}`;
    }

    // Try to insert, with retry on duplicate key (handles concurrent inserts)
    let design;
    let designError;
    let retries = 0;
    const maxRetries = 3;

    while (retries < maxRetries) {
      const result = await supabase
        .from("designs")
        .insert({
          slug,
          title,
          description,
          preview_path: "",
          is_public: options.auto_publish,
          project_type: projectType,
          difficulty,
          categories,
          style,
          approx_dimensions: approxDimensions,
          import_job_id: item.job_id,
          import_source_path: item.source_path,
        })
        .select()
        .single();

      if (result.error?.code === "23505") {
        // Duplicate key error - generate new unique slug and retry
        retries++;
        slug = `${baseSlug}-${uniqueSuffix}-${Date.now().toString(36)}-${retries}`;
        continue;
      }

      design = result.data;
      designError = result.error;
      break;
    }

    if (designError || !design) {
      logDetails.fail_reason = "database_error";
      logDetails.fail_step = "design_created";
      logDetails.error_code = designError?.code;

      if (log) {
        await logService.markLogFailed(log.id, {
          reason: `Failed to create design: ${designError?.message}`,
          steps_completed: stepsCompleted,
          details: logDetails,
        });
      }
      throw new Error(`Failed to create design: ${designError?.message}`);
    }

    stepsCompleted.push("design_created");

    // Upload file to storage
    emitItemStep(item.job_id, item.filename, "uploading");
    const storagePath = `files/${design.id}/v1${fileExt}`;
    const { error: uploadError } = await supabase.storage
      .from("designs")
      .upload(storagePath, buffer, {
        contentType: getMimeType(fileExt),
        upsert: true, // Allow overwriting files from failed/retried imports
      });

    if (uploadError) {
      await supabase.from("designs").delete().eq("id", design.id);
      logDetails.fail_reason = "storage_upload_error";
      logDetails.fail_step = "storage_uploaded";
      logDetails.error_code = uploadError.message;

      if (log) {
        await logService.markLogFailed(log.id, {
          reason: `Failed to upload file: ${uploadError.message}`,
          steps_completed: stepsCompleted,
          details: logDetails,
        });
      }
      throw new Error(`Failed to upload file: ${uploadError.message}`);
    }

    stepsCompleted.push("storage_uploaded");

    // Upload preview
    let previewPath = "";
    if (previewBuffer) {
      const timestamp = Date.now().toString(36);
      const previewFilename = `${slug}-${contentHash.slice(0, 8)}-${timestamp}.png`;

      const { error: previewUploadError } = await supabase.storage
        .from("previews")
        .upload(previewFilename, previewBuffer, {
          contentType: "image/png",
          upsert: true,
        });

      if (!previewUploadError) {
        const { data: publicUrl } = supabase.storage
          .from("previews")
          .getPublicUrl(previewFilename);
        previewPath = publicUrl.publicUrl;
      }
    }

    // Create design_files record
    emitItemStep(item.job_id, item.filename, "saving");
    const { data: designFile, error: fileError } = await supabase
      .from("design_files")
      .insert({
        design_id: design.id,
        storage_path: storagePath,
        file_type: fileExt.slice(1),
        size_bytes: buffer.length,
        content_hash: contentHash,
        preview_phash: previewPhash || null,
        version_number: 1,
        is_active: true,
        file_role: item.project_role || "primary",
        original_filename: item.filename,
        display_name: baseName,
        sort_order: 0,
      })
      .select()
      .single();

    if (fileError) {
      logDetails.fail_reason = "database_error";
      logDetails.fail_step = "design_file_created";
      logDetails.error_code = fileError.code;

      if (log) {
        await logService.markLogFailed(log.id, {
          reason: `Failed to create file record: ${fileError.message}`,
          steps_completed: stepsCompleted,
          details: logDetails,
        });
      }
      throw new Error(`Failed to create file record: ${fileError.message}`);
    }

    stepsCompleted.push("design_file_created");

    // Update design with references
    await supabase
      .from("designs")
      .update({
        current_version_id: designFile.id,
        primary_file_id: designFile.id,
        preview_path: previewPath || `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/previews/placeholder.png`,
      })
      .eq("id", design.id);

    // Save tags
    if (tags.length > 0) {
      for (const tagName of tags) {
        const normalizedTag = tagName.toLowerCase().trim();
        if (!normalizedTag) continue;

        let tagId: string;
        const { data: existingTag } = await supabase
          .from("tags")
          .select("id")
          .eq("name", normalizedTag)
          .single();

        if (existingTag) {
          tagId = existingTag.id;
        } else {
          const { data: newTag, error: tagError } = await supabase
            .from("tags")
            .insert({ name: normalizedTag })
            .select("id")
            .single();

          if (tagError || !newTag) continue;
          tagId = newTag.id;
        }

        await supabase
          .from("design_tags")
          .insert({ design_id: design.id, tag_id: tagId });
      }
    }

    // Mark item as completed
    console.log(`[IMPORT] Completed ${item.filename}: design_id=${design.id}, preview=${!!previewBuffer}, ai_requested=${options.generate_ai_metadata}, ai_generated=${aiMetadataActuallyGenerated}`);
    await itemService.markItemCompleted(item.id, {
      design_id: design.id,
      design_file_id: designFile.id,
      preview_generated: !!previewBuffer,
      ai_metadata_generated: aiMetadataActuallyGenerated,
      ai_metadata_requested: options.generate_ai_metadata,
    });

    // Add to existing hashes for future duplicate detection
    existingHashes.set(contentHash, design.id);
    if (previewPhash) {
      existingPhashes.set(previewPhash, { design_id: design.id, title });
    }

    // Mark log as succeeded
    if (log) {
      await logService.markLogSucceeded(log.id, {
        design_id: design.id,
        design_file_id: designFile.id,
        steps_completed: stepsCompleted,
        details: {
          ...logDetails,
          preview_format: previewBuffer ? "png" : undefined,
          preview_size_bytes: previewBuffer?.length,
        },
      });
    }

    return {
      item_id: item.id,
      success: true,
      design_id: design.id,
      design_file_id: designFile.id,
      processing_time_ms: Date.now() - startTime,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    await itemService.markItemFailed(item.id, errorMessage);

    // Mark log as failed if not already marked
    if (log) {
      // Only update if we haven't already updated the log in a specific error handler
      if (!logDetails.fail_reason) {
        logDetails.fail_reason = "unknown_error";
        logDetails.error_stack = error instanceof Error ? error.stack : undefined;

        await logService.markLogFailed(log.id, {
          reason: errorMessage,
          steps_completed: stepsCompleted,
          details: logDetails,
        });
      }
    }

    return {
      item_id: item.id,
      success: false,
      error: errorMessage,
      processing_time_ms: Date.now() - startTime,
    };
  }
}

// loadExistingHashes and loadExistingPhashes are now imported from ./hash-loader

// Convert imported extension arrays (with dots) to lowercase without dots for comparison
// DESIGN_EXTENSIONS and IMAGE_EXTENSIONS are imported from @/lib/file-types
const DESIGN_FILE_EXTENSIONS_SET = new Set(
  DESIGN_EXTENSIONS.map((ext) => ext.replace(".", "").toLowerCase())
);
const IMAGE_ONLY_EXTENSIONS_SET = new Set(
  IMAGE_EXTENSIONS.map((ext) => ext.replace(".", "").toLowerCase())
);

/**
 * Sort items by design file priority for project bundles
 *
 * Priority order:
 * 1. User-configured preview_type_priority is respected first
 * 2. For types not in user's priority list, design files come before image-only files
 *
 * This allows users to prioritize images (jpg/png) over design files (stl) if desired
 */
function sortByDesignFilePriority(items: ImportItem[], previewPriority: string[]): ImportItem[] {
  return [...items].sort((a, b) => {
    const aType = a.file_type?.toLowerCase() || "";
    const bType = b.file_type?.toLowerCase() || "";

    // First, check if either type is in the user's configured priority list
    const aIndex = previewPriority.findIndex((p) => p.toLowerCase() === aType);
    const bIndex = previewPriority.findIndex((p) => p.toLowerCase() === bType);

    // If both are in the priority list, use their configured order
    if (aIndex !== -1 && bIndex !== -1) {
      return aIndex - bIndex;
    }

    // If only one is in the priority list, it comes first
    if (aIndex !== -1) return -1;
    if (bIndex !== -1) return 1;

    // Neither is in the priority list - fall back to design vs image preference
    const aIsDesign = DESIGN_FILE_EXTENSIONS_SET.has(aType);
    const bIsDesign = DESIGN_FILE_EXTENSIONS_SET.has(bType);
    const aIsImageOnly = IMAGE_ONLY_EXTENSIONS_SET.has(aType);
    const bIsImageOnly = IMAGE_ONLY_EXTENSIONS_SET.has(bType);

    if (aIsDesign && bIsImageOnly) return -1;
    if (aIsImageOnly && bIsDesign) return 1;

    return 0;
  });
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Find the best preview source from a bundle of items
 * Prefers image files (PNG, JPG) over design files that need auto-generated previews
 *
 * @param items - All items in the project bundle
 * @param previewPriority - User-configured priority list for preview sources
 * @returns The best item to use for preview, or null if no suitable image found
 */
function findBestPreviewSource(items: ImportItem[], previewPriority: string[]): ImportItem | null {
  // Only consider actual image files as better preview sources
  const imageItems = items.filter((item) => {
    const ext = item.file_type?.toLowerCase() || "";
    return IMAGE_ONLY_EXTENSIONS_SET.has(ext);
  });

  if (imageItems.length === 0) {
    return null; // No image files, use primary's auto-generated preview
  }

  // Sort by user's preview priority
  const sorted = [...imageItems].sort((a, b) => {
    const aType = a.file_type?.toLowerCase() || "";
    const bType = b.file_type?.toLowerCase() || "";

    const aIndex = previewPriority.findIndex((p) => p.toLowerCase() === aType);
    const bIndex = previewPriority.findIndex((p) => p.toLowerCase() === bType);

    // Both in priority list: use priority order
    if (aIndex !== -1 && bIndex !== -1) {
      return aIndex - bIndex;
    }
    // Only one in list: prefer the one in list
    if (aIndex !== -1) return -1;
    if (bIndex !== -1) return 1;

    return 0;
  });

  return sorted[0];
}

/**
 * Update a design's preview_path using an image file from the bundle
 * This is used when a project has both a design file (STL) and an image file (JPG)
 * to use the image as the preview instead of auto-generated 3D render
 *
 * @param designId - The design to update
 * @param imageItem - The image file item to use as preview
 */
async function updateDesignPreviewFromImage(
  designId: string,
  imageItem: ImportItem
): Promise<void> {
  const supabase = createServiceClient();

  try {
    // Read the image file
    const buffer = await fs.readFile(imageItem.source_path);
    const fileExt = getFileExtension(imageItem.filename).toLowerCase();

    // Generate a preview filename
    const timestamp = Date.now().toString(36);
    const baseName = imageItem.filename.replace(/\.[^/.]+$/, "");
    const previewFilename = `${baseName}-${timestamp}.png`;

    // For non-PNG images, we could convert to PNG for consistency
    // For now, just upload the original image
    const uploadBuffer = buffer;
    const contentType = getMimeType(fileExt);

    // Upload to previews bucket
    const { error: uploadError } = await supabase.storage
      .from("previews")
      .upload(previewFilename, uploadBuffer, {
        contentType,
        upsert: true,
      });

    if (uploadError) {
      console.error(`Failed to upload preview image from ${imageItem.filename}:`, uploadError);
      return;
    }

    // Get public URL
    const { data: publicUrl } = supabase.storage
      .from("previews")
      .getPublicUrl(previewFilename);

    // Update design's preview_path
    const { error: updateError } = await supabase
      .from("designs")
      .update({ preview_path: publicUrl.publicUrl })
      .eq("id", designId);

    if (updateError) {
      console.error(`Failed to update design preview_path:`, updateError);
    } else {
      console.log(`[IMPORT] Updated design ${designId} preview from image file: ${imageItem.filename}`);
    }
  } catch (err) {
    console.error(`Error updating design preview from image:`, err);
  }
}
