/**
 * Scheduled Publishing Service
 *
 * Handles automatic publishing and unpublishing of designs based on
 * their scheduled publish_at and unpublish_at timestamps.
 *
 * Can be called:
 * - Via cron job (external scheduler hitting /api/admin/scheduled-publishing)
 * - Via background job queue (if Redis available)
 * - Manually via admin panel
 */

import { createServiceClient } from "@/lib/supabase/server";
import { isScheduledPublishingEnabled } from "@/lib/feature-flags";
import { enqueueJob } from "@/lib/jobs";

// =============================================================================
// Types
// =============================================================================

export interface ScheduledPublishingResult {
  success: boolean;
  published: number;
  unpublished: number;
  errors: string[];
  details?: {
    publishedDesigns: string[];
    unpublishedDesigns: string[];
  };
}

export interface ScheduleDesignOptions {
  designId: string;
  publishAt?: Date | string | null;
  unpublishAt?: Date | string | null;
}

// =============================================================================
// Main Service
// =============================================================================

/**
 * Process all scheduled publishing/unpublishing
 * Called periodically to check for designs that need to be published/unpublished
 */
export async function processScheduledPublishing(): Promise<ScheduledPublishingResult> {
  const enabled = await isScheduledPublishingEnabled();
  if (!enabled) {
    return {
      success: true,
      published: 0,
      unpublished: 0,
      errors: ["Scheduled publishing feature is disabled"],
    };
  }

  const supabase = createServiceClient();
  const errors: string[] = [];
  const publishedDesigns: string[] = [];
  const unpublishedDesigns: string[] = [];

  // Get designs due for publishing
  const { data: toPublish, error: publishError } = await supabase
    .from("designs")
    .select("id, title, slug")
    .not("publish_at", "is", null)
    .lte("publish_at", new Date().toISOString())
    .eq("is_public", false);

  if (publishError) {
    errors.push(`Error fetching designs to publish: ${publishError.message}`);
  } else if (toPublish && toPublish.length > 0) {
    // Publish designs
    const { error: updateError } = await supabase
      .from("designs")
      .update({
        is_public: true,
        publish_at: null, // Clear the schedule once published
        updated_at: new Date().toISOString(),
      })
      .in(
        "id",
        toPublish.map((d) => d.id)
      );

    if (updateError) {
      errors.push(`Error publishing designs: ${updateError.message}`);
    } else {
      publishedDesigns.push(...toPublish.map((d) => d.slug || d.id));
      console.log(
        `[ScheduledPublishing] Published ${toPublish.length} design(s):`,
        toPublish.map((d) => d.title).join(", ")
      );
    }
  }

  // Get designs due for unpublishing
  const { data: toUnpublish, error: unpublishError } = await supabase
    .from("designs")
    .select("id, title, slug")
    .not("unpublish_at", "is", null)
    .lte("unpublish_at", new Date().toISOString())
    .eq("is_public", true);

  if (unpublishError) {
    errors.push(`Error fetching designs to unpublish: ${unpublishError.message}`);
  } else if (toUnpublish && toUnpublish.length > 0) {
    // Unpublish designs
    const { error: updateError } = await supabase
      .from("designs")
      .update({
        is_public: false,
        unpublish_at: null, // Clear the schedule once unpublished
        updated_at: new Date().toISOString(),
      })
      .in(
        "id",
        toUnpublish.map((d) => d.id)
      );

    if (updateError) {
      errors.push(`Error unpublishing designs: ${updateError.message}`);
    } else {
      unpublishedDesigns.push(...toUnpublish.map((d) => d.slug || d.id));
      console.log(
        `[ScheduledPublishing] Unpublished ${toUnpublish.length} design(s):`,
        toUnpublish.map((d) => d.title).join(", ")
      );
    }
  }

  return {
    success: errors.length === 0,
    published: publishedDesigns.length,
    unpublished: unpublishedDesigns.length,
    errors,
    details: {
      publishedDesigns,
      unpublishedDesigns,
    },
  };
}

/**
 * Schedule a design for publishing/unpublishing
 */
export async function scheduleDesign(
  options: ScheduleDesignOptions
): Promise<{ success: boolean; error?: string }> {
  const enabled = await isScheduledPublishingEnabled();
  if (!enabled) {
    return { success: false, error: "Scheduled publishing feature is disabled" };
  }

  const { designId, publishAt, unpublishAt } = options;
  const supabase = createServiceClient();

  // Validate dates
  const publishDate = publishAt ? new Date(publishAt) : null;
  const unpublishDate = unpublishAt ? new Date(unpublishAt) : null;

  // Validate that unpublish is after publish if both are set
  if (publishDate && unpublishDate && unpublishDate <= publishDate) {
    return {
      success: false,
      error: "Unpublish date must be after publish date",
    };
  }

  // Update the design
  const { error } = await supabase
    .from("designs")
    .update({
      publish_at: publishDate?.toISOString() || null,
      unpublish_at: unpublishDate?.toISOString() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", designId);

  if (error) {
    return { success: false, error: error.message };
  }

  // If using job queue with Redis, schedule specific jobs
  if (publishDate && publishDate > new Date()) {
    await enqueueJob(
      { type: "design:publish", designId },
      { delay: publishDate.getTime() - Date.now(), jobId: `publish-${designId}` }
    );
  }

  if (unpublishDate && unpublishDate > new Date()) {
    await enqueueJob(
      { type: "design:unpublish", designId },
      { delay: unpublishDate.getTime() - Date.now(), jobId: `unpublish-${designId}` }
    );
  }

  return { success: true };
}

/**
 * Clear scheduled publishing for a design
 */
export async function clearSchedule(
  designId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServiceClient();

  const { error } = await supabase
    .from("designs")
    .update({
      publish_at: null,
      unpublish_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", designId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Get scheduled designs (for admin dashboard)
 */
export async function getScheduledDesigns(): Promise<{
  toPublish: Array<{ id: string; title: string; slug: string; publish_at: string }>;
  toUnpublish: Array<{ id: string; title: string; slug: string; unpublish_at: string }>;
}> {
  const supabase = createServiceClient();

  // Get designs scheduled for publishing
  const { data: toPublish } = await supabase
    .from("designs")
    .select("id, title, slug, publish_at")
    .not("publish_at", "is", null)
    .eq("is_public", false)
    .order("publish_at", { ascending: true })
    .limit(50);

  // Get designs scheduled for unpublishing
  const { data: toUnpublish } = await supabase
    .from("designs")
    .select("id, title, slug, unpublish_at")
    .not("unpublish_at", "is", null)
    .eq("is_public", true)
    .order("unpublish_at", { ascending: true })
    .limit(50);

  return {
    toPublish: (toPublish || []) as Array<{
      id: string;
      title: string;
      slug: string;
      publish_at: string;
    }>,
    toUnpublish: (toUnpublish || []) as Array<{
      id: string;
      title: string;
      slug: string;
      unpublish_at: string;
    }>,
  };
}
