/**
 * G-code Parser
 *
 * Parses G-code files and extracts toolpath data for visualization.
 * G-code is the standard programming language for CNC machines.
 *
 * Supported commands:
 * - G0/G00: Rapid move
 * - G1/G01: Linear move (cutting)
 * - G2/G02: Clockwise arc
 * - G3/G03: Counter-clockwise arc
 * - G20: Inches mode
 * - G21: Millimeters mode
 * - G90: Absolute positioning
 * - G91: Relative/incremental positioning
 */

export interface GcodePoint {
  x: number;
  y: number;
  z: number;
}

export interface GcodeSegment {
  type: "rapid" | "cut" | "arc";
  start: GcodePoint;
  end: GcodePoint;
  // For arcs
  center?: GcodePoint;
  clockwise?: boolean;
}

export interface GcodeParseResult {
  segments: GcodeSegment[];
  bounds: {
    min: GcodePoint;
    max: GcodePoint;
  };
  units: "mm" | "inches";
  stats: {
    totalMoves: number;
    rapidMoves: number;
    cuttingMoves: number;
    arcMoves: number;
    totalDistance: number;
    cuttingDistance: number;
    maxZ: number;
    minZ: number;
  };
}

/**
 * Parse G-code content and extract toolpath segments
 */
export function parseGcode(content: string): GcodeParseResult {
  const lines = content.split("\n");

  const segments: GcodeSegment[] = [];
  let currentPosition: GcodePoint = { x: 0, y: 0, z: 0 };
  let absoluteMode = true;
  let units: "mm" | "inches" = "mm";

  const bounds = {
    min: { x: Infinity, y: Infinity, z: Infinity },
    max: { x: -Infinity, y: -Infinity, z: -Infinity },
  };

  const stats = {
    totalMoves: 0,
    rapidMoves: 0,
    cuttingMoves: 0,
    arcMoves: 0,
    totalDistance: 0,
    cuttingDistance: 0,
    maxZ: -Infinity,
    minZ: Infinity,
  };

  // Helper to update bounds
  function updateBounds(point: GcodePoint) {
    bounds.min.x = Math.min(bounds.min.x, point.x);
    bounds.min.y = Math.min(bounds.min.y, point.y);
    bounds.min.z = Math.min(bounds.min.z, point.z);
    bounds.max.x = Math.max(bounds.max.x, point.x);
    bounds.max.y = Math.max(bounds.max.y, point.y);
    bounds.max.z = Math.max(bounds.max.z, point.z);
    stats.maxZ = Math.max(stats.maxZ, point.z);
    stats.minZ = Math.min(stats.minZ, point.z);
  }

  // Helper to calculate distance
  function distance(a: GcodePoint, b: GcodePoint): number {
    return Math.sqrt(
      Math.pow(b.x - a.x, 2) + Math.pow(b.y - a.y, 2) + Math.pow(b.z - a.z, 2)
    );
  }

  // Parse each line
  for (const rawLine of lines) {
    // Remove comments and trim
    const commentIndex = rawLine.indexOf(";");
    const parenIndex = rawLine.indexOf("(");
    let line = rawLine;
    if (commentIndex >= 0) line = line.slice(0, commentIndex);
    if (parenIndex >= 0) {
      const closeIndex = line.indexOf(")");
      if (closeIndex >= 0) {
        line = line.slice(0, parenIndex) + line.slice(closeIndex + 1);
      }
    }
    line = line.trim().toUpperCase();

    if (!line || line.startsWith("%") || line.startsWith("O")) continue;

    // Parse G-codes
    const gMatch = line.match(/G(\d+\.?\d*)/g);
    if (gMatch) {
      for (const g of gMatch) {
        const code = parseFloat(g.slice(1));
        if (code === 20) units = "inches";
        if (code === 21) units = "mm";
        if (code === 90) absoluteMode = true;
        if (code === 91) absoluteMode = false;
      }
    }

    // Check for movement command
    const hasG0 = /G0*0(?![0-9])/.test(line);
    const hasG1 = /G0*1(?![0-9])/.test(line);
    const hasG2 = /G0*2(?![0-9])/.test(line);
    const hasG3 = /G0*3(?![0-9])/.test(line);

    // Extract coordinates
    const xMatch = line.match(/X(-?\d+\.?\d*)/);
    const yMatch = line.match(/Y(-?\d+\.?\d*)/);
    const zMatch = line.match(/Z(-?\d+\.?\d*)/);
    const iMatch = line.match(/I(-?\d+\.?\d*)/);
    const jMatch = line.match(/J(-?\d+\.?\d*)/);

    // If we have coordinates, calculate new position
    if (xMatch || yMatch || zMatch) {
      const newX = xMatch ? parseFloat(xMatch[1]) : (absoluteMode ? currentPosition.x : 0);
      const newY = yMatch ? parseFloat(yMatch[1]) : (absoluteMode ? currentPosition.y : 0);
      const newZ = zMatch ? parseFloat(zMatch[1]) : (absoluteMode ? currentPosition.z : 0);

      let endPosition: GcodePoint;
      if (absoluteMode) {
        endPosition = { x: newX, y: newY, z: newZ };
      } else {
        endPosition = {
          x: currentPosition.x + newX,
          y: currentPosition.y + newY,
          z: currentPosition.z + newZ,
        };
      }

      // Determine segment type
      let type: "rapid" | "cut" | "arc" = "cut";
      if (hasG0) type = "rapid";
      if (hasG2 || hasG3) type = "arc";

      const dist = distance(currentPosition, endPosition);

      // Create segment
      const segment: GcodeSegment = {
        type,
        start: { ...currentPosition },
        end: endPosition,
      };

      // For arcs, calculate center
      if ((hasG2 || hasG3) && (iMatch || jMatch)) {
        const i = iMatch ? parseFloat(iMatch[1]) : 0;
        const j = jMatch ? parseFloat(jMatch[1]) : 0;
        segment.center = {
          x: currentPosition.x + i,
          y: currentPosition.y + j,
          z: currentPosition.z,
        };
        segment.clockwise = hasG2;
      }

      segments.push(segment);
      stats.totalMoves++;
      stats.totalDistance += dist;

      if (type === "rapid") {
        stats.rapidMoves++;
      } else if (type === "arc") {
        stats.arcMoves++;
        stats.cuttingDistance += dist;
      } else {
        stats.cuttingMoves++;
        stats.cuttingDistance += dist;
      }

      updateBounds(currentPosition);
      updateBounds(endPosition);

      currentPosition = endPosition;
    }
  }

  // Handle empty file or no moves
  if (segments.length === 0) {
    return {
      segments: [],
      bounds: {
        min: { x: 0, y: 0, z: 0 },
        max: { x: 0, y: 0, z: 0 },
      },
      units,
      stats: {
        totalMoves: 0,
        rapidMoves: 0,
        cuttingMoves: 0,
        arcMoves: 0,
        totalDistance: 0,
        cuttingDistance: 0,
        maxZ: 0,
        minZ: 0,
      },
    };
  }

  return { segments, bounds, units, stats };
}

/**
 * Parse G-code from buffer
 */
export function parseGcodeBuffer(buffer: Buffer): GcodeParseResult {
  const content = buffer.toString("utf-8");
  return parseGcode(content);
}
