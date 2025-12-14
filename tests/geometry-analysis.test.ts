import { describe, it, expect } from "vitest";
import {
  analyzeGeometry,
  formatDimensions,
  formatVolume,
  formatSurfaceArea,
  estimateMaterialUsage,
  getComplexityDescription,
  type Triangle,
} from "@/lib/geometry-analysis";

// Helper to create a simple cube triangles (8 triangles for 6 faces)
function createCubeTriangles(size: number): Triangle[] {
  // Simplified: just create 2 triangles for testing
  return [
    {
      normal: { x: 0, y: 0, z: 1 },
      vertices: [
        { x: 0, y: 0, z: size },
        { x: size, y: 0, z: size },
        { x: 0, y: size, z: size },
      ],
    },
    {
      normal: { x: 0, y: 0, z: 1 },
      vertices: [
        { x: size, y: size, z: size },
        { x: 0, y: size, z: size },
        { x: size, y: 0, z: size },
      ],
    },
  ];
}

// Helper to create a larger set of triangles
function createManyTriangles(count: number): Triangle[] {
  const triangles: Triangle[] = [];
  for (let i = 0; i < count; i++) {
    triangles.push({
      normal: { x: 0, y: 0, z: 1 },
      vertices: [
        { x: i, y: 0, z: 0 },
        { x: i + 1, y: 0, z: 0 },
        { x: i, y: 1, z: 0 },
      ],
    });
  }
  return triangles;
}

describe("analyzeGeometry", () => {
  describe("empty input", () => {
    it("should return empty metrics for empty array", () => {
      const result = analyzeGeometry([]);

      expect(result.triangleCount).toBe(0);
      expect(result.vertexCount).toBe(0);
      expect(result.surfaceArea).toBe(0);
      expect(result.volumeEstimate).toBe(0);
      expect(result.detectedUnit).toBe("unknown");
      expect(result.complexity).toBe("simple");
    });
  });

  describe("bounding box", () => {
    it("should calculate correct bounding box", () => {
      const triangles: Triangle[] = [
        {
          normal: { x: 0, y: 0, z: 1 },
          vertices: [
            { x: 0, y: 0, z: 0 },
            { x: 100, y: 50, z: 25 },
            { x: -10, y: -20, z: -5 },
          ],
        },
      ];

      const result = analyzeGeometry(triangles);

      expect(result.boundingBox.minX).toBe(-10);
      expect(result.boundingBox.maxX).toBe(100);
      expect(result.boundingBox.minY).toBe(-20);
      expect(result.boundingBox.maxY).toBe(50);
      expect(result.boundingBox.minZ).toBe(-5);
      expect(result.boundingBox.maxZ).toBe(25);
    });

    it("should calculate dimensions from bounding box", () => {
      const triangles: Triangle[] = [
        {
          normal: { x: 0, y: 0, z: 1 },
          vertices: [
            { x: 0, y: 0, z: 0 },
            { x: 100, y: 50, z: 30 },
            { x: 0, y: 0, z: 0 },
          ],
        },
      ];

      const result = analyzeGeometry(triangles);

      expect(result.dimensions.width).toBe(100);
      expect(result.dimensions.height).toBe(50);
      expect(result.dimensions.depth).toBe(30);
    });
  });

  describe("triangle and vertex count", () => {
    it("should count triangles correctly", () => {
      const triangles = createManyTriangles(100);
      const result = analyzeGeometry(triangles);

      expect(result.triangleCount).toBe(100);
    });

    it("should count unique vertices", () => {
      // Two triangles sharing an edge (4 unique vertices)
      const triangles: Triangle[] = [
        {
          normal: { x: 0, y: 0, z: 1 },
          vertices: [
            { x: 0, y: 0, z: 0 },
            { x: 1, y: 0, z: 0 },
            { x: 0, y: 1, z: 0 },
          ],
        },
        {
          normal: { x: 0, y: 0, z: 1 },
          vertices: [
            { x: 1, y: 1, z: 0 },
            { x: 0, y: 1, z: 0 },
            { x: 1, y: 0, z: 0 },
          ],
        },
      ];

      const result = analyzeGeometry(triangles);

      expect(result.triangleCount).toBe(2);
      expect(result.vertexCount).toBe(4); // 4 unique vertices
    });
  });

  describe("surface area", () => {
    it("should calculate positive surface area", () => {
      const triangles = createCubeTriangles(10);
      const result = analyzeGeometry(triangles);

      expect(result.surfaceArea).toBeGreaterThan(0);
    });

    it("should calculate unit triangle area correctly", () => {
      // Right triangle with legs of length 1 has area 0.5
      const triangles: Triangle[] = [
        {
          normal: { x: 0, y: 0, z: 1 },
          vertices: [
            { x: 0, y: 0, z: 0 },
            { x: 1, y: 0, z: 0 },
            { x: 0, y: 1, z: 0 },
          ],
        },
      ];

      const result = analyzeGeometry(triangles);
      expect(result.surfaceArea).toBeCloseTo(0.5, 5);
    });
  });

  describe("unit detection", () => {
    it("should detect mm for typical 3D print sizes (10-300mm)", () => {
      const triangles: Triangle[] = [
        {
          normal: { x: 0, y: 0, z: 1 },
          vertices: [
            { x: 0, y: 0, z: 0 },
            { x: 100, y: 0, z: 0 },
            { x: 0, y: 80, z: 50 },
          ],
        },
      ];

      const result = analyzeGeometry(triangles);
      expect(result.detectedUnit).toBe("mm");
      expect(result.unitConfidence).toBe("high");
    });

    it("should detect inches for small dimensions", () => {
      const triangles: Triangle[] = [
        {
          normal: { x: 0, y: 0, z: 1 },
          vertices: [
            { x: 0, y: 0, z: 0 },
            { x: 3, y: 0, z: 0 },
            { x: 0, y: 2, z: 1 },
          ],
        },
      ];

      const result = analyzeGeometry(triangles);
      // Could be mm (very small) or inches
      expect(["mm", "inches"]).toContain(result.detectedUnit);
    });

    it("should return unknown for very large dimensions", () => {
      const triangles: Triangle[] = [
        {
          normal: { x: 0, y: 0, z: 1 },
          vertices: [
            { x: 0, y: 0, z: 0 },
            { x: 5000, y: 0, z: 0 },
            { x: 0, y: 3000, z: 2000 },
          ],
        },
      ];

      const result = analyzeGeometry(triangles);
      expect(result.detectedUnit).toBe("unknown");
    });
  });

  describe("complexity categorization", () => {
    it("should categorize simple models (<500 triangles)", () => {
      const triangles = createManyTriangles(100);
      const result = analyzeGeometry(triangles);
      expect(result.complexity).toBe("simple");
    });

    it("should categorize moderate models (500-5000 triangles)", () => {
      const triangles = createManyTriangles(1000);
      const result = analyzeGeometry(triangles);
      expect(result.complexity).toBe("moderate");
    });

    it("should categorize complex models (5000-50000 triangles)", () => {
      const triangles = createManyTriangles(10000);
      const result = analyzeGeometry(triangles);
      expect(result.complexity).toBe("complex");
    });

    it("should categorize highly-complex models (>50000 triangles)", () => {
      const triangles = createManyTriangles(60000);
      const result = analyzeGeometry(triangles);
      expect(result.complexity).toBe("highly-complex");
    });
  });

  describe("aspect ratio", () => {
    it("should calculate aspect ratio", () => {
      const triangles: Triangle[] = [
        {
          normal: { x: 0, y: 0, z: 1 },
          vertices: [
            { x: 0, y: 0, z: 0 },
            { x: 100, y: 0, z: 0 },
            { x: 0, y: 50, z: 25 },
          ],
        },
      ];

      const result = analyzeGeometry(triangles);
      // Should be formatted as "W:H:D" normalized to smallest
      expect(result.aspectRatio).toMatch(/^\d+(\.\d+)?:\d+(\.\d+)?:\d+(\.\d+)?$/);
    });
  });
});

describe("formatDimensions", () => {
  it("should format mm dimensions", () => {
    const metrics = {
      dimensions: { width: 100.5, height: 50.2, depth: 25.7 },
      detectedUnit: "mm" as const,
    } as ReturnType<typeof analyzeGeometry>;

    const result = formatDimensions(metrics);
    expect(result).toBe("100.5 x 50.2 x 25.7 mm");
  });

  it("should format inch dimensions with more precision", () => {
    const metrics = {
      dimensions: { width: 4.25, height: 2.5, depth: 1.125 },
      detectedUnit: "inches" as const,
    } as ReturnType<typeof analyzeGeometry>;

    const result = formatDimensions(metrics);
    expect(result).toBe("4.25 x 2.50 x 1.13 in");
  });

  it("should format unknown units", () => {
    const metrics = {
      dimensions: { width: 1000, height: 500, depth: 250 },
      detectedUnit: "unknown" as const,
    } as ReturnType<typeof analyzeGeometry>;

    const result = formatDimensions(metrics);
    expect(result).toBe("1000.0 x 500.0 x 250.0 units");
  });
});

describe("formatVolume", () => {
  it("should format small mm volumes", () => {
    expect(formatVolume(50000, "mm")).toMatch(/50,?000.*mm³/);
  });

  it("should format large mm volumes in cm³", () => {
    expect(formatVolume(5000000, "mm")).toMatch(/5.*cm³/);
  });

  it("should format inch volumes", () => {
    expect(formatVolume(2.5, "inches")).toBe("2.50 in³");
  });

  it("should format unknown unit volumes", () => {
    expect(formatVolume(1000, "unknown")).toMatch(/1,?000.*units³/);
  });
});

describe("formatSurfaceArea", () => {
  it("should format small mm areas", () => {
    expect(formatSurfaceArea(5000, "mm")).toMatch(/5,?000.*mm²/);
  });

  it("should format large mm areas in cm²", () => {
    expect(formatSurfaceArea(50000, "mm")).toMatch(/500.*cm²/);
  });

  it("should format inch areas", () => {
    expect(formatSurfaceArea(12.5, "inches")).toBe("12.50 in²");
  });

  it("should format unknown unit areas", () => {
    expect(formatSurfaceArea(1000, "unknown")).toMatch(/1,?000.*units²/);
  });
});

describe("estimateMaterialUsage", () => {
  it("should return grams and filament meters", () => {
    const result = estimateMaterialUsage(1000000, "mm"); // 1 cm³

    expect(result).toHaveProperty("grams");
    expect(result).toHaveProperty("metersFilament");
    expect(typeof result.grams).toBe("number");
    expect(typeof result.metersFilament).toBe("number");
  });

  it("should handle mm volumes", () => {
    const result = estimateMaterialUsage(1000000, "mm"); // 1 cm³

    expect(result.grams).toBeGreaterThan(0);
    expect(result.metersFilament).toBeGreaterThan(0);
  });

  it("should convert inches to mm", () => {
    // 1 inch³ = 16387 mm³ = 16.387 cm³
    const result = estimateMaterialUsage(1, "inches");

    expect(result.grams).toBeGreaterThan(0);
  });

  it("should account for infill percentage", () => {
    const result20 = estimateMaterialUsage(10000000, "mm", 20);
    const result100 = estimateMaterialUsage(10000000, "mm", 100);

    expect(result100.grams).toBeGreaterThan(result20.grams);
  });

  it("should use default infill of 20%", () => {
    const explicit = estimateMaterialUsage(1000000, "mm", 20);
    const defaultInfill = estimateMaterialUsage(1000000, "mm");

    expect(explicit.grams).toBe(defaultInfill.grams);
  });
});

describe("getComplexityDescription", () => {
  it("should describe simple models", () => {
    const metrics = {
      complexity: "simple" as const,
      triangleCount: 100,
    } as ReturnType<typeof analyzeGeometry>;

    const result = getComplexityDescription(metrics);

    expect(result).toContain("Simple");
    expect(result).toContain("100");
  });

  it("should describe moderate models", () => {
    const metrics = {
      complexity: "moderate" as const,
      triangleCount: 2500,
    } as ReturnType<typeof analyzeGeometry>;

    const result = getComplexityDescription(metrics);

    expect(result).toContain("Moderate");
    expect(result).toContain("2,500");
  });

  it("should describe complex models", () => {
    const metrics = {
      complexity: "complex" as const,
      triangleCount: 25000,
    } as ReturnType<typeof analyzeGeometry>;

    const result = getComplexityDescription(metrics);

    expect(result).toContain("Complex");
  });

  it("should describe highly-complex models", () => {
    const metrics = {
      complexity: "highly-complex" as const,
      triangleCount: 100000,
    } as ReturnType<typeof analyzeGeometry>;

    const result = getComplexityDescription(metrics);

    expect(result).toContain("Highly complex");
  });
});
