import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { hammingDistance, calculateSimilarity } from "@/lib/phash";
import { DuplicatesClient } from "./DuplicatesClient";

interface DesignInfo {
  id: string;
  title: string;
  slug: string;
  preview_path: string;
}

export interface DuplicatePair {
  design1: DesignInfo;
  design2: DesignInfo;
  similarity: number;
}

export default async function AdminDuplicatesPage() {
  await requireAdmin();
  const supabase = await createClient();

  // Get all design files with phash
  const { data: files } = await supabase
    .from("design_files")
    .select(
      `
      id,
      design_id,
      preview_phash,
      designs (
        id,
        title,
        slug,
        preview_path
      )
    `
    )
    .not("preview_phash", "is", null)
    .eq("is_active", true);

  // Find near-duplicates (threshold of 10)
  const threshold = 10;
  const duplicates: DuplicatePair[] = [];
  const seen = new Set<string>();

  if (files) {
    for (let i = 0; i < files.length; i++) {
      for (let j = i + 1; j < files.length; j++) {
        const file1 = files[i];
        const file2 = files[j];

        // Skip if same design
        if (file1.design_id === file2.design_id) continue;

        // Skip if already seen this pair
        const pairKey = [file1.design_id, file2.design_id].sort().join("-");
        if (seen.has(pairKey)) continue;

        if (file1.preview_phash && file2.preview_phash) {
          const distance = hammingDistance(file1.preview_phash, file2.preview_phash);

          if (distance <= threshold) {
            seen.add(pairKey);
            const design1 = file1.designs as unknown as DesignInfo;
            const design2 = file2.designs as unknown as DesignInfo;
            duplicates.push({
              design1,
              design2,
              similarity: calculateSimilarity(file1.preview_phash, file2.preview_phash),
            });
          }
        }
      }
    }
  }

  // Sort by similarity (highest first)
  duplicates.sort((a, b) => b.similarity - a.similarity);

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Duplicate Review</h1>
      <p className="text-muted-foreground mb-8">
        Found {duplicates.length} potential duplicate pair{duplicates.length !== 1 ? "s" : ""}.
        Review and take action as needed.
      </p>

      <DuplicatesClient initialDuplicates={duplicates} />
    </div>
  );
}
