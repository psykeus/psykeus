import { z } from "zod";

// Common validation patterns
const uuidSchema = z.string().uuid();
const slugSchema = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens");
const pageSchema = z.coerce.number().int().min(1).default(1);
const pageSizeSchema = z.coerce.number().int().min(1).max(100).default(30);

// Search/filter query - sanitizes and limits input
const searchQuerySchema = z
  .string()
  .max(200)
  .transform((val) => val.trim())
  .optional();

// Difficulty levels - accepts both legacy and new values, empty string becomes undefined
const difficultySchema = z
  .enum(["beginner", "intermediate", "advanced", "easy", "medium", "hard", ""])
  .optional()
  .transform((val) => (val === "" ? undefined : val));

// Browse designs query params
export const browseDesignsSchema = z.object({
  q: searchQuerySchema,
  tag: z.string().max(100).optional(),
  difficulty: difficultySchema,
  category: z.string().max(100).optional(),
  page: pageSchema,
  pageSize: pageSizeSchema,
});
export type BrowseDesignsInput = z.infer<typeof browseDesignsSchema>;

// Design slug param
export const designSlugSchema = z.object({
  slug: slugSchema,
});

// Design ID param
export const designIdSchema = z.object({
  id: uuidSchema,
  designId: uuidSchema.optional(),
});

// License type enum
export const licenseTypeSchema = z.enum([
  "unknown",
  "public_domain",
  "cc0",
  "cc_by",
  "cc_by_sa",
  "cc_by_nc",
  "cc_by_nc_sa",
  "personal_only",
  "custom",
]);

// Admin design update
export const updateDesignSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(10000).optional(),
  is_public: z.boolean().optional(),
  difficulty: difficultySchema,
  project_type: z.string().max(100).optional(),
  categories: z.array(z.string().max(100)).max(20).optional(),
  style: z.string().max(100).optional(),
  approx_dimensions: z.string().max(200).optional(),
  publish_at: z.string().datetime().nullable().optional(),
  unpublish_at: z.string().datetime().nullable().optional(),
  // License fields
  license_type: licenseTypeSchema.optional(),
  license_notes: z.string().max(2000).optional(),
  license_url: z.string().url().max(500).or(z.literal("")).optional(),
  attribution_required: z.boolean().optional(),
  commercial_use_allowed: z.boolean().nullable().optional(),
  modification_allowed: z.boolean().optional(),
});
export type UpdateDesignInput = z.infer<typeof updateDesignSchema>;

// Admin design create
export const createDesignSchema = z.object({
  title: z.string().min(1).max(500),
  slug: slugSchema,
  description: z.string().max(10000).optional(),
  preview_path: z.string().min(1),
  is_public: z.boolean().default(false),
  difficulty: difficultySchema,
  project_type: z.string().max(100).optional(),
  categories: z.array(z.string().max(100)).max(20).optional(),
  style: z.string().max(100).optional(),
  approx_dimensions: z.string().max(200).optional(),
});
export type CreateDesignInput = z.infer<typeof createDesignSchema>;

// Tag management
export const createTagSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(100)
    .transform((val) => val.toLowerCase().trim()),
});
export type CreateTagInput = z.infer<typeof createTagSchema>;

export const updateTagsSchema = z.object({
  tagIds: z.array(uuidSchema).max(50),
});
export type UpdateTagsInput = z.infer<typeof updateTagsSchema>;

// Helper to parse and validate request params
export function parseSearchParams<T extends z.ZodSchema>(
  searchParams: URLSearchParams,
  schema: T
): z.infer<T> {
  const params: Record<string, string | undefined> = {};
  searchParams.forEach((value, key) => {
    params[key] = value;
  });
  return schema.parse(params);
}

// Helper to create error response from Zod errors
export function formatZodError(error: z.ZodError<unknown> | undefined | null): string {
  if (!error || !error.issues) {
    return "Validation failed";
  }
  return error.issues.map((e: z.ZodIssue) => `${e.path.join(".")}: ${e.message}`).join(", ");
}

/**
 * Escape special ILIKE pattern characters for safe use in Supabase queries.
 * Prevents SQL pattern injection by escaping: % (wildcard), _ (single char), \ (escape char)
 */
export function escapeIlikePattern(input: string): string {
  return input
    .replace(/\\/g, "\\\\") // Escape backslashes first
    .replace(/%/g, "\\%")   // Escape percent signs
    .replace(/_/g, "\\_");  // Escape underscores
}

// Collection validation schemas
export const createCollectionSchema = z.object({
  name: z.string().min(1).max(255).transform((val) => val.trim()),
  description: z.string().max(1000).optional().transform((val) => val?.trim() || null),
  is_public: z.boolean().default(false),
});
export type CreateCollectionInput = z.infer<typeof createCollectionSchema>;

export const updateCollectionSchema = z.object({
  name: z.string().min(1).max(255).transform((val) => val.trim()).optional(),
  description: z.string().max(1000).optional().nullable(),
  is_public: z.boolean().optional(),
  cover_image_url: z.string().url().optional().nullable(),
});
export type UpdateCollectionInput = z.infer<typeof updateCollectionSchema>;

// Favorites route param validation
export const favoriteParamsSchema = z.object({
  designId: z.string().uuid("Invalid design ID format"),
});

// Collection route param validation
export const collectionParamsSchema = z.object({
  id: z.string().uuid("Invalid collection ID format"),
});

// Collection item schemas
export const addCollectionItemSchema = z.object({
  design_id: z.string().uuid("Invalid design ID format"),
  notes: z.string().max(1000).optional(),
});
export type AddCollectionItemInput = z.infer<typeof addCollectionItemSchema>;

export const removeCollectionItemSchema = z
  .object({
    design_id: z.string().uuid().optional(),
    item_id: z.string().uuid().optional(),
  })
  .refine((data) => data.design_id || data.item_id, {
    message: "Either design_id or item_id is required",
  });
export type RemoveCollectionItemInput = z.infer<typeof removeCollectionItemSchema>;

export const updateCollectionItemSchema = z
  .object({
    item_id: z.string().uuid("Invalid item ID format"),
    sort_order: z.number().int().min(0).optional(),
    notes: z.string().max(1000).optional(),
  })
  .refine((data) => data.sort_order !== undefined || data.notes !== undefined, {
    message: "At least one update field is required",
  });
export type UpdateCollectionItemInput = z.infer<typeof updateCollectionItemSchema>;
