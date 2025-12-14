/**
 * Geometry analysis utilities for 3D models
 * Computes metrics like bounding box, volume estimate, and unit detection
 */

import { Triangle } from "./parsers";

// Re-export Triangle for backwards compatibility
export type { Triangle };

export interface BoundingBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

export interface GeometryMetrics {
  boundingBox: BoundingBox;
  dimensions: {
    width: number; // X axis
    height: number; // Y axis (typically "up")
    depth: number; // Z axis
  };
  triangleCount: number;
  vertexCount: number;
  surfaceArea: number;
  volumeEstimate: number;
  detectedUnit: "mm" | "inches" | "unknown";
  unitConfidence: "high" | "medium" | "low";
  complexity: "simple" | "moderate" | "complex" | "highly-complex";
  aspectRatio: string; // e.g., "1:2:0.5"
}

/**
 * Analyze triangles and compute comprehensive geometry metrics
 */
export function analyzeGeometry(triangles: Triangle[]): GeometryMetrics {
  if (triangles.length === 0) {
    return getEmptyMetrics();
  }

  // Compute bounding box
  let minX = Infinity,
    maxX = -Infinity;
  let minY = Infinity,
    maxY = -Infinity;
  let minZ = Infinity,
    maxZ = -Infinity;

  const uniqueVertices = new Set<string>();
  let surfaceArea = 0;
  let signedVolume = 0;

  for (const tri of triangles) {
    for (const v of tri.vertices) {
      minX = Math.min(minX, v.x);
      maxX = Math.max(maxX, v.x);
      minY = Math.min(minY, v.y);
      maxY = Math.max(maxY, v.y);
      minZ = Math.min(minZ, v.z);
      maxZ = Math.max(maxZ, v.z);
      uniqueVertices.add(`${v.x.toFixed(6)},${v.y.toFixed(6)},${v.z.toFixed(6)}`);
    }

    // Calculate triangle area (cross product method)
    surfaceArea += calculateTriangleArea(tri.vertices);

    // Calculate signed volume contribution (for watertight meshes)
    signedVolume += calculateSignedVolumeContribution(tri.vertices);
  }

  const width = maxX - minX || 1;
  const height = maxY - minY || 1;
  const depth = maxZ - minZ || 1;

  // Detect units based on dimension heuristics
  const { unit, confidence } = detectUnits(width, height, depth);

  // Calculate complexity based on triangle count
  const complexity = categorizeComplexity(triangles.length);

  // Calculate aspect ratio
  const aspectRatio = calculateAspectRatio(width, height, depth);

  return {
    boundingBox: { minX, maxX, minY, maxY, minZ, maxZ },
    dimensions: { width, height, depth },
    triangleCount: triangles.length,
    vertexCount: uniqueVertices.size,
    surfaceArea,
    volumeEstimate: Math.abs(signedVolume),
    detectedUnit: unit,
    unitConfidence: confidence,
    complexity,
    aspectRatio,
  };
}

function getEmptyMetrics(): GeometryMetrics {
  return {
    boundingBox: { minX: 0, maxX: 0, minY: 0, maxY: 0, minZ: 0, maxZ: 0 },
    dimensions: { width: 0, height: 0, depth: 0 },
    triangleCount: 0,
    vertexCount: 0,
    surfaceArea: 0,
    volumeEstimate: 0,
    detectedUnit: "unknown",
    unitConfidence: "low",
    complexity: "simple",
    aspectRatio: "1:1:1",
  };
}

/**
 * Detect measurement units based on dimension heuristics
 * Common 3D print sizes: 20-300mm typical, >1000mm rare
 * Inch models typically: 0.5-12 inches (12.7-304.8mm equivalent)
 */
function detectUnits(
  width: number,
  height: number,
  depth: number
): { unit: "mm" | "inches" | "unknown"; confidence: "high" | "medium" | "low" } {
  const maxDim = Math.max(width, height, depth);
  const minDim = Math.min(width, height, depth);

  // Very small dimensions (<1) suggest inches or micro-scale
  if (maxDim < 1 && minDim > 0.01) {
    // Likely inches - convert to mm equivalent to check
    const mmEquiv = maxDim * 25.4;
    if (mmEquiv >= 10 && mmEquiv <= 500) {
      return { unit: "inches", confidence: "high" };
    }
  }

  // Typical 3D print range in mm: 10-300mm
  if (maxDim >= 10 && maxDim <= 300 && minDim >= 1) {
    return { unit: "mm", confidence: "high" };
  }

  // Larger models in mm: 300-1000mm
  if (maxDim > 300 && maxDim <= 1000) {
    return { unit: "mm", confidence: "medium" };
  }

  // Very small in mm context (miniatures): 5-50mm
  if (maxDim >= 5 && maxDim < 50 && minDim >= 0.5) {
    return { unit: "mm", confidence: "medium" };
  }

  // Inch range: 0.5-24 inches common
  if (maxDim >= 0.5 && maxDim <= 24 && minDim >= 0.1) {
    return { unit: "inches", confidence: "medium" };
  }

  // Large dimensions might be inches or very large mm
  if (maxDim > 1000) {
    // Could be mm for large CNC or inches misinterpreted
    return { unit: "unknown", confidence: "low" };
  }

  return { unit: "unknown", confidence: "low" };
}

function calculateTriangleArea(
  vertices: [
    { x: number; y: number; z: number },
    { x: number; y: number; z: number },
    { x: number; y: number; z: number }
  ]
): number {
  const [v0, v1, v2] = vertices;
  const ax = v1.x - v0.x,
    ay = v1.y - v0.y,
    az = v1.z - v0.z;
  const bx = v2.x - v0.x,
    by = v2.y - v0.y,
    bz = v2.z - v0.z;
  // Cross product
  const cx = ay * bz - az * by;
  const cy = az * bx - ax * bz;
  const cz = ax * by - ay * bx;
  return 0.5 * Math.sqrt(cx * cx + cy * cy + cz * cz);
}

function calculateSignedVolumeContribution(
  vertices: [
    { x: number; y: number; z: number },
    { x: number; y: number; z: number },
    { x: number; y: number; z: number }
  ]
): number {
  const [v0, v1, v2] = vertices;
  // Signed volume of tetrahedron formed with origin
  return (
    (v0.x * (v1.y * v2.z - v2.y * v1.z) +
      v1.x * (v2.y * v0.z - v0.y * v2.z) +
      v2.x * (v0.y * v1.z - v1.y * v0.z)) /
    6.0
  );
}

function categorizeComplexity(
  triangleCount: number
): "simple" | "moderate" | "complex" | "highly-complex" {
  if (triangleCount < 500) return "simple";
  if (triangleCount < 5000) return "moderate";
  if (triangleCount < 50000) return "complex";
  return "highly-complex";
}

function calculateAspectRatio(width: number, height: number, depth: number): string {
  const min = Math.min(width, height, depth);
  if (min === 0) return "1:1:1";
  const w = (width / min).toFixed(1);
  const h = (height / min).toFixed(1);
  const d = (depth / min).toFixed(1);
  return `${w}:${h}:${d}`;
}

/**
 * Format dimensions for display based on detected units
 */
export function formatDimensions(metrics: GeometryMetrics): string {
  const { width, height, depth } = metrics.dimensions;
  const unit = metrics.detectedUnit;

  if (unit === "mm") {
    return `${width.toFixed(1)} x ${height.toFixed(1)} x ${depth.toFixed(1)} mm`;
  } else if (unit === "inches") {
    return `${width.toFixed(2)} x ${height.toFixed(2)} x ${depth.toFixed(2)} in`;
  } else {
    // Unknown units - show raw values
    return `${width.toFixed(1)} x ${height.toFixed(1)} x ${depth.toFixed(1)} units`;
  }
}

/**
 * Format volume for display
 */
export function formatVolume(volumeCubic: number, unit: "mm" | "inches" | "unknown"): string {
  if (unit === "mm") {
    if (volumeCubic > 1000000) {
      return `${(volumeCubic / 1000000).toFixed(1)} cm³`;
    }
    return `${volumeCubic.toLocaleString(undefined, { maximumFractionDigits: 0 })} mm³`;
  } else if (unit === "inches") {
    return `${volumeCubic.toFixed(2)} in³`;
  }
  return `${volumeCubic.toLocaleString(undefined, { maximumFractionDigits: 0 })} units³`;
}

/**
 * Format surface area for display
 */
export function formatSurfaceArea(area: number, unit: "mm" | "inches" | "unknown"): string {
  if (unit === "mm") {
    if (area > 10000) {
      return `${(area / 100).toFixed(1)} cm²`;
    }
    return `${area.toLocaleString(undefined, { maximumFractionDigits: 0 })} mm²`;
  } else if (unit === "inches") {
    return `${area.toFixed(2)} in²`;
  }
  return `${area.toLocaleString(undefined, { maximumFractionDigits: 0 })} units²`;
}

/**
 * Estimate material usage based on volume and filament type
 * Assumes PLA density for estimation
 */
export function estimateMaterialUsage(
  volumeCubicUnits: number,
  unit: "mm" | "inches" | "unknown",
  infillPercent: number = 20
): { grams: number; metersFilament: number } {
  // Convert to mm³ if needed
  let volumeCubicMm = volumeCubicUnits;
  if (unit === "inches") {
    // 1 inch³ = 16387.064 mm³
    volumeCubicMm = volumeCubicUnits * 16387.064;
  }

  // Convert mm³ to cm³
  const volumeCm3 = volumeCubicMm / 1000;

  // PLA density ~1.24 g/cm³, ABS ~1.04 g/cm³ - use average
  const avgDensity = 1.14; // g/cm³

  // Account for infill (shell + infill)
  // Shell typically 10-30% of volume, rest is infill
  const shellPercent = 0.25;
  const effectiveVolume = volumeCm3 * (shellPercent + (1 - shellPercent) * (infillPercent / 100));
  const grams = effectiveVolume * avgDensity;

  // 1.75mm filament: ~1g per 0.33m approximately
  const metersFilament = grams * 0.33;

  return {
    grams: Math.round(grams),
    metersFilament: Math.round(metersFilament * 10) / 10,
  };
}

/**
 * Get a human-readable complexity description
 */
export function getComplexityDescription(metrics: GeometryMetrics): string {
  const { complexity, triangleCount } = metrics;
  const countStr = triangleCount.toLocaleString();

  switch (complexity) {
    case "simple":
      return `Simple (${countStr} triangles) - Quick to print, minimal detail`;
    case "moderate":
      return `Moderate (${countStr} triangles) - Good detail, reasonable print time`;
    case "complex":
      return `Complex (${countStr} triangles) - High detail, longer print time`;
    case "highly-complex":
      return `Highly complex (${countStr} triangles) - Very detailed, long print time`;
  }
}
