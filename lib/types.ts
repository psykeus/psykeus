// Database types - will be auto-generated from Supabase
// Run: npm run db:types to regenerate

export type UserRole = "user" | "admin" | "super_admin";
export type UserStatus = "active" | "suspended" | "banned";
export type DesignAccessLevel = "free" | "premium" | "exclusive";
export type DesignLicenseType =
  | "unknown"
  | "public_domain"
  | "cc0"
  | "cc_by"
  | "cc_by_sa"
  | "cc_by_nc"
  | "cc_by_nc_sa"
  | "personal_only"
  | "custom";

export interface User {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  created_at: string;
  // Enhanced user fields
  tier_id: string | null;
  tier_expires_at: string | null;
  status: UserStatus;
  suspended_reason: string | null;
  suspended_at: string | null;
  suspended_by: string | null;
  last_login_at: string | null;
  login_count: number;
  profile_image_url: string | null;
  bio: string | null;
  website: string | null;
  updated_at: string | null;
}

export interface AccessTier {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  daily_download_limit: number | null;
  monthly_download_limit: number | null;
  can_access_premium: boolean;
  can_access_exclusive: boolean;
  can_create_collections: boolean;
  max_collections: number | null;
  max_favorites: number | null;
  price_monthly: number | null;
  price_yearly: number | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserWithTier extends User {
  access_tier?: AccessTier | null;
}

export interface UserDashboardStats {
  total_downloads: number;
  downloads_today: number;
  downloads_this_month: number;
  total_favorites: number;
  total_collections: number;
  member_since: string;
  last_login: string | null;
}

export interface DownloadLimitStatus {
  can_download: boolean;
  reason: string | null;
  downloads_today: number;
  downloads_this_month: number;
  daily_limit: number | null;
  monthly_limit: number | null;
}

export interface Design {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  preview_path: string;
  project_type: string | null;
  difficulty: string | null;
  categories: string[] | null;
  style: string | null;
  approx_dimensions: string | null;
  metadata_json: Record<string, unknown> | null;
  current_version_id: string | null;
  primary_file_id: string | null;
  is_public: boolean;
  access_level: DesignAccessLevel;
  // License fields
  license_type: DesignLicenseType;
  license_notes: string | null;
  license_url: string | null;
  attribution_required: boolean;
  commercial_use_allowed: boolean | null;
  modification_allowed: boolean;
  created_at: string;
  updated_at: string;
}

export type FileRole = "primary" | "variant" | "component";

export interface DesignFile {
  id: string;
  design_id: string;
  storage_path: string;
  file_type: string | null;
  size_bytes: number | null;
  content_hash: string;
  preview_phash: string | null;
  source_path: string | null;
  version_number: number;
  is_active: boolean;
  created_at: string;
  // Multi-file support fields
  file_role: FileRole;
  file_group: string | null;
  original_filename: string | null;
  display_name: string | null;
  file_description: string | null;
  sort_order: number;
}

export interface Tag {
  id: string;
  name: string;
}

export interface DesignTag {
  design_id: string;
  tag_id: string;
}

export interface Download {
  id: string;
  user_id: string;
  design_id: string;
  design_file_id: string;
  downloaded_at: string;
  ip_address: string | null;
  user_agent: string | null;
}

// API Response types
export interface DesignWithTags extends Design {
  tags: Tag[];
  current_file?: DesignFile;
}

/**
 * Minimal design fields for list/grid displays (public-facing)
 * Used by: DesignCard, designs/page.tsx, use-designs.ts
 */
export interface DesignListItem {
  id: string;
  slug: string;
  title: string;
  preview_path: string;
  difficulty: string | null;
  categories: string[] | null;
  style: string | null;
  project_type?: string | null;
  access_level?: DesignAccessLevel;
}

/**
 * Design fields for admin list/table displays
 * Includes admin-specific fields like is_public and updated_at
 * Fields from DesignListItem that aren't always needed are made optional
 */
export interface AdminDesignListItem {
  id: string;
  slug: string;
  title: string;
  preview_path: string;
  difficulty: string | null;
  is_public: boolean;
  updated_at: string;
  // Optional fields from DesignListItem - may not be included in all queries
  categories?: string[] | null;
  style?: string | null;
  project_type?: string | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  pageSize: number;
  total?: number;
}

export interface DesignFilters {
  q?: string;
  tag?: string;
  difficulty?: string;
  category?: string;
  style?: string;
  page?: number;
  pageSize?: number;
}

// Admin types
export interface DesignVersion extends DesignFile {
  design?: Design;
}

export interface DownloadStats {
  total_downloads: number;
  unique_users: number;
  top_designs: Array<{
    design_id: string;
    title: string;
    download_count: number;
  }>;
}

export interface DuplicateCandidate {
  design_id: string;
  title: string;
  preview_path: string;
  similarity_score: number;
  matching_design_id: string;
  matching_title: string;
}

// Multi-file project types
export interface DesignFileWithMeta extends DesignFile {
  download_url?: string;
}

export interface DesignWithFiles extends Design {
  files: DesignFileWithMeta[];
  primary_file?: DesignFileWithMeta;
}

export interface FileGroup {
  name: string;
  files: DesignFileWithMeta[];
}

export interface GroupedFiles {
  primary: DesignFileWithMeta | null;
  variants: DesignFileWithMeta[];
  components: FileGroup[];
}

// Request types for multi-file operations
export interface AddFilesRequest {
  fileRole: FileRole;
  fileGroup?: string;
}

export interface UpdateFileRequest {
  display_name?: string;
  file_description?: string;
  file_role?: FileRole;
  file_group?: string;
  sort_order?: number;
}

export interface ZipUploadOptions {
  generateAiMetadata: boolean;
  primaryFileIndex?: number;
}

// =============================================================================
// API Route Parameter Types
// =============================================================================

/**
 * Next.js 15 route params are now Promises
 * These types standardize the common parameter patterns across API routes
 */

/**
 * Route params with slug (e.g., /api/designs/[slug])
 */
export interface SlugRouteParams {
  params: Promise<{ slug: string }>;
}

/**
 * Route params with id (e.g., /api/admin/designs/[id])
 */
export interface IdRouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Route params with designId (e.g., /api/download/[designId])
 */
export interface DesignIdRouteParams {
  params: Promise<{ designId: string }>;
}

/**
 * Route params with jobId (e.g., /api/admin/import/jobs/[jobId])
 */
export interface JobIdRouteParams {
  params: Promise<{ jobId: string }>;
}

/**
 * Route params with id and fileId (e.g., /api/admin/designs/[id]/files/[fileId])
 */
export interface IdFileIdRouteParams {
  params: Promise<{ id: string; fileId: string }>;
}

/**
 * Route params with slug and fileId (e.g., /api/designs/[slug]/files/[fileId])
 */
export interface SlugFileIdRouteParams {
  params: Promise<{ slug: string; fileId: string }>;
}

/**
 * Route params with designId and fileId (e.g., /api/download/[designId]/file/[fileId])
 */
export interface DesignIdFileIdRouteParams {
  params: Promise<{ designId: string; fileId: string }>;
}
