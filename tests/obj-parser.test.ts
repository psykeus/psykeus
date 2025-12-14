import { describe, it, expect } from "vitest";
import {
  parseObj,
  parseObjBuffer,
  type ObjTriangle,
} from "@/lib/parsers/obj-parser";

describe("parseObj", () => {
  describe("basic parsing", () => {
    it("should parse a simple triangle", () => {
      const obj = `
        v 0 0 0
        v 1 0 0
        v 0 1 0
        f 1 2 3
      `;

      const result = parseObj(obj);

      expect(result.vertexCount).toBe(3);
      expect(result.faceCount).toBe(1);
      expect(result.triangles).toHaveLength(1);
    });

    it("should parse vertex positions correctly", () => {
      const obj = `
        v 1.5 2.5 3.5
        v 4.5 5.5 6.5
        v 7.5 8.5 9.5
        f 1 2 3
      `;

      const result = parseObj(obj);
      const vertices = result.triangles[0].vertices;

      expect(vertices[0]).toEqual({ x: 1.5, y: 2.5, z: 3.5 });
      expect(vertices[1]).toEqual({ x: 4.5, y: 5.5, z: 6.5 });
      expect(vertices[2]).toEqual({ x: 7.5, y: 8.5, z: 9.5 });
    });

    it("should handle negative coordinates", () => {
      const obj = `
        v -1 -2 -3
        v 1 2 3
        v 0 0 0
        f 1 2 3
      `;

      const result = parseObj(obj);
      expect(result.triangles[0].vertices[0]).toEqual({ x: -1, y: -2, z: -3 });
    });

    it("should parse multiple triangles", () => {
      const obj = `
        v 0 0 0
        v 1 0 0
        v 0 1 0
        v 1 1 0
        f 1 2 3
        f 2 4 3
      `;

      const result = parseObj(obj);

      expect(result.faceCount).toBe(2);
      expect(result.triangles).toHaveLength(2);
    });
  });

  describe("face formats", () => {
    it("should parse simple vertex indices (v)", () => {
      const obj = `
        v 0 0 0
        v 1 0 0
        v 0 1 0
        f 1 2 3
      `;

      const result = parseObj(obj);
      expect(result.triangles).toHaveLength(1);
    });

    it("should parse vertex/texture indices (v/vt)", () => {
      const obj = `
        v 0 0 0
        v 1 0 0
        v 0 1 0
        vt 0 0
        vt 1 0
        vt 0 1
        f 1/1 2/2 3/3
      `;

      const result = parseObj(obj);
      expect(result.triangles).toHaveLength(1);
      expect(result.triangles[0].vertices[0]).toEqual({ x: 0, y: 0, z: 0 });
    });

    it("should parse vertex//normal indices (v//vn)", () => {
      const obj = `
        v 0 0 0
        v 1 0 0
        v 0 1 0
        vn 0 0 1
        f 1//1 2//1 3//1
      `;

      const result = parseObj(obj);
      expect(result.triangles).toHaveLength(1);
      // Normal should use the provided vertex normal
      expect(result.triangles[0].normal.z).toBeCloseTo(1, 5);
    });

    it("should parse vertex/texture/normal indices (v/vt/vn)", () => {
      const obj = `
        v 0 0 0
        v 1 0 0
        v 0 1 0
        vt 0 0
        vt 1 0
        vt 0 1
        vn 0 0 1
        f 1/1/1 2/2/1 3/3/1
      `;

      const result = parseObj(obj);
      expect(result.triangles).toHaveLength(1);
      expect(result.triangles[0].normal.z).toBeCloseTo(1, 5);
    });
  });

  describe("normals", () => {
    it("should use provided vertex normals", () => {
      const obj = `
        v 0 0 0
        v 1 0 0
        v 0 1 0
        vn 0 0 1
        f 1//1 2//1 3//1
      `;

      const result = parseObj(obj);
      expect(result.triangles[0].normal.x).toBe(0);
      expect(result.triangles[0].normal.y).toBe(0);
      expect(result.triangles[0].normal.z).toBeCloseTo(1, 5);
    });

    it("should average normals when vertices have different normals", () => {
      const obj = `
        v 0 0 0
        v 1 0 0
        v 0 1 0
        vn 0.577 0.577 0.577
        vn 0.577 0.577 0.577
        vn 0.577 0.577 0.577
        f 1//1 2//2 3//3
      `;

      const result = parseObj(obj);
      const n = result.triangles[0].normal;
      expect(n.x).toBeCloseTo(0.577, 2);
      expect(n.y).toBeCloseTo(0.577, 2);
      expect(n.z).toBeCloseTo(0.577, 2);
    });

    it("should calculate normals from cross product when not provided", () => {
      const obj = `
        v 0 0 0
        v 1 0 0
        v 0 1 0
        f 1 2 3
      `;

      const result = parseObj(obj);
      const n = result.triangles[0].normal;

      // For vertices at origin, (1,0,0), (0,1,0), the normal should point in +Z
      expect(n.x).toBeCloseTo(0, 5);
      expect(n.y).toBeCloseTo(0, 5);
      expect(n.z).toBeCloseTo(1, 5);
    });

    it("should calculate normals for faces in XY plane", () => {
      // Triangle in XY plane with Z=5
      const obj = `
        v 0 0 5
        v 2 0 5
        v 1 2 5
        f 1 2 3
      `;

      const result = parseObj(obj);
      const n = result.triangles[0].normal;

      // Normal should point in +Z direction
      expect(Math.abs(n.z)).toBeCloseTo(1, 5);
    });
  });

  describe("triangulation", () => {
    it("should triangulate quad faces", () => {
      const obj = `
        v 0 0 0
        v 1 0 0
        v 1 1 0
        v 0 1 0
        f 1 2 3 4
      `;

      const result = parseObj(obj);

      // A quad should produce 2 triangles
      expect(result.faceCount).toBe(1);
      expect(result.triangles).toHaveLength(2);
    });

    it("should triangulate n-gon faces", () => {
      // Pentagon
      const obj = `
        v 0 0 0
        v 1 0 0
        v 1.5 0.5 0
        v 0.5 1 0
        v -0.5 0.5 0
        f 1 2 3 4 5
      `;

      const result = parseObj(obj);

      // A pentagon should produce 3 triangles
      expect(result.faceCount).toBe(1);
      expect(result.triangles).toHaveLength(3);
    });

    it("should use fan triangulation from first vertex", () => {
      const obj = `
        v 0 0 0
        v 1 0 0
        v 1 1 0
        v 0 1 0
        f 1 2 3 4
      `;

      const result = parseObj(obj);

      // First triangle should use vertices 1, 2, 3
      expect(result.triangles[0].vertices[0]).toEqual({ x: 0, y: 0, z: 0 });
      expect(result.triangles[0].vertices[1]).toEqual({ x: 1, y: 0, z: 0 });
      expect(result.triangles[0].vertices[2]).toEqual({ x: 1, y: 1, z: 0 });

      // Second triangle should use vertices 1, 3, 4
      expect(result.triangles[1].vertices[0]).toEqual({ x: 0, y: 0, z: 0 });
      expect(result.triangles[1].vertices[1]).toEqual({ x: 1, y: 1, z: 0 });
      expect(result.triangles[1].vertices[2]).toEqual({ x: 0, y: 1, z: 0 });
    });
  });

  describe("comments and empty lines", () => {
    it("should skip comment lines", () => {
      const obj = `
        # This is a comment
        v 0 0 0
        # Another comment
        v 1 0 0
        v 0 1 0
        # Comment before face
        f 1 2 3
      `;

      const result = parseObj(obj);

      expect(result.vertexCount).toBe(3);
      expect(result.triangles).toHaveLength(1);
    });

    it("should skip empty lines", () => {
      const obj = `
        v 0 0 0

        v 1 0 0

        v 0 1 0

        f 1 2 3
      `;

      const result = parseObj(obj);

      expect(result.vertexCount).toBe(3);
      expect(result.triangles).toHaveLength(1);
    });
  });

  describe("edge cases", () => {
    it("should handle empty input", () => {
      const result = parseObj("");

      expect(result.vertexCount).toBe(0);
      expect(result.faceCount).toBe(0);
      expect(result.triangles).toHaveLength(0);
    });

    it("should handle input with only comments", () => {
      const obj = `
        # Just a comment file
        # No geometry here
      `;

      const result = parseObj(obj);

      expect(result.vertexCount).toBe(0);
      expect(result.triangles).toHaveLength(0);
    });

    it("should handle vertices without faces", () => {
      const obj = `
        v 0 0 0
        v 1 0 0
        v 0 1 0
      `;

      const result = parseObj(obj);

      expect(result.vertexCount).toBe(3);
      expect(result.faceCount).toBe(0);
      expect(result.triangles).toHaveLength(0);
    });

    it("should handle faces with less than 3 vertices", () => {
      const obj = `
        v 0 0 0
        v 1 0 0
        v 0 1 0
        f 1 2
      `;

      const result = parseObj(obj);

      // Face with only 2 vertices should not produce triangles
      // But it still counts as a face in the file
      expect(result.triangles).toHaveLength(0);
    });

    it("should handle invalid vertex indices gracefully", () => {
      const obj = `
        v 0 0 0
        v 1 0 0
        v 0 1 0
        f 1 2 99
      `;

      const result = parseObj(obj);

      // Should use default {0,0,0} for missing vertex
      expect(result.triangles).toHaveLength(1);
      expect(result.triangles[0].vertices[2]).toEqual({ x: 0, y: 0, z: 0 });
    });

    it("should handle invalid normal indices gracefully", () => {
      const obj = `
        v 0 0 0
        v 1 0 0
        v 0 1 0
        vn 0 0 1
        f 1//99 2//99 3//99
      `;

      const result = parseObj(obj);

      // Should calculate normal from cross product when indices are invalid
      expect(result.triangles).toHaveLength(1);
    });

    it("should handle extra whitespace", () => {
      const obj = `
        v   0   0   0
        v   1   0   0
        v   0   1   0
        f   1   2   3
      `;

      const result = parseObj(obj);

      expect(result.vertexCount).toBe(3);
      expect(result.triangles).toHaveLength(1);
    });

    it("should handle scientific notation", () => {
      const obj = `
        v 1e-3 2e-3 3e-3
        v 1e3 2e3 3e3
        v 0 0 0
        f 1 2 3
      `;

      const result = parseObj(obj);

      expect(result.triangles[0].vertices[0]).toEqual({ x: 0.001, y: 0.002, z: 0.003 });
      expect(result.triangles[0].vertices[1]).toEqual({ x: 1000, y: 2000, z: 3000 });
    });
  });

  describe("complex models", () => {
    it("should parse a simple cube", () => {
      const obj = `
        # Simple cube
        v -1 -1 -1
        v  1 -1 -1
        v  1  1 -1
        v -1  1 -1
        v -1 -1  1
        v  1 -1  1
        v  1  1  1
        v -1  1  1

        # Front face
        f 5 6 7 8
        # Back face
        f 1 4 3 2
        # Top face
        f 4 8 7 3
        # Bottom face
        f 1 2 6 5
        # Right face
        f 2 3 7 6
        # Left face
        f 1 5 8 4
      `;

      const result = parseObj(obj);

      expect(result.vertexCount).toBe(8);
      expect(result.faceCount).toBe(6);
      // 6 quad faces = 12 triangles
      expect(result.triangles).toHaveLength(12);
    });

    it("should parse a pyramid", () => {
      const obj = `
        # Pyramid
        v 0 1 0
        v -1 0 -1
        v 1 0 -1
        v 1 0 1
        v -1 0 1

        # Base (quad)
        f 2 3 4 5
        # Sides (triangles)
        f 1 3 2
        f 1 4 3
        f 1 5 4
        f 1 2 5
      `;

      const result = parseObj(obj);

      expect(result.vertexCount).toBe(5);
      expect(result.faceCount).toBe(5);
      // 1 quad (2 triangles) + 4 triangles = 6 triangles
      expect(result.triangles).toHaveLength(6);
    });
  });

  describe("ignored elements", () => {
    it("should ignore texture coordinates (vt)", () => {
      const obj = `
        v 0 0 0
        v 1 0 0
        v 0 1 0
        vt 0 0
        vt 1 0
        vt 0 1
        f 1/1 2/2 3/3
      `;

      const result = parseObj(obj);

      expect(result.triangles).toHaveLength(1);
      // Parser should still work, just ignoring vt data
    });

    it("should ignore material library references (mtllib)", () => {
      const obj = `
        mtllib material.mtl
        v 0 0 0
        v 1 0 0
        v 0 1 0
        f 1 2 3
      `;

      const result = parseObj(obj);

      expect(result.triangles).toHaveLength(1);
    });

    it("should ignore usemtl commands", () => {
      const obj = `
        v 0 0 0
        v 1 0 0
        v 0 1 0
        usemtl red
        f 1 2 3
      `;

      const result = parseObj(obj);

      expect(result.triangles).toHaveLength(1);
    });

    it("should ignore object names (o)", () => {
      const obj = `
        o MyObject
        v 0 0 0
        v 1 0 0
        v 0 1 0
        f 1 2 3
      `;

      const result = parseObj(obj);

      expect(result.triangles).toHaveLength(1);
    });

    it("should ignore group names (g)", () => {
      const obj = `
        g group1
        v 0 0 0
        v 1 0 0
        v 0 1 0
        f 1 2 3
      `;

      const result = parseObj(obj);

      expect(result.triangles).toHaveLength(1);
    });

    it("should ignore smoothing groups (s)", () => {
      const obj = `
        v 0 0 0
        v 1 0 0
        v 0 1 0
        s 1
        f 1 2 3
      `;

      const result = parseObj(obj);

      expect(result.triangles).toHaveLength(1);
    });
  });
});

describe("parseObjBuffer", () => {
  it("should parse a buffer as UTF-8", () => {
    const obj = `
      v 0 0 0
      v 1 0 0
      v 0 1 0
      f 1 2 3
    `;
    const buffer = Buffer.from(obj, "utf-8");

    const result = parseObjBuffer(buffer);

    expect(result.vertexCount).toBe(3);
    expect(result.triangles).toHaveLength(1);
  });

  it("should handle empty buffer", () => {
    const buffer = Buffer.from("", "utf-8");

    const result = parseObjBuffer(buffer);

    expect(result.vertexCount).toBe(0);
    expect(result.triangles).toHaveLength(0);
  });
});

describe("normal calculation", () => {
  it("should produce normalized normals", () => {
    const obj = `
      v 0 0 0
      v 10 0 0
      v 0 10 0
      f 1 2 3
    `;

    const result = parseObj(obj);
    const n = result.triangles[0].normal;

    // Check that normal is unit length
    const length = Math.sqrt(n.x ** 2 + n.y ** 2 + n.z ** 2);
    expect(length).toBeCloseTo(1, 5);
  });

  it("should handle degenerate triangles gracefully", () => {
    // Triangle with collinear points
    const obj = `
      v 0 0 0
      v 1 0 0
      v 2 0 0
      f 1 2 3
    `;

    const result = parseObj(obj);

    // Should not crash, normal will be zero vector
    expect(result.triangles).toHaveLength(1);
  });

  it("should calculate correct normal direction based on winding", () => {
    // Counter-clockwise winding in XY plane should give +Z normal
    const obj = `
      v 0 0 0
      v 1 0 0
      v 0 1 0
      f 1 2 3
    `;

    const result = parseObj(obj);
    expect(result.triangles[0].normal.z).toBeGreaterThan(0);
  });
});
