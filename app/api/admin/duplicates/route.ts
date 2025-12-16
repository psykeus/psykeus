import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUser, isAdmin } from "@/lib/auth";
import { hammingDistance, calculateSimilarity } from "@/lib/phash";
import { forbiddenResponse, handleDbError } from "@/lib/api/helpers";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const user = await getUser();

  if (!user || !isAdmin(user)) {
    return forbiddenResponse("Admin access required");
  }

  const { searchParams } = new URL(request.url);
  const threshold = Number(searchParams.get("threshold") ?? "10");

  // Get all design files with phash
  const { data: files, error } = await supabase
    .from("design_files")
    .select(
      `
      id,
      design_id,
      preview_phash,
      version_number,
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

  if (error) {
    return handleDbError(error, "load files for duplicates");
  }

  // Find near-duplicates
  const duplicates: Array<{
    design1: unknown;
    design2: unknown;
    similarity: number;
  }> = [];
  const seen = new Set<string>();

  for (let i = 0; i < (files?.length ?? 0); i++) {
    for (let j = i + 1; j < (files?.length ?? 0); j++) {
      const file1 = files![i];
      const file2 = files![j];

      // Skip if same design
      if (file1.design_id === file2.design_id) continue;

      // Skip if already seen this pair
      const pairKey = [file1.design_id, file2.design_id].sort().join("-");
      if (seen.has(pairKey)) continue;

      if (file1.preview_phash && file2.preview_phash) {
        const distance = hammingDistance(
          file1.preview_phash,
          file2.preview_phash
        );

        if (distance <= threshold) {
          seen.add(pairKey);
          duplicates.push({
            design1: file1.designs,
            design2: file2.designs,
            similarity: calculateSimilarity(file1.preview_phash, file2.preview_phash),
          });
        }
      }
    }
  }

  // Sort by similarity (highest first)
  duplicates.sort((a, b) => b.similarity - a.similarity);

  return NextResponse.json({ duplicates, threshold });
}
