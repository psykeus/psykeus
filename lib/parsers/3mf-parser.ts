/**
 * 3MF file parser for server-side preview generation
 * 3MF files are ZIP archives containing XML mesh data
 * Main model data is in 3D/3dmodel.model
 */

import { promisify } from "util";
import { gunzip } from "zlib";
import { Vector3, calculateNormal } from "./math-utils";

const gunzipAsync = promisify(gunzip);

// Re-export Vector3 for backwards compatibility
export type { Vector3 };

export interface ThreeMfTriangle {
  normal: Vector3;
  vertices: [Vector3, Vector3, Vector3];
}

export interface ThreeMfParseResult {
  triangles: ThreeMfTriangle[];
  vertexCount: number;
  faceCount: number;
}

/**
 * Parse 3MF buffer and return triangles
 * 3MF is a ZIP file containing XML model data
 */
export async function parse3mfBuffer(buffer: Buffer): Promise<ThreeMfParseResult> {
  // 3MF files are ZIP archives - we need to extract and parse the XML
  const JSZip = (await import("jszip")).default;

  const zip = await JSZip.loadAsync(buffer);

  // Find the 3D model file (usually 3D/3dmodel.model)
  let modelContent: string | null = null;

  // Try common paths for the 3D model
  const possiblePaths = [
    "3D/3dmodel.model",
    "3d/3dmodel.model",
    "3D/3DModel.model",
  ];

  for (const path of possiblePaths) {
    const file = zip.file(path);
    if (file) {
      modelContent = await file.async("string");
      break;
    }
  }

  // If not found by name, search for any .model file
  if (!modelContent) {
    const files = Object.keys(zip.files);
    for (const filename of files) {
      if (filename.toLowerCase().endsWith(".model")) {
        const file = zip.file(filename);
        if (file) {
          modelContent = await file.async("string");
          break;
        }
      }
    }
  }

  if (!modelContent) {
    throw new Error("No 3D model file found in 3MF archive");
  }

  // Parse the XML model content
  return parseModelXml(modelContent);
}

/**
 * Parse the 3MF model XML and extract triangles
 */
function parseModelXml(xmlContent: string): ThreeMfParseResult {
  const triangles: ThreeMfTriangle[] = [];
  const vertices: Vector3[] = [];

  // Extract vertices using regex (simple but effective for 3MF structure)
  const vertexRegex = /<vertex\s+x="([^"]+)"\s+y="([^"]+)"\s+z="([^"]+)"/gi;
  let match;

  while ((match = vertexRegex.exec(xmlContent)) !== null) {
    vertices.push({
      x: parseFloat(match[1]),
      y: parseFloat(match[2]),
      z: parseFloat(match[3]),
    });
  }

  if (vertices.length === 0) {
    // Try alternative attribute order
    const altVertexRegex = /<vertex[^>]*\bx\s*=\s*"([^"]+)"[^>]*\by\s*=\s*"([^"]+)"[^>]*\bz\s*=\s*"([^"]+)"/gi;
    while ((match = altVertexRegex.exec(xmlContent)) !== null) {
      vertices.push({
        x: parseFloat(match[1]),
        y: parseFloat(match[2]),
        z: parseFloat(match[3]),
      });
    }
  }

  // Extract triangles
  const triangleRegex = /<triangle\s+v1="(\d+)"\s+v2="(\d+)"\s+v3="(\d+)"/gi;

  while ((match = triangleRegex.exec(xmlContent)) !== null) {
    const v1Index = parseInt(match[1], 10);
    const v2Index = parseInt(match[2], 10);
    const v3Index = parseInt(match[3], 10);

    if (v1Index < vertices.length && v2Index < vertices.length && v3Index < vertices.length) {
      const v0 = vertices[v1Index];
      const v1 = vertices[v2Index];
      const v2 = vertices[v3Index];

      // Calculate face normal
      const normal = calculateNormal(v0, v1, v2);

      triangles.push({
        normal,
        vertices: [v0, v1, v2],
      });
    }
  }

  // Try alternative attribute patterns if no triangles found
  if (triangles.length === 0) {
    const altTriangleRegex = /<triangle[^>]*\bv1\s*=\s*"(\d+)"[^>]*\bv2\s*=\s*"(\d+)"[^>]*\bv3\s*=\s*"(\d+)"/gi;

    while ((match = altTriangleRegex.exec(xmlContent)) !== null) {
      const v1Index = parseInt(match[1], 10);
      const v2Index = parseInt(match[2], 10);
      const v3Index = parseInt(match[3], 10);

      if (v1Index < vertices.length && v2Index < vertices.length && v3Index < vertices.length) {
        const v0 = vertices[v1Index];
        const v1 = vertices[v2Index];
        const v2 = vertices[v3Index];

        const normal = calculateNormal(v0, v1, v2);

        triangles.push({
          normal,
          vertices: [v0, v1, v2],
        });
      }
    }
  }

  return {
    triangles,
    vertexCount: vertices.length,
    faceCount: triangles.length,
  };
}

// calculateNormal is now imported from ./math-utils
