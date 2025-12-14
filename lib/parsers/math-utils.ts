/**
 * Shared 3D math utilities for parser modules
 *
 * This file contains common 3D math types and functions used across
 * multiple parser files (STL, OBJ, GLTF, 3MF).
 */

// =============================================================================
// Types
// =============================================================================

/**
 * 3D vector representation
 */
export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

/**
 * Triangle with normal and three vertices
 */
export interface Triangle {
  normal: Vector3;
  vertices: [Vector3, Vector3, Vector3];
}

/**
 * Bounding box for 3D geometry
 */
export interface BoundingBox {
  min: Vector3;
  max: Vector3;
}

// =============================================================================
// Vector Operations
// =============================================================================

/**
 * Create a new Vector3
 */
export function vec3(x: number, y: number, z: number): Vector3 {
  return { x, y, z };
}

/**
 * Add two vectors
 */
export function addVec3(a: Vector3, b: Vector3): Vector3 {
  return {
    x: a.x + b.x,
    y: a.y + b.y,
    z: a.z + b.z,
  };
}

/**
 * Subtract vector b from vector a
 */
export function subtractVec3(a: Vector3, b: Vector3): Vector3 {
  return {
    x: a.x - b.x,
    y: a.y - b.y,
    z: a.z - b.z,
  };
}

/**
 * Scale a vector by a scalar value
 */
export function scaleVec3(v: Vector3, scalar: number): Vector3 {
  return {
    x: v.x * scalar,
    y: v.y * scalar,
    z: v.z * scalar,
  };
}

/**
 * Calculate the length (magnitude) of a vector
 */
export function lengthVec3(v: Vector3): number {
  return Math.sqrt(v.x ** 2 + v.y ** 2 + v.z ** 2);
}

/**
 * Normalize a vector to unit length
 * Returns zero vector if input has zero length
 */
export function normalizeVec3(v: Vector3): Vector3 {
  const len = lengthVec3(v);
  if (len === 0) {
    return { x: 0, y: 0, z: 0 };
  }
  return {
    x: v.x / len,
    y: v.y / len,
    z: v.z / len,
  };
}

/**
 * Calculate dot product of two vectors
 */
export function dotVec3(a: Vector3, b: Vector3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

/**
 * Calculate cross product of two vectors
 */
export function crossVec3(a: Vector3, b: Vector3): Vector3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

// =============================================================================
// Normal Calculation
// =============================================================================

/**
 * Calculate face normal from three vertices using cross product
 *
 * This function computes the normalized cross product of two edge vectors
 * to determine the face normal. The winding order (v0 -> v1 -> v2) determines
 * the direction of the normal (counter-clockwise = outward facing).
 *
 * @param v0 - First vertex of the triangle
 * @param v1 - Second vertex of the triangle
 * @param v2 - Third vertex of the triangle
 * @returns Normalized face normal vector
 */
export function calculateNormal(v0: Vector3, v1: Vector3, v2: Vector3): Vector3 {
  // Edge vectors from v0 to v1 and v0 to v2
  const e1: Vector3 = {
    x: v1.x - v0.x,
    y: v1.y - v0.y,
    z: v1.z - v0.z,
  };
  const e2: Vector3 = {
    x: v2.x - v0.x,
    y: v2.y - v0.y,
    z: v2.z - v0.z,
  };

  // Cross product gives the normal direction
  const normal: Vector3 = {
    x: e1.y * e2.z - e1.z * e2.y,
    y: e1.z * e2.x - e1.x * e2.z,
    z: e1.x * e2.y - e1.y * e2.x,
  };

  // Normalize to unit length
  const length = Math.sqrt(normal.x ** 2 + normal.y ** 2 + normal.z ** 2);
  if (length > 0) {
    normal.x /= length;
    normal.y /= length;
    normal.z /= length;
  }

  return normal;
}

// =============================================================================
// Bounding Box
// =============================================================================

/**
 * Calculate bounding box from an array of vertices
 */
export function calculateBoundingBox(vertices: Vector3[]): BoundingBox {
  if (vertices.length === 0) {
    return {
      min: { x: 0, y: 0, z: 0 },
      max: { x: 0, y: 0, z: 0 },
    };
  }

  const min: Vector3 = {
    x: Infinity,
    y: Infinity,
    z: Infinity,
  };
  const max: Vector3 = {
    x: -Infinity,
    y: -Infinity,
    z: -Infinity,
  };

  for (const v of vertices) {
    min.x = Math.min(min.x, v.x);
    min.y = Math.min(min.y, v.y);
    min.z = Math.min(min.z, v.z);
    max.x = Math.max(max.x, v.x);
    max.y = Math.max(max.y, v.y);
    max.z = Math.max(max.z, v.z);
  }

  return { min, max };
}

/**
 * Calculate the center of a bounding box
 */
export function boundingBoxCenter(bbox: BoundingBox): Vector3 {
  return {
    x: (bbox.min.x + bbox.max.x) / 2,
    y: (bbox.min.y + bbox.max.y) / 2,
    z: (bbox.min.z + bbox.max.z) / 2,
  };
}

/**
 * Calculate the dimensions of a bounding box
 */
export function boundingBoxSize(bbox: BoundingBox): Vector3 {
  return {
    x: bbox.max.x - bbox.min.x,
    y: bbox.max.y - bbox.min.y,
    z: bbox.max.z - bbox.min.z,
  };
}
