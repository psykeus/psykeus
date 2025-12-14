import sharp from "sharp";

/**
 * Perceptual hash (pHash) implementation using difference hash (dHash) algorithm.
 * Creates a 64-bit hash that represents the visual structure of an image.
 * Similar images will have similar hashes (low Hamming distance).
 */

const HASH_SIZE = 8; // 8x8 = 64 bits

/**
 * Generate a perceptual hash from an image buffer.
 * Returns a 64-character hex string representing the hash.
 */
export async function generatePhash(imageBuffer: Buffer): Promise<string> {
  try {
    // Resize to (HASH_SIZE + 1) x HASH_SIZE for difference comparison
    // Convert to grayscale
    const { data, info } = await sharp(imageBuffer)
      .resize(HASH_SIZE + 1, HASH_SIZE, { fit: "fill" })
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Create difference hash
    // Compare each pixel to its right neighbor
    const bits: number[] = [];

    for (let y = 0; y < HASH_SIZE; y++) {
      for (let x = 0; x < HASH_SIZE; x++) {
        const leftPixel = data[y * info.width + x];
        const rightPixel = data[y * info.width + x + 1];
        bits.push(leftPixel < rightPixel ? 1 : 0);
      }
    }

    // Convert bits to hex string (64 bits = 16 hex chars)
    let hash = "";
    for (let i = 0; i < bits.length; i += 4) {
      const nibble = (bits[i] << 3) | (bits[i + 1] << 2) | (bits[i + 2] << 1) | bits[i + 3];
      hash += nibble.toString(16);
    }

    return hash;
  } catch (error) {
    console.error("Phash generation error:", error);
    // Return empty string on failure - will be handled by caller
    return "";
  }
}

/**
 * Calculate Hamming distance between two hashes.
 * Lower distance = more similar images.
 * Distance of 0 = identical, Distance of 64 = completely different.
 */
export function hammingDistance(hash1: string, hash2: string): number {
  if (!hash1 || !hash2 || hash1.length !== hash2.length) {
    return Infinity;
  }

  let distance = 0;

  // Convert hex to binary and compare bit by bit
  for (let i = 0; i < hash1.length; i++) {
    const b1 = parseInt(hash1[i], 16);
    const b2 = parseInt(hash2[i], 16);
    // XOR and count set bits (Brian Kernighan's algorithm)
    let xor = b1 ^ b2;
    while (xor) {
      distance++;
      xor &= xor - 1;
    }
  }

  return distance;
}

/**
 * Calculate similarity percentage between two hashes.
 * Returns 0-100 where 100 = identical.
 */
export function calculateSimilarity(hash1: string, hash2: string): number {
  const distance = hammingDistance(hash1, hash2);
  if (distance === Infinity) return 0;

  const maxBits = hash1.length * 4; // 4 bits per hex char
  return Math.round((1 - distance / maxBits) * 100);
}

/**
 * Check if two hashes are similar within a threshold.
 * Default threshold of 10 catches most visual duplicates.
 */
export function isSimilar(hash1: string, hash2: string, threshold: number = 10): boolean {
  return hammingDistance(hash1, hash2) <= threshold;
}

/**
 * Find similar hashes in a collection.
 * Returns array of matches with their similarity scores.
 */
export function findSimilarHashes(
  targetHash: string,
  hashes: Array<{ id: string; hash: string }>,
  threshold: number = 10
): Array<{ id: string; hash: string; distance: number; similarity: number }> {
  const matches: Array<{ id: string; hash: string; distance: number; similarity: number }> = [];

  for (const item of hashes) {
    if (!item.hash) continue;

    const distance = hammingDistance(targetHash, item.hash);
    if (distance <= threshold) {
      matches.push({
        id: item.id,
        hash: item.hash,
        distance,
        similarity: calculateSimilarity(targetHash, item.hash),
      });
    }
  }

  // Sort by similarity (highest first)
  matches.sort((a, b) => b.similarity - a.similarity);

  return matches;
}
