/**
 * STL file parser - supports both ASCII and binary formats
 */

import { Vector3 } from "./math-utils";

// Re-export Vector3 for backwards compatibility
export type { Vector3 };

export interface StlTriangle {
  normal: Vector3;
  vertices: [Vector3, Vector3, Vector3];
}

export interface StlParseResult {
  triangles: StlTriangle[];
  triangleCount: number;
  isAscii: boolean;
}

/**
 * Parse STL file buffer (supports both ASCII and binary formats)
 */
export function parseStlBuffer(buffer: Buffer): StlParseResult {
  // Check if ASCII or binary
  const header = buffer.slice(0, 80).toString("utf-8");
  const isAscii =
    header.toLowerCase().startsWith("solid") &&
    buffer.toString("utf-8", 0, 1000).includes("facet");

  const triangles = isAscii ? parseAsciiStl(buffer.toString("utf-8")) : parseBinaryStl(buffer);

  return {
    triangles,
    triangleCount: triangles.length,
    isAscii,
  };
}

/**
 * Parse ASCII STL format
 */
function parseAsciiStl(content: string): StlTriangle[] {
  const triangles: StlTriangle[] = [];
  const lines = content.split("\n").map((l) => l.trim().toLowerCase());

  let currentNormal: Vector3 = { x: 0, y: 0, z: 1 };
  let currentVertices: Vector3[] = [];

  for (const line of lines) {
    if (line.startsWith("facet normal")) {
      const parts = line.split(/\s+/);
      currentNormal = {
        x: parseFloat(parts[2]) || 0,
        y: parseFloat(parts[3]) || 0,
        z: parseFloat(parts[4]) || 0,
      };
      currentVertices = [];
    } else if (line.startsWith("vertex")) {
      const parts = line.split(/\s+/);
      currentVertices.push({
        x: parseFloat(parts[1]) || 0,
        y: parseFloat(parts[2]) || 0,
        z: parseFloat(parts[3]) || 0,
      });
    } else if (line.startsWith("endfacet")) {
      if (currentVertices.length === 3) {
        triangles.push({
          normal: currentNormal,
          vertices: [currentVertices[0], currentVertices[1], currentVertices[2]],
        });
      }
    }
  }

  return triangles;
}

/**
 * Parse binary STL format
 */
function parseBinaryStl(buffer: Buffer): StlTriangle[] {
  const triangles: StlTriangle[] = [];

  // Skip 80-byte header
  let offset = 80;

  // Read number of triangles (uint32)
  const numTriangles = buffer.readUInt32LE(offset);
  offset += 4;

  // Each triangle is 50 bytes:
  // - 12 bytes for normal (3 x float32)
  // - 36 bytes for vertices (3 x 3 x float32)
  // - 2 bytes for attribute byte count
  for (let i = 0; i < numTriangles && offset + 50 <= buffer.length; i++) {
    const normal: Vector3 = {
      x: buffer.readFloatLE(offset),
      y: buffer.readFloatLE(offset + 4),
      z: buffer.readFloatLE(offset + 8),
    };
    offset += 12;

    const vertices: [Vector3, Vector3, Vector3] = [
      {
        x: buffer.readFloatLE(offset),
        y: buffer.readFloatLE(offset + 4),
        z: buffer.readFloatLE(offset + 8),
      },
      {
        x: buffer.readFloatLE(offset + 12),
        y: buffer.readFloatLE(offset + 16),
        z: buffer.readFloatLE(offset + 20),
      },
      {
        x: buffer.readFloatLE(offset + 24),
        y: buffer.readFloatLE(offset + 28),
        z: buffer.readFloatLE(offset + 32),
      },
    ];
    offset += 36;

    // Skip attribute byte count
    offset += 2;

    triangles.push({ normal, vertices });
  }

  return triangles;
}

/**
 * Convert StlTriangle[] to the generic Triangle format used by geometry-analysis
 */
export function toGenericTriangles(
  stlTriangles: StlTriangle[]
): Array<{
  normal: { x: number; y: number; z: number };
  vertices: [
    { x: number; y: number; z: number },
    { x: number; y: number; z: number },
    { x: number; y: number; z: number }
  ];
}> {
  return stlTriangles.map((tri) => ({
    normal: tri.normal,
    vertices: tri.vertices,
  }));
}
