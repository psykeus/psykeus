/**
 * Unified 3D model parser exports
 * Re-exports all parsers for convenient importing
 */

// Math utilities (shared types and functions)
export {
  type Vector3,
  type Triangle as MathTriangle,
  type BoundingBox,
  vec3,
  calculateNormal,
  calculateBoundingBox,
  boundingBoxCenter,
  boundingBoxSize,
  addVec3,
  subtractVec3,
  scaleVec3,
  normalizeVec3,
  lengthVec3,
  dotVec3,
  crossVec3,
} from "./math-utils";

// STL Parser
export {
  parseStlBuffer,
  toGenericTriangles,
  type StlTriangle,
  type StlParseResult,
} from "./stl-parser";

// OBJ Parser
export {
  parseObj,
  parseObjBuffer,
  type ObjTriangle,
  type ObjParseResult,
} from "./obj-parser";

// GLTF/GLB Parser
export {
  parseGltfBuffer,
  type GltfTriangle,
  type GltfParseResult,
} from "./gltf-parser";

// 3MF Parser
export {
  parse3mfBuffer,
  type ThreeMfTriangle,
  type ThreeMfParseResult,
} from "./3mf-parser";

// G-code Parser
export {
  parseGcode,
  parseGcodeBuffer,
  type GcodePoint,
  type GcodeSegment,
  type GcodeParseResult,
} from "./gcode-parser";

/**
 * Common triangle interface compatible with all parsers
 * Each parser returns triangles in this format for preview rendering
 */
export interface Triangle {
  normal: { x: number; y: number; z: number };
  vertices: [
    { x: number; y: number; z: number },
    { x: number; y: number; z: number },
    { x: number; y: number; z: number }
  ];
}
