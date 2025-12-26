/**
 * Hash Loader
 *
 * Utilities for loading existing content hashes and perceptual hashes
 * from the database for duplicate detection during import.
 *
 * Created: 2025-12-26
 * AI Model: Claude Opus 4.5 (claude-opus-4-5-20251101)
 */

import { createServiceClient } from "@/lib/supabase/server";

/**
 * Load existing content hashes from database.
 * Returns a Map of content_hash -> design_id for duplicate detection.
 *
 * @returns Map of SHA-256 hashes to design IDs
 */
export async function loadExistingHashes(): Promise<Map<string, string>> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("design_files")
    .select("content_hash, design_id")
    .eq("is_active", true)
    .not("content_hash", "is", null);

  if (error) {
    console.error("Failed to load existing hashes:", error);
    return new Map();
  }

  const map = new Map<string, string>();
  for (const d of data || []) {
    if (d.content_hash && d.design_id) {
      map.set(d.content_hash, d.design_id);
    }
  }
  return map;
}

/**
 * Load existing perceptual hashes from database.
 * Returns a Map of phash -> { design_id, title } for near-duplicate detection.
 *
 * @returns Map of perceptual hashes to design info
 */
export async function loadExistingPhashes(): Promise<
  Map<string, { design_id: string; title: string }>
> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("design_files")
    .select("preview_phash, design_id, designs!design_files_design_id_fkey(title)")
    .eq("is_active", true)
    .not("preview_phash", "is", null);

  if (error) {
    console.error("Failed to load existing phashes:", error);
    return new Map();
  }

  const map = new Map<string, { design_id: string; title: string }>();
  for (const d of data || []) {
    if (d.preview_phash) {
      const title = (d.designs as unknown as { title: string })?.title || "Unknown";
      map.set(d.preview_phash, { design_id: d.design_id, title });
    }
  }

  return map;
}

/**
 * Type alias for the hash map returned by loadExistingHashes
 */
export type ContentHashMap = Map<string, string>;

/**
 * Type alias for the phash map returned by loadExistingPhashes
 */
export type PhashMap = Map<string, { design_id: string; title: string }>;
