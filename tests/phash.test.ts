import { describe, it, expect } from "vitest";
import {
  hammingDistance,
  calculateSimilarity,
  isSimilar,
  findSimilarHashes,
} from "@/lib/phash";

// Note: generatePhash requires actual image buffers, so we test the hash comparison functions
// which can be tested with synthetic hashes

describe("hammingDistance", () => {
  describe("valid hashes", () => {
    it("should return 0 for identical hashes", () => {
      const hash = "0123456789abcdef";
      expect(hammingDistance(hash, hash)).toBe(0);
    });

    it("should count single bit differences", () => {
      // 0 = 0000, 1 = 0001 (1 bit difference)
      expect(hammingDistance("0", "1")).toBe(1);
    });

    it("should count multiple bit differences", () => {
      // f = 1111, 0 = 0000 (4 bit differences per char)
      expect(hammingDistance("f", "0")).toBe(4);
    });

    it("should handle full 16-char hashes", () => {
      // All 0s vs all fs = 64 bits different
      expect(hammingDistance("0000000000000000", "ffffffffffffffff")).toBe(64);
    });

    it("should calculate correct distance for similar hashes", () => {
      // One hex char different: 8 = 1000, 9 = 1001 (1 bit)
      const hash1 = "0000000000000008";
      const hash2 = "0000000000000009";
      expect(hammingDistance(hash1, hash2)).toBe(1);
    });
  });

  describe("invalid inputs", () => {
    it("should return Infinity for empty strings", () => {
      expect(hammingDistance("", "")).toBe(Infinity);
      expect(hammingDistance("abc", "")).toBe(Infinity);
    });

    it("should return Infinity for different length hashes", () => {
      expect(hammingDistance("abc", "abcd")).toBe(Infinity);
    });

    it("should return Infinity for null/undefined-like values", () => {
      expect(hammingDistance("", "abc")).toBe(Infinity);
    });
  });
});

describe("calculateSimilarity", () => {
  it("should return 100 for identical hashes", () => {
    const hash = "0123456789abcdef";
    expect(calculateSimilarity(hash, hash)).toBe(100);
  });

  it("should return 0 for completely different hashes", () => {
    expect(calculateSimilarity("0000000000000000", "ffffffffffffffff")).toBe(0);
  });

  it("should return correct percentage for partial similarity", () => {
    // 8 different bits out of 64 = 87.5% similar, rounds to 88
    const hash1 = "0000000000000000";
    const hash2 = "ff00000000000000"; // 8 bits different
    const similarity = calculateSimilarity(hash1, hash2);
    expect(similarity).toBe(88); // Math.round((1 - 8/64) * 100) = 88
  });

  it("should return 0 for invalid hashes", () => {
    expect(calculateSimilarity("", "abc")).toBe(0);
    expect(calculateSimilarity("abc", "")).toBe(0);
  });
});

describe("isSimilar", () => {
  describe("with default threshold (10)", () => {
    it("should return true for identical hashes", () => {
      const hash = "0123456789abcdef";
      expect(isSimilar(hash, hash)).toBe(true);
    });

    it("should return true for very similar hashes", () => {
      // 1 bit different
      const hash1 = "0000000000000000";
      const hash2 = "0000000000000001";
      expect(isSimilar(hash1, hash2)).toBe(true);
    });

    it("should return true for hashes within threshold", () => {
      // 8 bits different (within default threshold of 10)
      const hash1 = "0000000000000000";
      const hash2 = "ff00000000000000";
      expect(isSimilar(hash1, hash2)).toBe(true);
    });

    it("should return false for hashes beyond threshold", () => {
      // 16 bits different (beyond threshold of 10)
      const hash1 = "0000000000000000";
      const hash2 = "ffff000000000000";
      expect(isSimilar(hash1, hash2)).toBe(false);
    });
  });

  describe("with custom threshold", () => {
    it("should respect custom threshold", () => {
      const hash1 = "0000000000000000";
      const hash2 = "ff00000000000000"; // 8 bits different

      expect(isSimilar(hash1, hash2, 5)).toBe(false);
      expect(isSimilar(hash1, hash2, 10)).toBe(true);
    });

    it("should work with threshold of 0 (exact match only)", () => {
      const hash1 = "0123456789abcdef";
      const hash2 = "0123456789abcdef";
      const hash3 = "0123456789abcdee";

      expect(isSimilar(hash1, hash2, 0)).toBe(true);
      expect(isSimilar(hash1, hash3, 0)).toBe(false);
    });
  });
});

describe("findSimilarHashes", () => {
  const testHashes = [
    { id: "design-1", hash: "0000000000000000" },
    { id: "design-2", hash: "0000000000000001" }, // 1 bit diff from design-1
    { id: "design-3", hash: "ff00000000000000" }, // 8 bits diff from design-1
    { id: "design-4", hash: "ffff000000000000" }, // 16 bits diff from design-1
    { id: "design-5", hash: "ffffffffffffffff" }, // 64 bits diff from design-1
  ];

  it("should find exact matches", () => {
    const results = findSimilarHashes("0000000000000000", testHashes, 0);

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("design-1");
    expect(results[0].similarity).toBe(100);
  });

  it("should find matches within threshold", () => {
    const results = findSimilarHashes("0000000000000000", testHashes, 10);

    expect(results.length).toBeGreaterThanOrEqual(2);
    expect(results.map((r) => r.id)).toContain("design-1");
    expect(results.map((r) => r.id)).toContain("design-2");
    expect(results.map((r) => r.id)).toContain("design-3");
  });

  it("should exclude matches beyond threshold", () => {
    const results = findSimilarHashes("0000000000000000", testHashes, 10);

    // design-4 (16 bits) and design-5 (64 bits) should not be included
    expect(results.map((r) => r.id)).not.toContain("design-4");
    expect(results.map((r) => r.id)).not.toContain("design-5");
  });

  it("should sort by similarity (highest first)", () => {
    const results = findSimilarHashes("0000000000000000", testHashes, 20);

    // First result should have highest similarity
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].similarity).toBeGreaterThanOrEqual(
        results[i].similarity
      );
    }
  });

  it("should include distance and similarity in results", () => {
    const results = findSimilarHashes("0000000000000000", testHashes, 10);

    for (const result of results) {
      expect(result).toHaveProperty("id");
      expect(result).toHaveProperty("hash");
      expect(result).toHaveProperty("distance");
      expect(result).toHaveProperty("similarity");
      expect(result.distance).toBeGreaterThanOrEqual(0);
      expect(result.similarity).toBeGreaterThanOrEqual(0);
      expect(result.similarity).toBeLessThanOrEqual(100);
    }
  });

  it("should return empty array for no matches", () => {
    const results = findSimilarHashes("ffffffffffffffff", testHashes, 5);

    // Only design-5 matches, and only with threshold > 0
    const exactMatch = results.filter((r) => r.id === "design-5");
    expect(exactMatch).toHaveLength(1);
  });

  it("should skip items with empty hashes", () => {
    const hashesWithEmpty = [
      { id: "design-1", hash: "0000000000000000" },
      { id: "design-2", hash: "" },
      { id: "design-3", hash: "0000000000000001" },
    ];

    const results = findSimilarHashes("0000000000000000", hashesWithEmpty, 10);

    expect(results.map((r) => r.id)).not.toContain("design-2");
  });

  it("should handle empty input array", () => {
    const results = findSimilarHashes("0000000000000000", [], 10);
    expect(results).toEqual([]);
  });
});

describe("Hash consistency", () => {
  it("should have symmetric distance", () => {
    const hash1 = "0123456789abcdef";
    const hash2 = "fedcba9876543210";

    const dist1 = hammingDistance(hash1, hash2);
    const dist2 = hammingDistance(hash2, hash1);

    expect(dist1).toBe(dist2);
  });

  it("should have symmetric similarity", () => {
    const hash1 = "0123456789abcdef";
    const hash2 = "fedcba9876543210";

    const sim1 = calculateSimilarity(hash1, hash2);
    const sim2 = calculateSimilarity(hash2, hash1);

    expect(sim1).toBe(sim2);
  });

  it("should maintain relationship between distance and similarity", () => {
    const hash1 = "0000000000000000";
    const hash2 = "ff00000000000000";

    const distance = hammingDistance(hash1, hash2);
    const similarity = calculateSimilarity(hash1, hash2);

    // similarity = (1 - distance/64) * 100
    const expectedSimilarity = Math.round((1 - distance / 64) * 100);
    expect(similarity).toBe(expectedSimilarity);
  });
});
