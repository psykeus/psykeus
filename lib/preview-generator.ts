/**
 * Preview Generator
 *
 * Generates preview images for various design file formats.
 * Uses server-side rendering (no GPU/WebGL) to create thumbnails
 * and preview images for the design library.
 *
 * Supported formats:
 * - 2D Vector: SVG, DXF, AI, EPS, PDF
 * - 3D Models: STL, OBJ, GLTF, GLB, 3MF
 * - Raster Images: PNG, JPG, WEBP
 * - CAD: DWG (limited support)
 *
 * @module lib/preview-generator
 */

import sharp from "sharp";
import {
  parseStlBuffer,
  parseObjBuffer,
  parseGltfBuffer,
  parse3mfBuffer,
  type StlTriangle,
  type ObjTriangle,
  type GltfTriangle,
  type ThreeMfTriangle,
  type Vector3,
} from "./parsers";
import { generatePhash } from "./phash";

// =============================================================================
// Types
// =============================================================================

export interface PreviewResult {
  success: boolean;
  buffer?: Buffer;
  phash?: string;
  error?: string;
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Maximum preview image dimension (width or height).
 * 1200px provides good quality on high-DPI displays while keeping file size reasonable.
 */
const PREVIEW_MAX_SIZE = 1200;

/**
 * Default timeout for preview generation in milliseconds.
 * Prevents runaway processes for very complex files.
 */
const DEFAULT_TIMEOUT_MS = 30000;

/**
 * Maximum triangles allowed for 3D preview generation.
 * Models exceeding this limit will skip preview entirely to prevent memory overflow.
 */
const MAX_TRIANGLES_FOR_PREVIEW = 500000;

/**
 * Target triangle count for subsampling.
 * Models between TARGET and MAX will be subsampled to this count.
 */
const TARGET_TRIANGLES_FOR_PREVIEW = 100000;

// =============================================================================
// Timeout Utilities
// =============================================================================

/**
 * Creates a promise that rejects after the specified timeout
 */
function createTimeout(ms: number, filename: string): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Preview generation timed out after ${ms}ms for ${filename}`));
    }, ms);
  });
}

/**
 * Generate a preview image from a design file buffer.
 * Supports: SVG, DXF, PDF, STL, OBJ, GLTF, GLB, AI, EPS, 3MF, DWG, PNG, JPG, WEBP
 * Returns PNG buffer and perceptual hash on success.
 *
 * @param buffer - The file buffer to generate preview from
 * @param fileType - The file extension/type
 * @param filename - The filename (for logging)
 * @param timeoutMs - Optional timeout in milliseconds (default: 30000)
 */
export async function generatePreview(
  buffer: Buffer,
  fileType: string,
  filename: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<PreviewResult> {
  // Wrap the actual generation with a timeout
  try {
    return await Promise.race([
      generatePreviewInternal(buffer, fileType, filename),
      createTimeout(timeoutMs, filename),
    ]);
  } catch (error) {
    console.error(`Preview generation error for ${filename}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Internal preview generation logic (without timeout wrapper)
 */
async function generatePreviewInternal(
  buffer: Buffer,
  fileType: string,
  filename: string
): Promise<PreviewResult> {
  const type = fileType.toLowerCase().replace(".", "");

  try {
    let result: PreviewResult;

    switch (type) {
      case "svg":
        result = await generateSvgPreview(buffer);
        break;
      case "dxf":
        result = await generateDxfPreview(buffer);
        break;
      case "pdf":
        result = await generatePdfPreview(buffer);
        break;
      case "stl":
        result = await generateStlPreview(buffer);
        break;
      case "obj":
        result = await generateObjPreview(buffer);
        break;
      case "gltf":
      case "glb":
        result = await generateGltfPreview(buffer, type);
        break;
      case "ai":
        result = await generateAiPreview(buffer);
        break;
      case "eps":
        result = await generateEpsPreview(buffer);
        break;
      case "3mf":
        result = await generate3mfPreview(buffer);
        break;
      case "dwg":
        result = await generateDwgPreview(buffer);
        break;
      case "gcode":
      case "nc":
      case "ngc":
      case "tap":
        result = await generateGcodePreview(buffer);
        break;
      case "png":
      case "jpg":
      case "jpeg":
      case "webp":
        result = await generateImagePreview(buffer);
        break;
      default:
        return {
          success: false,
          error: `Preview generation not supported for ${type} files`,
        };
    }

    // Generate perceptual hash from the preview image
    if (result.success && result.buffer) {
      try {
        result.phash = await generatePhash(result.buffer);
      } catch (phashError) {
        console.warn(`Phash generation warning for ${filename}:`, phashError);
        // Continue without phash - it's optional
      }
    }

    return result;
  } catch (error) {
    console.error(`Preview generation error for ${filename}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Generate preview from image files (PNG, JPG, JPEG, WEBP)
 * Images can serve as their own preview - just resize and convert to PNG
 */
async function generateImagePreview(buffer: Buffer): Promise<PreviewResult> {
  try {
    const pngBuffer = await sharp(buffer)
      .resize(PREVIEW_MAX_SIZE, PREVIEW_MAX_SIZE, {
        fit: "inside",
        withoutEnlargement: true,
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      })
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .png()
      .toBuffer();

    return { success: true, buffer: pngBuffer };
  } catch (error) {
    return {
      success: false,
      error: `Image conversion failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Generate preview from SVG using sharp
 */
async function generateSvgPreview(buffer: Buffer): Promise<PreviewResult> {
  try {
    const pngBuffer = await sharp(buffer)
      .resize(PREVIEW_MAX_SIZE, PREVIEW_MAX_SIZE, {
        fit: "inside",
        withoutEnlargement: true,
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      })
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .png()
      .toBuffer();

    return { success: true, buffer: pngBuffer };
  } catch (error) {
    return {
      success: false,
      error: `SVG conversion failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface ParsedDxf {
  entities: DxfEntity[];
  tables?: {
    layer?: {
      layers?: Record<string, DxfLayer>;
    };
  };
}

/**
 * Check if a parsed DXF file contains 3D geometry
 * Returns true if significant Z coordinate variation is detected
 */
function isDxf3D(dxf: ParsedDxf): boolean {
  // 3D entity types that indicate 3D content
  const threeDEntityTypes = ["3DFACE", "3DSOLID", "MESH", "SURFACE", "REGION"];

  let minZ = Infinity, maxZ = -Infinity;
  let hasZCoordinates = false;

  for (const entity of dxf.entities) {
    // Check for explicit 3D entity types
    if (threeDEntityTypes.includes(entity.type)) {
      return true;
    }

    // Check for 3DFACE corners
    if (entity.type === "3DFACE") {
      const corners = [entity.firstCorner, entity.secondCorner, entity.thirdCorner, entity.fourthCorner];
      for (const corner of corners) {
        if (corner && corner.z !== undefined) {
          minZ = Math.min(minZ, corner.z);
          maxZ = Math.max(maxZ, corner.z);
          hasZCoordinates = true;
        }
      }
    }

    // Check vertices for Z coordinates
    if (entity.vertices) {
      for (const v of entity.vertices) {
        if (v.z !== undefined && v.z !== 0) {
          minZ = Math.min(minZ, v.z);
          maxZ = Math.max(maxZ, v.z);
          hasZCoordinates = true;
        }
      }
    }

    // Check center point
    if (entity.center && entity.center.z !== undefined && entity.center.z !== 0) {
      minZ = Math.min(minZ, entity.center.z);
      maxZ = Math.max(maxZ, entity.center.z);
      hasZCoordinates = true;
    }

    // Check control points (splines)
    if (entity.controlPoints) {
      for (const cp of entity.controlPoints) {
        if (cp.z !== undefined && cp.z !== 0) {
          minZ = Math.min(minZ, cp.z);
          maxZ = Math.max(maxZ, cp.z);
          hasZCoordinates = true;
        }
      }
    }
  }

  // Consider it 3D if there's significant Z range (more than 1% of the overall model scale)
  if (hasZCoordinates && isFinite(minZ) && isFinite(maxZ)) {
    const zRange = maxZ - minZ;
    return zRange > 0.001; // Threshold for meaningful 3D content
  }

  return false;
}

/**
 * Generate preview from DXF using dxf-parser and canvas
 * Automatically detects 2D vs 3D and uses appropriate rendering
 */
async function generateDxfPreview(buffer: Buffer): Promise<PreviewResult> {
  try {
    // Dynamic imports for optional dependencies
    const DxfParser = (await import("dxf-parser")).default;
    const { createCanvas } = await import("canvas");

    const parser = new DxfParser();
    const dxfContent = buffer.toString("utf-8");
    const dxf = parser.parseSync(dxfContent) as ParsedDxf;

    if (!dxf || !dxf.entities || dxf.entities.length === 0) {
      return { success: false, error: "No entities found in DXF file" };
    }

    // Check if this is a 3D DXF
    if (isDxf3D(dxf)) {
      console.log("Detected 3D DXF file, using 3D preview generation");
      return await generateDxf3DPreview(dxf, createCanvas);
    }

    // 2D DXF rendering (existing code)
    // Calculate bounding box
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    for (const entity of dxf.entities) {
      const points = getEntityPoints(entity);
      for (const point of points) {
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
      }
    }

    // Handle empty or invalid bounds
    if (!isFinite(minX) || !isFinite(maxX)) {
      return { success: false, error: "Could not determine DXF bounds" };
    }

    const width = maxX - minX || 1;
    const height = maxY - minY || 1;
    const padding = Math.max(width, height) * 0.05;

    // Calculate scale to fit in preview size
    const scale = Math.min(
      (PREVIEW_MAX_SIZE - 40) / (width + padding * 2),
      (PREVIEW_MAX_SIZE - 40) / (height + padding * 2)
    );

    const canvasWidth = Math.ceil((width + padding * 2) * scale + 40);
    const canvasHeight = Math.ceil((height + padding * 2) * scale + 40);

    const canvas = createCanvas(canvasWidth, canvasHeight);
    const ctx = canvas.getContext("2d");

    // White background
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Set up drawing
    ctx.strokeStyle = "#333333";
    ctx.lineWidth = 1;
    ctx.translate(20, canvasHeight - 20);
    ctx.scale(scale, -scale);
    ctx.translate(-minX + padding, -minY + padding);

    // Draw entities
    for (const entity of dxf.entities) {
      drawEntity(ctx, entity, dxf.tables?.layer?.layers);
    }

    // Convert to PNG buffer
    const pngBuffer = canvas.toBuffer("image/png");

    return { success: true, buffer: pngBuffer };
  } catch (error) {
    console.error("DXF preview error:", error);
    return {
      success: false,
      error: `DXF conversion failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Generate 3D preview for DXF files with 3D geometry
 * Converts DXF 3D entities to triangles and renders multi-view preview
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function generateDxf3DPreview(dxf: ParsedDxf, createCanvas: any): Promise<PreviewResult> {
  try {
    // Extract triangles from 3D DXF entities
    const triangles: StlTriangle[] = [];

    for (const entity of dxf.entities) {
      const entityTriangles = extractTrianglesFromDxfEntity(entity);
      triangles.push(...entityTriangles);
    }

    if (triangles.length === 0) {
      // Fall back to wireframe rendering if no solid triangles found
      return await generateDxf3DWireframePreview(dxf, createCanvas);
    }

    // Use the shared multi-view renderer
    return await renderMultiViewPreview(triangles, createCanvas, 4);
  } catch (error) {
    console.error("3D DXF preview error:", error);
    return {
      success: false,
      error: `3D DXF conversion failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Extract triangles from a DXF entity for 3D rendering
 */
function extractTrianglesFromDxfEntity(entity: DxfEntity): StlTriangle[] {
  const triangles: StlTriangle[] = [];

  switch (entity.type) {
    case "3DFACE": {
      // 3DFACE has up to 4 corners, forms 1-2 triangles
      const corners = [
        entity.firstCorner,
        entity.secondCorner,
        entity.thirdCorner,
        entity.fourthCorner,
      ].filter((c): c is Point3D => c !== undefined);

      if (corners.length >= 3) {
        const v0: Vector3 = { x: corners[0].x, y: corners[0].y, z: corners[0].z || 0 };
        const v1: Vector3 = { x: corners[1].x, y: corners[1].y, z: corners[1].z || 0 };
        const v2: Vector3 = { x: corners[2].x, y: corners[2].y, z: corners[2].z || 0 };

        const normal = calculateTriangleNormal(v0, v1, v2);
        triangles.push({ normal, vertices: [v0, v1, v2] });

        // If 4 corners form a quad, add second triangle
        if (corners.length === 4) {
          const v3: Vector3 = { x: corners[3].x, y: corners[3].y, z: corners[3].z || 0 };
          triangles.push({ normal, vertices: [v0, v2, v3] });
        }
      }
      break;
    }

    case "POLYLINE":
    case "LWPOLYLINE": {
      // 3D polylines with faces - triangulate if they form a closed surface
      if (entity.vertices && entity.vertices.length >= 3) {
        const hasZ = entity.vertices.some(v => v.z !== undefined && v.z !== 0);
        if (hasZ) {
          // Fan triangulation from first vertex
          for (let i = 1; i < entity.vertices.length - 1; i++) {
            const v0: Vector3 = {
              x: entity.vertices[0].x,
              y: entity.vertices[0].y,
              z: entity.vertices[0].z || 0,
            };
            const v1: Vector3 = {
              x: entity.vertices[i].x,
              y: entity.vertices[i].y,
              z: entity.vertices[i].z || 0,
            };
            const v2: Vector3 = {
              x: entity.vertices[i + 1].x,
              y: entity.vertices[i + 1].y,
              z: entity.vertices[i + 1].z || 0,
            };

            const normal = calculateTriangleNormal(v0, v1, v2);
            triangles.push({ normal, vertices: [v0, v1, v2] });
          }
        }
      }
      break;
    }

    case "MESH": {
      // MESH entity - process vertex/face arrays
      // Note: Full mesh support would require parsing the mesh subentities
      break;
    }
  }

  return triangles;
}

/**
 * Calculate normal vector for a triangle
 */
function calculateTriangleNormal(v0: Vector3, v1: Vector3, v2: Vector3): Vector3 {
  const e1 = { x: v1.x - v0.x, y: v1.y - v0.y, z: v1.z - v0.z };
  const e2 = { x: v2.x - v0.x, y: v2.y - v0.y, z: v2.z - v0.z };

  const normal = {
    x: e1.y * e2.z - e1.z * e2.y,
    y: e1.z * e2.x - e1.x * e2.z,
    z: e1.x * e2.y - e1.y * e2.x,
  };

  const length = Math.sqrt(normal.x ** 2 + normal.y ** 2 + normal.z ** 2);
  if (length > 0) {
    normal.x /= length;
    normal.y /= length;
    normal.z /= length;
  }

  return normal;
}

/**
 * Generate wireframe 3D preview for DXF files when no solid geometry is found
 * Renders lines/polylines in 3D space
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function generateDxf3DWireframePreview(dxf: ParsedDxf, createCanvas: any): Promise<PreviewResult> {
  // Extract all 3D lines/edges from the DXF
  interface Line3D {
    start: Vector3;
    end: Vector3;
  }
  const lines: Line3D[] = [];

  // Calculate bounding box
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  for (const entity of dxf.entities) {
    const entityLines = extract3DLinesFromEntity(entity);
    for (const line of entityLines) {
      lines.push(line);
      minX = Math.min(minX, line.start.x, line.end.x);
      minY = Math.min(minY, line.start.y, line.end.y);
      minZ = Math.min(minZ, line.start.z, line.end.z);
      maxX = Math.max(maxX, line.start.x, line.end.x);
      maxY = Math.max(maxY, line.start.y, line.end.y);
      maxZ = Math.max(maxZ, line.start.z, line.end.z);
    }
  }

  if (lines.length === 0) {
    return { success: false, error: "No 3D geometry found in DXF" };
  }

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const centerZ = (minZ + maxZ) / 2;
  const sizeX = maxX - minX || 1;
  const sizeY = maxY - minY || 1;
  const sizeZ = maxZ - minZ || 1;
  const maxSize = Math.max(sizeX, sizeY, sizeZ);

  // Create 2x2 view grid
  const viewSize = 400;
  const canvas = createCanvas(viewSize * 2, viewSize * 2);
  const ctx = canvas.getContext("2d");

  const views = [
    { name: "Front", rotX: 0, rotY: 0, col: 0, row: 0 },
    { name: "Right", rotX: 0, rotY: Math.PI / 2, col: 1, row: 0 },
    { name: "Top", rotX: -Math.PI / 2, rotY: 0, col: 0, row: 1 },
    { name: "Isometric", rotX: -Math.PI / 6, rotY: Math.PI / 4, col: 1, row: 1 },
  ];

  for (const view of views) {
    const offsetX = view.col * viewSize;
    const offsetY = view.row * viewSize;

    // Draw background
    const gradient = ctx.createLinearGradient(offsetX, offsetY, offsetX, offsetY + viewSize);
    gradient.addColorStop(0, "#f0f4f8");
    gradient.addColorStop(1, "#d0d8e0");
    ctx.fillStyle = gradient;
    ctx.fillRect(offsetX, offsetY, viewSize, viewSize);

    const scale = (viewSize * 0.7) / maxSize;
    const cosX = Math.cos(view.rotX), sinX = Math.sin(view.rotX);
    const cosY = Math.cos(view.rotY), sinY = Math.sin(view.rotY);

    function projectPoint(x: number, y: number, z: number): { x: number; y: number } {
      let cx = x - centerX;
      let cy = y - centerY;
      let cz = z - centerZ;

      // Rotate Y
      let tx = cx * cosY + cz * sinY;
      let tz = -cx * sinY + cz * cosY;
      cx = tx;
      cz = tz;

      // Rotate X
      const ty = cy * cosX - cz * sinX;
      cy = ty;

      return {
        x: offsetX + viewSize / 2 + cx * scale,
        y: offsetY + viewSize / 2 - cy * scale,
      };
    }

    // Draw lines
    ctx.strokeStyle = "#333333";
    ctx.lineWidth = 1;
    for (const line of lines) {
      const p1 = projectPoint(line.start.x, line.start.y, line.start.z);
      const p2 = projectPoint(line.end.x, line.end.y, line.end.z);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }

    // View label
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.font = "bold 12px sans-serif";
    ctx.fillText(view.name, offsetX + 8, offsetY + 20);
  }

  // Grid lines
  ctx.strokeStyle = "rgba(0, 0, 0, 0.1)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(viewSize, 0);
  ctx.lineTo(viewSize, viewSize * 2);
  ctx.moveTo(0, viewSize);
  ctx.lineTo(viewSize * 2, viewSize);
  ctx.stroke();

  const pngBuffer = canvas.toBuffer("image/png");
  return { success: true, buffer: pngBuffer };
}

/**
 * Extract 3D line segments from a DXF entity
 */
function extract3DLinesFromEntity(entity: DxfEntity): Array<{ start: Vector3; end: Vector3 }> {
  const lines: Array<{ start: Vector3; end: Vector3 }> = [];

  switch (entity.type) {
    case "LINE":
      if (entity.vertices && entity.vertices.length >= 2) {
        lines.push({
          start: { x: entity.vertices[0].x, y: entity.vertices[0].y, z: entity.vertices[0].z || 0 },
          end: { x: entity.vertices[1].x, y: entity.vertices[1].y, z: entity.vertices[1].z || 0 },
        });
      }
      break;

    case "POLYLINE":
    case "LWPOLYLINE":
      if (entity.vertices && entity.vertices.length >= 2) {
        for (let i = 0; i < entity.vertices.length - 1; i++) {
          lines.push({
            start: { x: entity.vertices[i].x, y: entity.vertices[i].y, z: entity.vertices[i].z || 0 },
            end: { x: entity.vertices[i + 1].x, y: entity.vertices[i + 1].y, z: entity.vertices[i + 1].z || 0 },
          });
        }
      }
      break;

    case "3DFACE": {
      const corners = [
        entity.firstCorner,
        entity.secondCorner,
        entity.thirdCorner,
        entity.fourthCorner,
      ].filter((c): c is Point3D => c !== undefined);

      for (let i = 0; i < corners.length; i++) {
        const next = (i + 1) % corners.length;
        lines.push({
          start: { x: corners[i].x, y: corners[i].y, z: corners[i].z || 0 },
          end: { x: corners[next].x, y: corners[next].y, z: corners[next].z || 0 },
        });
      }
      break;
    }
  }

  return lines;
}

/**
 * Generate preview from PDF
 *
 * @status DISABLED - pdfjs-dist has compatibility issues with Node.js/Next.js
 * @issue "Object.defineProperty called on non-object" error when using pdfjs-dist
 * @workaround PDF files currently fall back to placeholder preview
 *
 * Potential solutions to explore:
 * 1. Use pdf-lib for simple PDF parsing
 * 2. Use pdf-poppler (requires system dependency)
 * 3. Use canvas-based rendering with pdf.js worker
 */
async function generatePdfPreview(_buffer: Buffer): Promise<PreviewResult> {
  return {
    success: false,
    error: "PDF preview generation is disabled due to compatibility issues",
  };
}

// Helper: Get points from DXF entity
interface Point {
  x: number;
  y: number;
}

interface Point3D {
  x: number;
  y: number;
  z?: number;
}

interface DxfEntity {
  type: string;
  vertices?: Point3D[];
  center?: Point3D;
  radius?: number;
  majorAxisEndPoint?: Point3D;
  axisRatio?: number;
  startPoint?: Point3D;
  endPoint?: Point3D;
  controlPoints?: Point3D[];
  position?: Point3D;
  layer?: string;
  // 3D face specific
  firstCorner?: Point3D;
  secondCorner?: Point3D;
  thirdCorner?: Point3D;
  fourthCorner?: Point3D;
}

interface DxfLayer {
  color?: number;
}

function getEntityPoints(entity: DxfEntity): Point[] {
  const points: Point[] = [];

  switch (entity.type) {
    case "LINE":
      if (entity.vertices) {
        points.push(...entity.vertices);
      }
      break;
    case "POLYLINE":
    case "LWPOLYLINE":
      if (entity.vertices) {
        points.push(...entity.vertices);
      }
      break;
    case "CIRCLE":
      if (entity.center && entity.radius) {
        points.push(
          { x: entity.center.x - entity.radius, y: entity.center.y },
          { x: entity.center.x + entity.radius, y: entity.center.y },
          { x: entity.center.x, y: entity.center.y - entity.radius },
          { x: entity.center.x, y: entity.center.y + entity.radius }
        );
      }
      break;
    case "ARC":
      if (entity.center && entity.radius) {
        points.push(
          { x: entity.center.x - entity.radius, y: entity.center.y },
          { x: entity.center.x + entity.radius, y: entity.center.y },
          { x: entity.center.x, y: entity.center.y - entity.radius },
          { x: entity.center.x, y: entity.center.y + entity.radius }
        );
      }
      break;
    case "ELLIPSE":
      if (entity.center && entity.majorAxisEndPoint) {
        const r1 = Math.sqrt(
          entity.majorAxisEndPoint.x ** 2 + entity.majorAxisEndPoint.y ** 2
        );
        const r2 = r1 * (entity.axisRatio || 1);
        points.push(
          { x: entity.center.x - r1, y: entity.center.y },
          { x: entity.center.x + r1, y: entity.center.y },
          { x: entity.center.x, y: entity.center.y - r2 },
          { x: entity.center.x, y: entity.center.y + r2 }
        );
      }
      break;
    case "SPLINE":
      if (entity.controlPoints) {
        points.push(...entity.controlPoints);
      }
      break;
    case "POINT":
      if (entity.position) {
        points.push(entity.position);
      }
      break;
  }

  return points;
}

// Helper: Draw DXF entity on canvas
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function drawEntity(ctx: any, entity: DxfEntity, layers?: Record<string, DxfLayer>): void {
  // Get color from layer if available
  if (layers && entity.layer && layers[entity.layer]) {
    const layerColor = layers[entity.layer].color;
    if (layerColor) {
      ctx.strokeStyle = dxfColorToHex(layerColor);
    }
  }

  switch (entity.type) {
    case "LINE":
      if (entity.vertices && entity.vertices.length >= 2) {
        ctx.beginPath();
        ctx.moveTo(entity.vertices[0].x, entity.vertices[0].y);
        ctx.lineTo(entity.vertices[1].x, entity.vertices[1].y);
        ctx.stroke();
      }
      break;

    case "POLYLINE":
    case "LWPOLYLINE":
      if (entity.vertices && entity.vertices.length > 0) {
        ctx.beginPath();
        ctx.moveTo(entity.vertices[0].x, entity.vertices[0].y);
        for (let i = 1; i < entity.vertices.length; i++) {
          ctx.lineTo(entity.vertices[i].x, entity.vertices[i].y);
        }
        ctx.stroke();
      }
      break;

    case "CIRCLE":
      if (entity.center && entity.radius) {
        ctx.beginPath();
        ctx.arc(entity.center.x, entity.center.y, entity.radius, 0, Math.PI * 2);
        ctx.stroke();
      }
      break;

    case "ARC":
      if (entity.center && entity.radius) {
        const startAngle = ((entity as { startAngle?: number }).startAngle || 0) * Math.PI / 180;
        const endAngle = ((entity as { endAngle?: number }).endAngle || 360) * Math.PI / 180;
        ctx.beginPath();
        ctx.arc(entity.center.x, entity.center.y, entity.radius, startAngle, endAngle);
        ctx.stroke();
      }
      break;

    case "ELLIPSE":
      if (entity.center && entity.majorAxisEndPoint) {
        const r1 = Math.sqrt(
          entity.majorAxisEndPoint.x ** 2 + entity.majorAxisEndPoint.y ** 2
        );
        const r2 = r1 * (entity.axisRatio || 1);
        const rotation = Math.atan2(entity.majorAxisEndPoint.y, entity.majorAxisEndPoint.x);
        ctx.beginPath();
        ctx.ellipse(entity.center.x, entity.center.y, r1, r2, rotation, 0, Math.PI * 2);
        ctx.stroke();
      }
      break;

    case "SPLINE":
      // Simplified spline rendering - draw as connected points
      if (entity.controlPoints && entity.controlPoints.length > 0) {
        ctx.beginPath();
        ctx.moveTo(entity.controlPoints[0].x, entity.controlPoints[0].y);
        for (let i = 1; i < entity.controlPoints.length; i++) {
          ctx.lineTo(entity.controlPoints[i].x, entity.controlPoints[i].y);
        }
        ctx.stroke();
      }
      break;

    case "POINT":
      if (entity.position) {
        ctx.beginPath();
        ctx.arc(entity.position.x, entity.position.y, 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
  }
}

// Convert DXF color index to hex
function dxfColorToHex(colorIndex: number): string {
  // AutoCAD Color Index (ACI) - simplified palette
  const colors: Record<number, string> = {
    1: "#FF0000", // Red
    2: "#FFFF00", // Yellow
    3: "#00FF00", // Green
    4: "#00FFFF", // Cyan
    5: "#0000FF", // Blue
    6: "#FF00FF", // Magenta
    7: "#000000", // White/Black
    8: "#808080", // Dark Gray
    9: "#C0C0C0", // Light Gray
  };

  return colors[colorIndex] || "#333333";
}

/**
 * Generate preview from STL (3D model) file
 * Renders a 2x2 grid with Front, Right, Top, and Isometric views
 * Uses the shared high-quality multi-view renderer
 */
async function generateStlPreview(buffer: Buffer): Promise<PreviewResult> {
  try {
    const { createCanvas } = await import("canvas");

    // Parse STL file (supports both ASCII and binary)
    const triangles = parseStlBuffer(buffer).triangles;

    if (triangles.length === 0) {
      return { success: false, error: "No triangles found in STL file" };
    }

    // Use the shared high-quality multi-view renderer (4 views for preview)
    return await renderMultiViewPreview(triangles, createCanvas, 4);
  } catch (error) {
    console.error("STL preview error:", error);
    return {
      success: false,
      error: `STL conversion failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Generate multi-view preview for STL files (6 angles in a grid)
 * Used for AI analysis to get a complete understanding of the 3D model
 */
export async function generateStlMultiViewPreview(buffer: Buffer): Promise<PreviewResult> {
  try {
    const { createCanvas } = await import("canvas");

    // Parse STL file
    const triangles = parseStlBuffer(buffer).triangles;

    if (triangles.length === 0) {
      return { success: false, error: "No triangles found in STL file" };
    }

    // Use shared enhanced multi-view renderer
    return await renderMultiViewPreview(triangles, createCanvas, 6);
  } catch (error) {
    console.error("STL multi-view preview error:", error);
    return {
      success: false,
      error: `STL multi-view failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Generate preview from OBJ (3D model) file
 * Renders a 2x2 grid with Front, Right, Top, and Isometric views
 */
async function generateObjPreview(buffer: Buffer): Promise<PreviewResult> {
  try {
    const { createCanvas } = await import("canvas");

    // Parse OBJ file
    const result = parseObjBuffer(buffer);

    if (result.triangles.length === 0) {
      return { success: false, error: "No triangles found in OBJ file" };
    }

    // Convert ObjTriangle to the format expected by renderMultiView
    const triangles: StlTriangle[] = result.triangles.map((tri: ObjTriangle) => ({
      normal: tri.normal,
      vertices: tri.vertices as [Vector3, Vector3, Vector3],
    }));

    // Use shared multi-view renderer
    return await renderMultiViewPreview(triangles, createCanvas, 4);
  } catch (error) {
    console.error("OBJ preview error:", error);
    return {
      success: false,
      error: `OBJ conversion failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Generate multi-view preview for OBJ files (6 angles for AI analysis)
 */
export async function generateObjMultiViewPreview(buffer: Buffer): Promise<PreviewResult> {
  try {
    const { createCanvas } = await import("canvas");

    const result = parseObjBuffer(buffer);

    if (result.triangles.length === 0) {
      return { success: false, error: "No triangles found in OBJ file" };
    }

    const triangles: StlTriangle[] = result.triangles.map((tri: ObjTriangle) => ({
      normal: tri.normal,
      vertices: tri.vertices as [Vector3, Vector3, Vector3],
    }));

    return await renderMultiViewPreview(triangles, createCanvas, 6);
  } catch (error) {
    console.error("OBJ multi-view preview error:", error);
    return {
      success: false,
      error: `OBJ multi-view failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Generate preview from GLTF/GLB (3D model) file
 * Renders a 2x2 grid with Front, Right, Top, and Isometric views
 */
async function generateGltfPreview(buffer: Buffer, type: string): Promise<PreviewResult> {
  try {
    const { createCanvas } = await import("canvas");

    // Parse GLTF/GLB file
    const isGlb = type.toLowerCase() === "glb";
    const result = await parseGltfBuffer(buffer, isGlb);

    if (result.triangles.length === 0) {
      return { success: false, error: "No triangles found in GLTF file" };
    }

    // Convert GltfTriangle to the format expected by renderMultiView
    const triangles: StlTriangle[] = result.triangles.map((tri: GltfTriangle) => ({
      normal: tri.normal,
      vertices: tri.vertices as [Vector3, Vector3, Vector3],
    }));

    // Use shared multi-view renderer
    return await renderMultiViewPreview(triangles, createCanvas, 4);
  } catch (error) {
    console.error("GLTF preview error:", error);
    return {
      success: false,
      error: `GLTF conversion failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Generate multi-view preview for GLTF/GLB files (6 angles for AI analysis)
 */
export async function generateGltfMultiViewPreview(buffer: Buffer, type: string): Promise<PreviewResult> {
  try {
    const { createCanvas } = await import("canvas");

    const isGlb = type.toLowerCase() === "glb";
    const result = await parseGltfBuffer(buffer, isGlb);

    if (result.triangles.length === 0) {
      return { success: false, error: "No triangles found in GLTF file" };
    }

    const triangles: StlTriangle[] = result.triangles.map((tri: GltfTriangle) => ({
      normal: tri.normal,
      vertices: tri.vertices as [Vector3, Vector3, Vector3],
    }));

    return await renderMultiViewPreview(triangles, createCanvas, 6);
  } catch (error) {
    console.error("GLTF multi-view preview error:", error);
    return {
      success: false,
      error: `GLTF multi-view failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Subsample triangles for very complex models to prevent memory overflow
 * Uses spatial hashing to maintain visual fidelity while reducing count
 * @param triangles - Original triangle array
 * @param targetCount - Target number of triangles
 * @returns Subsampled triangle array
 */
function subsampleTriangles(triangles: StlTriangle[], targetCount: number): StlTriangle[] {
  if (triangles.length <= targetCount) return triangles;

  // Calculate sampling ratio
  const ratio = targetCount / triangles.length;

  // Use deterministic sampling for consistent results
  // Sample every Nth triangle, with slight randomization to avoid aliasing artifacts
  const step = Math.floor(1 / ratio);
  const sampled: StlTriangle[] = [];

  for (let i = 0; i < triangles.length; i += step) {
    // Add slight offset based on position to avoid regular patterns
    const offset = Math.floor((triangles[i].vertices[0].x * 7 + triangles[i].vertices[0].y * 11) % step);
    const idx = Math.min(i + offset, triangles.length - 1);
    sampled.push(triangles[idx]);

    if (sampled.length >= targetCount) break;
  }

  console.log(`[PREVIEW] Subsampled ${triangles.length.toLocaleString()} triangles to ${sampled.length.toLocaleString()}`);
  return sampled;
}

/**
 * Shared multi-view renderer for 3D models
 * Enhanced with supersampling anti-aliasing, better lighting, and high resolution
 * @param triangles - Array of triangles to render
 * @param createCanvas - Canvas factory from 'canvas' package
 * @param viewCount - 4 for 2x2 grid (preview), 6 for 3x2 grid (AI analysis)
 */
async function renderMultiViewPreview(
  triangles: StlTriangle[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createCanvas: any,
  viewCount: 4 | 6
): Promise<PreviewResult> {
  // Check triangle count limits to prevent memory overflow
  if (triangles.length > MAX_TRIANGLES_FOR_PREVIEW) {
    console.log(`[PREVIEW] Skipping preview: ${triangles.length.toLocaleString()} triangles exceeds limit of ${MAX_TRIANGLES_FOR_PREVIEW.toLocaleString()}`);
    return {
      success: false,
      error: `Model too complex for preview (${triangles.length.toLocaleString()} triangles, max ${MAX_TRIANGLES_FOR_PREVIEW.toLocaleString()})`,
    };
  }

  // Subsample if over target but under max
  if (triangles.length > TARGET_TRIANGLES_FOR_PREVIEW) {
    triangles = subsampleTriangles(triangles, TARGET_TRIANGLES_FOR_PREVIEW);
  }
  // Calculate bounding box
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  for (const tri of triangles) {
    for (const v of tri.vertices) {
      minX = Math.min(minX, v.x);
      minY = Math.min(minY, v.y);
      minZ = Math.min(minZ, v.z);
      maxX = Math.max(maxX, v.x);
      maxY = Math.max(maxY, v.y);
      maxZ = Math.max(maxZ, v.z);
    }
  }

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const centerZ = (minZ + maxZ) / 2;
  const sizeX = maxX - minX || 1;
  const sizeY = maxY - minY || 1;
  const sizeZ = maxZ - minZ || 1;
  const maxSize = Math.max(sizeX, sizeY, sizeZ);

  // Detect if this is a relief/flat model (one dimension much smaller than others)
  // Reason: Relief models benefit from different camera angles to show surface detail
  // We use multiple thresholds to classify model flatness:
  // - High confidence relief: < 10% of other dimensions (very flat, like a coin or relief carving)
  // - Medium confidence relief: 10-20% of other dimensions (somewhat flat, like a nameplate)
  // - Low/no relief: > 20% of other dimensions (full 3D object)
  const RELIEF_THRESHOLD_STRONG = 0.10; // Very flat (< 10%)
  const RELIEF_THRESHOLD_WEAK = 0.20;   // Somewhat flat (< 20%)

  // Calculate flatness ratio for each axis (how small is this dimension relative to others?)
  const zFlatness = sizeZ / Math.max(sizeX, sizeY);
  const xFlatness = sizeX / Math.max(sizeY, sizeZ);
  const yFlatness = sizeY / Math.max(sizeX, sizeZ);
  const minFlatness = Math.min(zFlatness, xFlatness, yFlatness);

  // Determine which axis is the "thin" one and calculate confidence
  let isRelief = false;
  let reliefConfidence = 0; // 0 = not relief, 1 = definitely relief
  let thinAxis: "x" | "y" | "z" | null = null;

  if (minFlatness < RELIEF_THRESHOLD_WEAK) {
    isRelief = true;
    // Calculate confidence: 1.0 at RELIEF_THRESHOLD_STRONG, 0.0 at RELIEF_THRESHOLD_WEAK
    reliefConfidence = Math.min(1, (RELIEF_THRESHOLD_WEAK - minFlatness) / (RELIEF_THRESHOLD_WEAK - RELIEF_THRESHOLD_STRONG));
    reliefConfidence = Math.max(0, reliefConfidence);

    // Identify thin axis for potential future use (e.g., optimal view angle selection)
    if (zFlatness === minFlatness) thinAxis = "z";
    else if (xFlatness === minFlatness) thinAxis = "x";
    else thinAxis = "y";
  }

  // Only treat as relief if confidence is above 50% (prevents false positives for blocky objects)
  // Reason: Objects like cubes (1:1:1) or slightly rectangular boxes should not be treated as reliefs
  isRelief = isRelief && reliefConfidence > 0.5;

  // HIGH RESOLUTION: 600px for preview (2x2=1200x1200), 800px for AI analysis (3x2=2400x1600)
  // Use supersampling: render at 1.5x and downsample for anti-aliasing
  const supersampleFactor = 1.5;
  const targetViewSize = viewCount === 6 ? 800 : 600;
  const renderViewSize = Math.round(targetViewSize * supersampleFactor);
  const gridCols = viewCount === 6 ? 3 : 2;
  const gridRows = 2;

  // Create high-resolution canvas for rendering
  const renderCanvas = createCanvas(renderViewSize * gridCols, renderViewSize * gridRows);
  const ctx = renderCanvas.getContext("2d");

  // Enable anti-aliasing hints
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // Define camera views - for relief models, add a close-up angled view
  const views = viewCount === 6
    ? [
        { name: "Front", rotX: 0, rotY: 0, col: 0, row: 0 },
        { name: "Right", rotX: 0, rotY: Math.PI / 2, col: 1, row: 0 },
        { name: "Back", rotX: 0, rotY: Math.PI, col: 2, row: 0 },
        { name: "Top", rotX: -Math.PI / 2, rotY: 0, col: 0, row: 1 },
        // For relief models, use a shallow angle to show surface detail instead of bottom
        { name: isRelief ? "Detail" : "Bottom", rotX: isRelief ? -Math.PI / 8 : Math.PI / 2, rotY: isRelief ? Math.PI / 6 : 0, col: 1, row: 1 },
        { name: "Isometric", rotX: -Math.PI / 6, rotY: Math.PI / 4, col: 2, row: 1 },
      ]
    : [
        { name: "Front", rotX: 0, rotY: 0, col: 0, row: 0 },
        { name: "Right", rotX: 0, rotY: Math.PI / 2, col: 1, row: 0 },
        { name: "Top", rotX: -Math.PI / 2, rotY: 0, col: 0, row: 1 },
        { name: "Isometric", rotX: -Math.PI / 6, rotY: Math.PI / 4, col: 1, row: 1 },
      ];

  // Per-view lighting configuration
  // Reason: Different camera angles benefit from different light positions to avoid harsh shadows
  // and ensure features are properly illuminated from the viewer's perspective
  interface LightConfig {
    x: number;
    y: number;
    z: number;
    intensity: number;
    color: { r: number; g: number; b: number };
  }

  // Generate optimized lights for a specific view angle
  // Reason: Lights should be positioned relative to the camera to maintain consistent illumination
  function generateViewLights(rotX: number, rotY: number): LightConfig[] {
    // Base light positions in camera space (relative to viewer)
    const baseLights: LightConfig[] = [
      // Key light: Upper-right of camera view (warm)
      { x: 0.6, y: 0.8, z: 0.6, intensity: 0.50, color: { r: 255, g: 252, b: 248 } },
      // Fill light: Upper-left of camera view (cool, softer)
      { x: -0.5, y: 0.5, z: 0.5, intensity: 0.30, color: { r: 248, g: 250, b: 255 } },
      // Rim light: Behind and above (highlights edges)
      { x: 0, y: 0.3, z: -0.8, intensity: 0.15, color: { r: 255, g: 255, b: 255 } },
      // Top fill: Directly above (reduces under-shadows)
      { x: 0, y: 1, z: 0, intensity: 0.12, color: { r: 255, g: 255, b: 255 } },
    ];

    // For top/bottom views, adjust lighting to avoid flat appearance
    const isTopView = Math.abs(rotX + Math.PI / 2) < 0.1;
    const isBottomView = Math.abs(rotX - Math.PI / 2) < 0.1;

    if (isTopView || isBottomView) {
      // For top-down views, add more side lighting to show depth
      return [
        { x: 0.7, y: 0.3, z: 0.5, intensity: 0.45, color: { r: 255, g: 252, b: 248 } },
        { x: -0.7, y: 0.3, z: 0.5, intensity: 0.35, color: { r: 248, g: 250, b: 255 } },
        { x: 0, y: 0.2, z: -0.8, intensity: 0.20, color: { r: 255, g: 255, b: 255 } },
        { x: 0.5, y: 0.8, z: 0.3, intensity: 0.15, color: { r: 255, g: 255, b: 255 } },
      ];
    }

    // For front/back views, ensure good frontal illumination
    const isFrontView = Math.abs(rotY) < 0.1 || Math.abs(rotY - Math.PI) < 0.1;
    if (isFrontView) {
      return [
        { x: 0.5, y: 0.7, z: 0.8, intensity: 0.50, color: { r: 255, g: 252, b: 248 } },
        { x: -0.5, y: 0.5, z: 0.7, intensity: 0.32, color: { r: 248, g: 250, b: 255 } },
        { x: 0, y: 0.2, z: -0.6, intensity: 0.12, color: { r: 255, g: 255, b: 255 } },
        { x: 0, y: 1, z: 0.2, intensity: 0.10, color: { r: 255, g: 255, b: 255 } },
      ];
    }

    // For side views, position key light to show depth
    const isRightView = Math.abs(rotY - Math.PI / 2) < 0.1;
    const isLeftView = Math.abs(rotY + Math.PI / 2) < 0.1;
    if (isRightView || isLeftView) {
      const side = isRightView ? 1 : -1;
      return [
        { x: 0.6 * side, y: 0.7, z: 0.7, intensity: 0.48, color: { r: 255, g: 252, b: 248 } },
        { x: -0.4 * side, y: 0.5, z: 0.6, intensity: 0.30, color: { r: 248, g: 250, b: 255 } },
        { x: -0.3 * side, y: 0.2, z: -0.7, intensity: 0.15, color: { r: 255, g: 255, b: 255 } },
        { x: 0, y: 1, z: 0, intensity: 0.10, color: { r: 255, g: 255, b: 255 } },
      ];
    }

    // For isometric/angled views, use balanced lighting
    return baseLights;
  }

  // Normalize light direction vector
  function normalizeLight(light: LightConfig): LightConfig {
    const len = Math.sqrt(light.x ** 2 + light.y ** 2 + light.z ** 2);
    return {
      x: light.x / len,
      y: light.y / len,
      z: light.z / len,
      intensity: light.intensity,
      color: light.color,
    };
  }

  // Ambient light level for base illumination
  // Slightly increased for better shadow fill
  const ambientIntensity = 0.20;

  // Render each view at high resolution
  for (const view of views) {
    const offsetX = view.col * renderViewSize;
    const offsetY = view.row * renderViewSize;

    // Generate per-view optimized lighting
    const viewLights = generateViewLights(view.rotX, view.rotY);
    const normalizedLights = viewLights.map(normalizeLight);

    // Draw view background with professional gradient
    const gradient = ctx.createLinearGradient(offsetX, offsetY, offsetX, offsetY + renderViewSize);
    gradient.addColorStop(0, "#f0f4f8");
    gradient.addColorStop(0.5, "#e4eaf2");
    gradient.addColorStop(1, "#d8e2ec");
    ctx.fillStyle = gradient;
    ctx.fillRect(offsetX, offsetY, renderViewSize, renderViewSize);

    // Project and render triangles for this view
    const scale = (renderViewSize * 0.78) / maxSize;

    // Rotation matrices
    const cosX = Math.cos(view.rotX), sinX = Math.sin(view.rotX);
    const cosY = Math.cos(view.rotY), sinY = Math.sin(view.rotY);

    // Rotate a position (subtracts center first)
    function rotatePoint(x: number, y: number, z: number): { x: number; y: number; z: number } {
      let cx = x - centerX;
      let cy = y - centerY;
      let cz = z - centerZ;

      let tx = cx * cosY + cz * sinY;
      let tz = -cx * sinY + cz * cosY;
      cx = tx;
      cz = tz;

      const ty = cy * cosX - cz * sinX;
      tz = cy * sinX + cz * cosX;
      cy = ty;
      cz = tz;

      return { x: cx, y: cy, z: cz };
    }

    // Rotate a direction vector (normals - no center offset)
    function rotateNormal(nx: number, ny: number, nz: number): { x: number; y: number; z: number } {
      // Rotate around Y axis
      let tx = nx * cosY + nz * sinY;
      let tz = -nx * sinY + nz * cosY;
      nx = tx;
      nz = tz;

      // Rotate around X axis
      const ty = ny * cosX - nz * sinX;
      tz = ny * sinX + nz * cosX;
      ny = ty;
      nz = tz;

      return { x: nx, y: ny, z: nz };
    }

    function projectPoint(x: number, y: number, z: number): { x: number; y: number; z: number } {
      const rotated = rotatePoint(x, y, z);
      return {
        x: offsetX + renderViewSize / 2 + rotated.x * scale,
        y: offsetY + renderViewSize / 2 - rotated.y * scale,
        z: rotated.z,
      };
    }

    // Project all triangles with enhanced multi-light rendering
    const projectedTriangles = triangles.map((tri) => {
      const v0 = projectPoint(tri.vertices[0].x, tri.vertices[0].y, tri.vertices[0].z);
      const v1 = projectPoint(tri.vertices[1].x, tri.vertices[1].y, tri.vertices[1].z);
      const v2 = projectPoint(tri.vertices[2].x, tri.vertices[2].y, tri.vertices[2].z);

      const avgZ = (v0.z + v1.z + v2.z) / 3;

      // Properly rotate the normal
      const rn = rotateNormal(tri.normal.x, tri.normal.y, tri.normal.z);

      // Normalize the rotated normal
      const nLen = Math.sqrt(rn.x ** 2 + rn.y ** 2 + rn.z ** 2) || 1;
      const normalizedN = { x: rn.x / nLen, y: rn.y / nLen, z: rn.z / nLen };

      // Check if triangle faces camera
      const isFrontFacing = normalizedN.z > 0;

      // Enhanced multi-light calculation with color contribution
      let lightR = 0, lightG = 0, lightB = 0;
      for (const light of normalizedLights) {
        const dot = normalizedN.x * light.x + normalizedN.y * light.y + normalizedN.z * light.z;
        const contribution = Math.max(0, dot) * light.intensity;
        lightR += contribution * (light.color.r / 255);
        lightG += contribution * (light.color.g / 255);
        lightB += contribution * (light.color.b / 255);
      }

      // Add ambient
      lightR += ambientIntensity;
      lightG += ambientIntensity;
      lightB += ambientIntensity;

      // Clamp to valid range
      const brightness = Math.min(1, (lightR + lightG + lightB) / 3);
      const lightColor = {
        r: Math.min(1, lightR),
        g: Math.min(1, lightG),
        b: Math.min(1, lightB),
      };

      // Calculate edge factor for Fresnel-like rim effect
      const edgeFactor = Math.pow(1 - Math.abs(normalizedN.z), 2);

      // Calculate specular highlight (Blinn-Phong approximation)
      const viewDir = { x: 0, y: 0, z: 1 };
      const mainLight = normalizedLights[0];
      const halfVector = {
        x: (mainLight.x + viewDir.x) / 2,
        y: (mainLight.y + viewDir.y) / 2,
        z: (mainLight.z + viewDir.z) / 2,
      };
      const hvLen = Math.sqrt(halfVector.x ** 2 + halfVector.y ** 2 + halfVector.z ** 2) || 1;
      const halfNorm = { x: halfVector.x / hvLen, y: halfVector.y / hvLen, z: halfVector.z / hvLen };
      const specDot = normalizedN.x * halfNorm.x + normalizedN.y * halfNorm.y + normalizedN.z * halfNorm.z;
      const specular = Math.pow(Math.max(0, specDot), 32) * 0.25;

      return { v0, v1, v2, avgZ, brightness, isFrontFacing, edgeFactor, normal: normalizedN, lightColor, specular };
    });

    // Sort by depth (back to front)
    projectedTriangles.sort((a, b) => a.avgZ - b.avgZ);

    // Draw triangles with enhanced shading and specular highlights
    for (const tri of projectedTriangles) {
      if (!tri.isFrontFacing) continue;

      ctx.beginPath();
      ctx.moveTo(tri.v0.x, tri.v0.y);
      ctx.lineTo(tri.v1.x, tri.v1.y);
      ctx.lineTo(tri.v2.x, tri.v2.y);
      ctx.closePath();

      // Professional neutral gray base color (slightly warm)
      const baseR = 155, baseG = 165, baseB = 180;

      // Subtle hue shift based on normal for better depth perception
      const hueShift = tri.normal.x * 12;

      // Apply lighting with color temperature from lights
      const r = Math.round(Math.min(255, (baseR + hueShift) * tri.lightColor.r + tri.specular * 255));
      const g = Math.round(Math.min(255, baseG * tri.lightColor.g + tri.specular * 255));
      const b = Math.round(Math.min(255, (baseB - hueShift * 0.5) * tri.lightColor.b + tri.specular * 255));

      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      ctx.fill();

      // Add Fresnel-like rim highlighting for edges facing away from camera
      if (tri.edgeFactor > 0.6) {
        const rimIntensity = (tri.edgeFactor - 0.6) * 0.8;
        ctx.strokeStyle = `rgba(200, 210, 225, ${rimIntensity})`;
        ctx.lineWidth = 1.5 * supersampleFactor;
        ctx.stroke();
      }
    }

    // Second pass: draw silhouette edges for better definition
    ctx.strokeStyle = "rgba(40, 50, 70, 0.35)";
    ctx.lineWidth = 1.2 * supersampleFactor;

    // Build edge map to find silhouette edges
    const edgeMap = new Map<string, { count: number; p1: {x: number; y: number}; p2: {x: number; y: number} }>();

    for (const tri of projectedTriangles) {
      if (!tri.isFrontFacing) continue;

      const edges = [
        [tri.v0, tri.v1],
        [tri.v1, tri.v2],
        [tri.v2, tri.v0],
      ];

      for (const [p1, p2] of edges) {
        // Create canonical edge key (smaller coords first) - use less precision for better grouping
        const key = p1.x < p2.x || (p1.x === p2.x && p1.y < p2.y)
          ? `${Math.round(p1.x)},${Math.round(p1.y)}-${Math.round(p2.x)},${Math.round(p2.y)}`
          : `${Math.round(p2.x)},${Math.round(p2.y)}-${Math.round(p1.x)},${Math.round(p1.y)}`;

        const existing = edgeMap.get(key);
        if (existing) {
          existing.count++;
        } else {
          edgeMap.set(key, { count: 1, p1, p2 });
        }
      }
    }

    // Draw edges that appear only once (silhouette edges)
    for (const edge of edgeMap.values()) {
      if (edge.count === 1) {
        ctx.beginPath();
        ctx.moveTo(edge.p1.x, edge.p1.y);
        ctx.lineTo(edge.p2.x, edge.p2.y);
        ctx.stroke();
      }
    }

    // Add view label with better styling - scale font for high resolution
    const fontSize = Math.round((viewCount === 6 ? 16 : 14) * supersampleFactor);
    ctx.fillStyle = "rgba(30, 40, 60, 0.7)";
    ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    ctx.fillText(view.name, offsetX + Math.round(12 * supersampleFactor), offsetY + Math.round(28 * supersampleFactor));
  }

  // Draw grid lines between views
  ctx.strokeStyle = "rgba(0, 0, 0, 0.12)";
  ctx.lineWidth = 2 * supersampleFactor;
  ctx.beginPath();
  for (let i = 1; i < gridCols; i++) {
    ctx.moveTo(renderViewSize * i, 0);
    ctx.lineTo(renderViewSize * i, renderViewSize * gridRows);
  }
  ctx.moveTo(0, renderViewSize);
  ctx.lineTo(renderViewSize * gridCols, renderViewSize);
  ctx.stroke();

  // Downsample with high-quality anti-aliasing using sharp
  const highResBuffer = renderCanvas.toBuffer("image/png");

  try {
    const sharp = (await import("sharp")).default;
    const finalWidth = targetViewSize * gridCols;
    const finalHeight = targetViewSize * gridRows;

    const downsampledBuffer = await sharp(highResBuffer)
      .resize(finalWidth, finalHeight, {
        kernel: "lanczos3", // High-quality downsampling
        fit: "fill",
      })
      .png({ quality: 100, compressionLevel: 6 })
      .toBuffer();

    return { success: true, buffer: downsampledBuffer };
  } catch {
    // Fallback: return high-res buffer if sharp fails
    return { success: true, buffer: highResBuffer };
  }
}

/**
 * Generate preview from Adobe Illustrator (AI) file
 * Modern AI files often contain an embedded PDF which we can use for preview
 * Falls back to EPS/PostScript rendering via Ghostscript
 */
async function generateAiPreview(buffer: Buffer): Promise<PreviewResult> {
  try {
    // Check for embedded PDF in AI file
    // Modern AI files (CS+) contain "%PDF-" marker followed by PDF data
    const content = buffer.toString("binary");
    const pdfMarkerIndex = content.indexOf("%PDF-");

    if (pdfMarkerIndex !== -1) {
      // Extract embedded PDF and use PDF preview
      // Find the PDF end marker "%%EOF"
      const pdfEndIndex = content.lastIndexOf("%%EOF");
      if (pdfEndIndex > pdfMarkerIndex) {
        const pdfBuffer = Buffer.from(content.slice(pdfMarkerIndex, pdfEndIndex + 5), "binary");
        console.log("Found embedded PDF in AI file, using PDF preview");
        return await generatePdfPreview(pdfBuffer);
      }
    }

    // No embedded PDF - treat as EPS/PostScript
    console.log("No embedded PDF found in AI file, falling back to PostScript rendering");
    return await renderPostScript(buffer);
  } catch (error) {
    console.error("AI preview error:", error);
    return {
      success: false,
      error: `AI conversion failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Generate preview from EPS (Encapsulated PostScript) file
 * Uses Ghostscript for rendering
 */
async function generateEpsPreview(buffer: Buffer): Promise<PreviewResult> {
  try {
    return await renderPostScript(buffer);
  } catch (error) {
    console.error("EPS preview error:", error);
    return {
      success: false,
      error: `EPS conversion failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Render PostScript/EPS using Ghostscript
 * Ghostscript must be installed on the system (gs command)
 */
async function renderPostScript(buffer: Buffer): Promise<PreviewResult> {
  try {
    const { exec } = await import("child_process");
    const { promisify } = await import("util");
    const fs = await import("fs/promises");
    const path = await import("path");
    const os = await import("os");

    const execAsync = promisify(exec);

    // Check if Ghostscript is available
    try {
      await execAsync("gs --version");
    } catch {
      return {
        success: false,
        error: "Ghostscript not installed. Install with: sudo apt-get install ghostscript",
      };
    }

    // Create temp files
    const tmpDir = os.tmpdir();
    const inputPath = path.join(tmpDir, `input-${Date.now()}.ps`);
    const outputPath = path.join(tmpDir, `output-${Date.now()}.png`);

    try {
      // Write input file
      await fs.writeFile(inputPath, buffer);

      // Run Ghostscript with security flags
      // -dSAFER: restricts file operations
      // -dBATCH: exits after processing
      // -dNOPAUSE: doesn't prompt for user input
      // -dEPSCrop: crops to EPS bounding box
      // -r150: 150 DPI resolution (good balance of quality/size)
      const gsCommand = `gs -dBATCH -dNOPAUSE -dSAFER -dEPSCrop -r150 -sDEVICE=pngalpha -sOutputFile="${outputPath}" "${inputPath}"`;

      await execAsync(gsCommand, { timeout: 30000 }); // 30 second timeout

      // Read the output PNG
      const pngBuffer = await fs.readFile(outputPath);

      // Resize with sharp if needed
      const resizedBuffer = await sharp(pngBuffer)
        .resize(PREVIEW_MAX_SIZE, PREVIEW_MAX_SIZE, {
          fit: "inside",
          withoutEnlargement: true,
          background: { r: 255, g: 255, b: 255, alpha: 1 },
        })
        .flatten({ background: { r: 255, g: 255, b: 255 } })
        .png()
        .toBuffer();

      return { success: true, buffer: resizedBuffer };
    } finally {
      // Clean up temp files
      await fs.unlink(inputPath).catch(() => {});
      await fs.unlink(outputPath).catch(() => {});
    }
  } catch (error) {
    console.error("PostScript render error:", error);
    return {
      success: false,
      error: `PostScript rendering failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Generate preview from 3MF (3D Manufacturing Format) file
 * 3MF is a ZIP archive containing XML mesh data
 */
async function generate3mfPreview(buffer: Buffer): Promise<PreviewResult> {
  try {
    const { createCanvas } = await import("canvas");

    // Parse 3MF file
    const result = await parse3mfBuffer(buffer);

    if (result.triangles.length === 0) {
      return { success: false, error: "No triangles found in 3MF file" };
    }

    // Convert ThreeMfTriangle to StlTriangle format
    const triangles: StlTriangle[] = result.triangles.map((tri: ThreeMfTriangle) => ({
      normal: tri.normal,
      vertices: tri.vertices as [Vector3, Vector3, Vector3],
    }));

    // Use shared multi-view renderer
    return await renderMultiViewPreview(triangles, createCanvas, 4);
  } catch (error) {
    console.error("3MF preview error:", error);
    return {
      success: false,
      error: `3MF conversion failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Generate multi-view preview for 3MF files (6 angles for AI analysis)
 */
export async function generate3mfMultiViewPreview(buffer: Buffer): Promise<PreviewResult> {
  try {
    const { createCanvas } = await import("canvas");

    const result = await parse3mfBuffer(buffer);

    if (result.triangles.length === 0) {
      return { success: false, error: "No triangles found in 3MF file" };
    }

    const triangles: StlTriangle[] = result.triangles.map((tri: ThreeMfTriangle) => ({
      normal: tri.normal,
      vertices: tri.vertices as [Vector3, Vector3, Vector3],
    }));

    return await renderMultiViewPreview(triangles, createCanvas, 6);
  } catch (error) {
    console.error("3MF multi-view preview error:", error);
    return {
      success: false,
      error: `3MF multi-view failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Generate preview from DWG (AutoCAD Drawing) file
 * DWG is a proprietary format - we use ODA File Converter or LibreDWG to convert to DXF
 */
async function generateDwgPreview(buffer: Buffer): Promise<PreviewResult> {
  try {
    const { exec } = await import("child_process");
    const { promisify } = await import("util");
    const fs = await import("fs/promises");
    const path = await import("path");
    const os = await import("os");

    const execAsync = promisify(exec);

    // Create temp files
    const tmpDir = os.tmpdir();
    const timestamp = Date.now();
    const inputPath = path.join(tmpDir, `input-${timestamp}.dwg`);
    const outputDir = path.join(tmpDir, `output-${timestamp}`);
    const outputPath = path.join(outputDir, `input-${timestamp}.dxf`);

    try {
      // Write input file
      await fs.writeFile(inputPath, buffer);
      await fs.mkdir(outputDir, { recursive: true });

      // Try ODA File Converter first (common commercial tool)
      let converted = false;
      let dxfBuffer: Buffer | null = null;

      // Try ODAFileConverter (official ODA tool)
      try {
        await execAsync(`which ODAFileConverter`);
        // ODAFileConverter <input_folder> <output_folder> <ACAD_ver> <DXF_ver> <recursive> <audit>
        const inputDir = path.dirname(inputPath);
        const inputFilename = path.basename(inputPath);
        await execAsync(
          `ODAFileConverter "${inputDir}" "${outputDir}" ACAD2018 DXF 0 1`,
          { timeout: 30000 }
        );
        // Read the converted DXF
        const dxfPath = path.join(outputDir, inputFilename.replace('.dwg', '.dxf'));
        dxfBuffer = await fs.readFile(dxfPath);
        converted = true;
        console.log("DWG converted using ODAFileConverter");
      } catch {
        // ODAFileConverter not available
      }

      // Try dwg2dxf from LibreDWG
      if (!converted) {
        try {
          await execAsync(`which dwg2dxf`);
          await execAsync(
            `dwg2dxf -o "${outputPath}" "${inputPath}"`,
            { timeout: 30000 }
          );
          dxfBuffer = await fs.readFile(outputPath);
          converted = true;
          console.log("DWG converted using LibreDWG dwg2dxf");
        } catch {
          // LibreDWG not available
        }
      }

      if (!converted || !dxfBuffer) {
        return {
          success: false,
          error: "DWG conversion requires ODA File Converter or LibreDWG. Install with: sudo apt-get install libredwg-tools",
        };
      }

      // Use DXF preview generation on the converted file
      return await generateDxfPreview(dxfBuffer);
    } finally {
      // Clean up temp files
      await fs.unlink(inputPath).catch(() => {});
      await fs.rm(outputDir, { recursive: true, force: true }).catch(() => {});
    }
  } catch (error) {
    console.error("DWG preview error:", error);
    return {
      success: false,
      error: `DWG conversion failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Generate preview from G-code using canvas
 * Renders the toolpath as a 2D visualization (top-down view)
 */
async function generateGcodePreview(buffer: Buffer): Promise<PreviewResult> {
  try {
    const { createCanvas } = await import("canvas");
    const { parseGcodeBuffer } = await import("./parsers/gcode-parser");

    const result = parseGcodeBuffer(buffer);

    if (result.segments.length === 0) {
      return { success: false, error: "No toolpath found in G-code file" };
    }

    const { bounds, segments, stats } = result;

    // Calculate dimensions
    const width = bounds.max.x - bounds.min.x || 1;
    const height = bounds.max.y - bounds.min.y || 1;
    const padding = Math.max(width, height) * 0.05;

    // Calculate scale to fit in preview size
    const scale = Math.min(
      (PREVIEW_MAX_SIZE - 60) / (width + padding * 2),
      (PREVIEW_MAX_SIZE - 60) / (height + padding * 2)
    );

    const canvasWidth = Math.ceil((width + padding * 2) * scale + 60);
    const canvasHeight = Math.ceil((height + padding * 2) * scale + 80);

    const canvas = createCanvas(canvasWidth, canvasHeight);
    const ctx = canvas.getContext("2d");

    // Dark background (typical for CNC visualization)
    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Save state and set up coordinate system
    ctx.save();
    ctx.translate(30, canvasHeight - 50);
    ctx.scale(scale, -scale);
    ctx.translate(-bounds.min.x + padding, -bounds.min.y + padding);

    // Draw grid
    ctx.strokeStyle = "#2d2d44";
    ctx.lineWidth = 0.5 / scale;
    const gridSize = Math.pow(10, Math.floor(Math.log10(Math.max(width, height))));
    for (let x = Math.floor(bounds.min.x / gridSize) * gridSize; x <= bounds.max.x; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, bounds.min.y);
      ctx.lineTo(x, bounds.max.y);
      ctx.stroke();
    }
    for (let y = Math.floor(bounds.min.y / gridSize) * gridSize; y <= bounds.max.y; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(bounds.min.x, y);
      ctx.lineTo(bounds.max.x, y);
      ctx.stroke();
    }

    // Draw toolpath
    for (const segment of segments) {
      ctx.beginPath();
      ctx.moveTo(segment.start.x, segment.start.y);

      if (segment.type === "arc" && segment.center) {
        // Draw arc
        const startAngle = Math.atan2(
          segment.start.y - segment.center.y,
          segment.start.x - segment.center.x
        );
        const endAngle = Math.atan2(
          segment.end.y - segment.center.y,
          segment.end.x - segment.center.x
        );
        const radius = Math.sqrt(
          Math.pow(segment.start.x - segment.center.x, 2) +
          Math.pow(segment.start.y - segment.center.y, 2)
        );
        ctx.arc(
          segment.center.x,
          segment.center.y,
          radius,
          startAngle,
          endAngle,
          segment.clockwise
        );
      } else {
        ctx.lineTo(segment.end.x, segment.end.y);
      }

      // Color based on segment type
      if (segment.type === "rapid") {
        ctx.strokeStyle = "#4a9eff"; // Blue for rapid moves
        ctx.setLineDash([3 / scale, 3 / scale]);
        ctx.lineWidth = 0.5 / scale;
      } else {
        ctx.strokeStyle = "#ff6b6b"; // Red for cutting moves
        ctx.setLineDash([]);
        ctx.lineWidth = 1.5 / scale;
      }
      ctx.stroke();
    }

    ctx.restore();

    // Add info text
    ctx.fillStyle = "#ffffff";
    ctx.font = "12px sans-serif";
    ctx.fillText(`Moves: ${stats.totalMoves} (${stats.cuttingMoves} cutting, ${stats.rapidMoves} rapid)`, 10, 20);
    ctx.fillText(`Size: ${width.toFixed(1)} x ${height.toFixed(1)} ${result.units}`, 10, 36);

    // Legend
    ctx.fillStyle = "#ff6b6b";
    ctx.fillRect(canvasWidth - 100, 12, 12, 12);
    ctx.fillStyle = "#ffffff";
    ctx.fillText("Cut", canvasWidth - 84, 22);

    ctx.fillStyle = "#4a9eff";
    ctx.fillRect(canvasWidth - 100, 28, 12, 12);
    ctx.fillStyle = "#ffffff";
    ctx.fillText("Rapid", canvasWidth - 84, 38);

    const pngBuffer = canvas.toBuffer("image/png");
    return { success: true, buffer: pngBuffer };
  } catch (error) {
    console.error("G-code preview error:", error);
    return {
      success: false,
      error: `G-code preview failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Check if a file type supports preview generation
 */
export function supportsPreview(fileType: string): boolean {
  const type = fileType.toLowerCase().replace(".", "");
  // Includes image formats - they serve as their own previews
  return ["svg", "dxf", "dwg", "pdf", "stl", "obj", "gltf", "glb", "ai", "eps", "3mf", "gcode", "nc", "ngc", "tap", "png", "jpg", "jpeg", "webp"].includes(type);
}

/**
 * Get list of supported preview formats
 */
export function getSupportedPreviewFormats(): string[] {
  return ["svg", "dxf", "dwg", "pdf", "stl", "obj", "gltf", "glb", "ai", "eps", "3mf", "gcode", "nc", "ngc", "tap", "png", "jpg", "jpeg", "webp"];
}
