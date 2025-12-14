/**
 * OBJ file parser for server-side preview generation
 * Parses Wavefront OBJ format and returns triangle data compatible with STL renderer
 */

import { Vector3, calculateNormal } from "./math-utils";

// Re-export Vector3 for backwards compatibility
export type { Vector3 };

export interface ObjTriangle {
  normal: Vector3;
  vertices: [Vector3, Vector3, Vector3];
}

export interface ObjParseResult {
  triangles: ObjTriangle[];
  vertexCount: number;
  faceCount: number;
}

/**
 * Parse OBJ file content and return triangles
 */
export function parseObj(content: string): ObjParseResult {
  const vertices: Vector3[] = [];
  const normals: Vector3[] = [];
  const triangles: ObjTriangle[] = [];
  let faceCount = 0;

  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) continue;

    const parts = trimmed.split(/\s+/);
    const command = parts[0];

    switch (command) {
      case 'v': // Vertex position
        if (parts.length >= 4) {
          vertices.push({
            x: parseFloat(parts[1]) || 0,
            y: parseFloat(parts[2]) || 0,
            z: parseFloat(parts[3]) || 0,
          });
        }
        break;

      case 'vn': // Vertex normal
        if (parts.length >= 4) {
          normals.push({
            x: parseFloat(parts[1]) || 0,
            y: parseFloat(parts[2]) || 0,
            z: parseFloat(parts[3]) || 0,
          });
        }
        break;

      case 'f': // Face
        if (parts.length >= 4) {
          faceCount++;
          const faceVertices = parseFaceVertices(parts.slice(1), vertices, normals);

          // Triangulate face (handle quads and n-gons)
          const faceTriangles = triangulateFace(faceVertices);
          triangles.push(...faceTriangles);
        }
        break;
    }
  }

  return {
    triangles,
    vertexCount: vertices.length,
    faceCount,
  };
}

interface FaceVertex {
  position: Vector3;
  normal: Vector3 | null;
}

/**
 * Parse face vertex indices and resolve to actual vertex data
 * Format: v, v/vt, v/vt/vn, or v//vn
 */
function parseFaceVertices(
  parts: string[],
  vertices: Vector3[],
  normals: Vector3[]
): FaceVertex[] {
  const faceVertices: FaceVertex[] = [];

  for (const part of parts) {
    const indices = part.split('/');

    // Vertex index (1-based in OBJ)
    const vIndex = parseInt(indices[0], 10);
    const position = vertices[vIndex - 1] || { x: 0, y: 0, z: 0 };

    // Normal index (optional, position 2 after texture coord)
    let normal: Vector3 | null = null;
    if (indices.length >= 3 && indices[2]) {
      const vnIndex = parseInt(indices[2], 10);
      normal = normals[vnIndex - 1] || null;
    }

    faceVertices.push({ position, normal });
  }

  return faceVertices;
}

/**
 * Triangulate a face (convert quads and n-gons to triangles)
 * Uses fan triangulation from first vertex
 */
function triangulateFace(faceVertices: FaceVertex[]): ObjTriangle[] {
  const triangles: ObjTriangle[] = [];

  if (faceVertices.length < 3) return triangles;

  // Fan triangulation: create triangles from first vertex
  for (let i = 1; i < faceVertices.length - 1; i++) {
    const v0 = faceVertices[0];
    const v1 = faceVertices[i];
    const v2 = faceVertices[i + 1];

    // Calculate face normal if not provided
    let normal: Vector3;
    if (v0.normal && v1.normal && v2.normal) {
      // Average the vertex normals
      normal = {
        x: (v0.normal.x + v1.normal.x + v2.normal.x) / 3,
        y: (v0.normal.y + v1.normal.y + v2.normal.y) / 3,
        z: (v0.normal.z + v1.normal.z + v2.normal.z) / 3,
      };
    } else {
      // Calculate from cross product
      normal = calculateNormal(v0.position, v1.position, v2.position);
    }

    triangles.push({
      normal,
      vertices: [v0.position, v1.position, v2.position],
    });
  }

  return triangles;
}

// calculateNormal is now imported from ./math-utils

/**
 * Parse OBJ from buffer
 */
export function parseObjBuffer(buffer: Buffer): ObjParseResult {
  return parseObj(buffer.toString('utf-8'));
}
