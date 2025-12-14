/**
 * GLTF/GLB file parser for server-side preview generation
 * Uses @gltf-transform/core to parse GLTF/GLB and extract triangle data
 */

import { Document, NodeIO } from "@gltf-transform/core";
import { Vector3, calculateNormal } from "./math-utils";

// Re-export Vector3 for backwards compatibility
export type { Vector3 };

export interface GltfTriangle {
  normal: Vector3;
  vertices: [Vector3, Vector3, Vector3];
}

export interface GltfParseResult {
  triangles: GltfTriangle[];
  vertexCount: number;
  faceCount: number;
}

/**
 * Parse GLTF/GLB buffer and return triangles
 */
export async function parseGltfBuffer(buffer: Buffer, isGlb: boolean = true): Promise<GltfParseResult> {
  const io = new NodeIO();

  let document: Document;
  if (isGlb) {
    document = await io.readBinary(new Uint8Array(buffer));
  } else {
    // For .gltf files (JSON), parse as string
    const json = JSON.parse(buffer.toString("utf-8"));
    document = await io.readJSON({ json, resources: {} });
  }

  const triangles: GltfTriangle[] = [];
  let vertexCount = 0;
  let faceCount = 0;

  // Iterate through all meshes in the document
  const root = document.getRoot();
  const meshes = root.listMeshes();

  for (const mesh of meshes) {
    const primitives = mesh.listPrimitives();

    for (const primitive of primitives) {
      // Get position attribute
      const positionAccessor = primitive.getAttribute("POSITION");
      if (!positionAccessor) continue;

      const positions = positionAccessor.getArray();
      if (!positions) continue;

      // Get normal attribute (optional)
      const normalAccessor = primitive.getAttribute("NORMAL");
      const normals = normalAccessor?.getArray();

      // Get indices (optional - if not present, use sequential vertices)
      const indicesAccessor = primitive.getIndices();
      const indices = indicesAccessor?.getArray();

      vertexCount += positionAccessor.getCount();

      if (indices) {
        // Indexed geometry
        for (let i = 0; i < indices.length; i += 3) {
          const i0 = indices[i];
          const i1 = indices[i + 1];
          const i2 = indices[i + 2];

          const v0: Vector3 = {
            x: positions[i0 * 3],
            y: positions[i0 * 3 + 1],
            z: positions[i0 * 3 + 2],
          };
          const v1: Vector3 = {
            x: positions[i1 * 3],
            y: positions[i1 * 3 + 1],
            z: positions[i1 * 3 + 2],
          };
          const v2: Vector3 = {
            x: positions[i2 * 3],
            y: positions[i2 * 3 + 1],
            z: positions[i2 * 3 + 2],
          };

          let normal: Vector3;
          if (normals) {
            // Average the vertex normals
            normal = {
              x: (normals[i0 * 3] + normals[i1 * 3] + normals[i2 * 3]) / 3,
              y: (normals[i0 * 3 + 1] + normals[i1 * 3 + 1] + normals[i2 * 3 + 1]) / 3,
              z: (normals[i0 * 3 + 2] + normals[i1 * 3 + 2] + normals[i2 * 3 + 2]) / 3,
            };
          } else {
            // Calculate from cross product
            normal = calculateNormal(v0, v1, v2);
          }

          triangles.push({ normal, vertices: [v0, v1, v2] });
          faceCount++;
        }
      } else {
        // Non-indexed geometry (sequential triangles)
        for (let i = 0; i < positions.length; i += 9) {
          const v0: Vector3 = {
            x: positions[i],
            y: positions[i + 1],
            z: positions[i + 2],
          };
          const v1: Vector3 = {
            x: positions[i + 3],
            y: positions[i + 4],
            z: positions[i + 5],
          };
          const v2: Vector3 = {
            x: positions[i + 6],
            y: positions[i + 7],
            z: positions[i + 8],
          };

          let normal: Vector3;
          if (normals) {
            normal = {
              x: (normals[i] + normals[i + 3] + normals[i + 6]) / 3,
              y: (normals[i + 1] + normals[i + 4] + normals[i + 7]) / 3,
              z: (normals[i + 2] + normals[i + 5] + normals[i + 8]) / 3,
            };
          } else {
            normal = calculateNormal(v0, v1, v2);
          }

          triangles.push({ normal, vertices: [v0, v1, v2] });
          faceCount++;
        }
      }
    }
  }

  return { triangles, vertexCount, faceCount };
}

// calculateNormal is now imported from ./math-utils
