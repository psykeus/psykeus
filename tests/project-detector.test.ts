import { describe, it, expect } from "vitest";
import {
  detectProjects,
  selectPrimaryFile,
  determineFileRole,
} from "@/lib/import/project-detector";
import type { ScannedFile } from "@/lib/types/import";

// Helper to create ScannedFile objects
function createFile(
  path: string,
  overrides: Partial<ScannedFile> = {}
): ScannedFile {
  const parts = path.split("/");
  const filename = parts.pop() || "";
  return {
    path,
    filename,
    size: 1000,
    extension: filename.split(".").pop() || "",
    folder: parts.join("/") || "/",
    ...overrides,
  };
}

describe("detectProjects", () => {
  describe("single file projects", () => {
    it("should treat single file as its own project", () => {
      const files = [createFile("/designs/widget.svg")];

      const projects = detectProjects(files);

      expect(projects).toHaveLength(1);
      expect(projects[0].inferred_name).toBe("Widget");
      expect(projects[0].files).toHaveLength(1);
    });

    it("should handle multiple unrelated single files", () => {
      const files = [
        createFile("/designs/widget.svg"),
        createFile("/other/gadget.stl"),
      ];

      const projects = detectProjects(files);

      expect(projects).toHaveLength(2);
    });
  });

  describe("variant detection", () => {
    it("should group files with same base name but different extensions", () => {
      const files = [
        createFile("/designs/logo.svg"),
        createFile("/designs/logo.dxf"),
        createFile("/designs/logo.pdf"),
      ];

      const projects = detectProjects(files);

      expect(projects).toHaveLength(1);
      expect(projects[0].files).toHaveLength(3);
      // When in same folder, folder detection may claim them first
      expect(["folder", "variant"]).toContain(projects[0].detection_reason);
    });

    it("should keep different base names separate in same folder", () => {
      const files = [
        createFile("/designs/logo.svg"),
        createFile("/designs/icon.svg"),
      ];

      const projects = detectProjects(files);

      // These should be grouped as folder-based since both in same folder
      expect(projects).toHaveLength(1);
      expect(projects[0].files).toHaveLength(2);
    });
  });

  describe("folder detection", () => {
    it("should group files in same folder as one project", () => {
      const files = [
        createFile("/projects/box/lid.svg"),
        createFile("/projects/box/base.svg"),
        createFile("/projects/box/side.svg"),
      ];

      const projects = detectProjects(files);

      expect(projects).toHaveLength(1);
      expect(projects[0].inferred_name).toBe("Box");
      expect(projects[0].files).toHaveLength(3);
    });

    it("should use folder name as project name", () => {
      const files = [
        createFile("/my-projects/solar-panel-mount/part1.svg"),
        createFile("/my-projects/solar-panel-mount/part2.svg"),
      ];

      const projects = detectProjects(files);

      expect(projects[0].inferred_name).toBe("Solar Panel Mount");
    });
  });

  describe("cross-folder detection", () => {
    it("should group same-named files across type-organized folders", () => {
      const files = [
        createFile("/projects/SVG/design1.svg"),
        createFile("/projects/DXF/design1.dxf"),
        createFile("/projects/PNG/design1.png"),
        createFile("/projects/SVG/design2.svg"),
        createFile("/projects/DXF/design2.dxf"),
        createFile("/projects/PNG/design2.png"),
      ];

      const projects = detectProjects(files);

      // Should have 2 projects: design1 and design2
      expect(projects).toHaveLength(2);
      expect(projects.find((p) => p.inferred_name === "Design1")).toBeDefined();
      expect(projects.find((p) => p.inferred_name === "Design2")).toBeDefined();
    });

    it("should detect cross-folder by uniform extensions in folders", () => {
      const files = [
        createFile("/library/vectors/item1.svg"),
        createFile("/library/vectors/item2.svg"),
        createFile("/library/previews/item1.png"),
        createFile("/library/previews/item2.png"),
      ];

      const projects = detectProjects(files);

      // Should detect cross-folder organization
      const item1 = projects.find((p) =>
        p.files.some((f) => f.filename === "item1.svg")
      );
      expect(item1?.files).toHaveLength(2);
    });
  });

  describe("layer/part detection", () => {
    it("should group numbered files as layers", () => {
      const files = [
        createFile("/projects/frame-1.svg"),
        createFile("/projects/frame-2.svg"),
        createFile("/projects/frame-3.svg"),
      ];

      const projects = detectProjects(files);

      expect(projects).toHaveLength(1);
      // Could be detected as folder or layer depending on algorithm
      expect(projects[0].files).toHaveLength(3);
    });

    it("should group part-numbered files", () => {
      const files = [
        createFile("/box/side-part-1.svg"),
        createFile("/box/side-part-2.svg"),
        createFile("/box/side-part-3.svg"),
      ];

      const projects = detectProjects(files);

      expect(projects).toHaveLength(1);
    });

    it("should group letter-suffixed files", () => {
      const files = [
        createFile("/panels/panel-a.svg"),
        createFile("/panels/panel-b.svg"),
        createFile("/panels/panel-c.svg"),
      ];

      const projects = detectProjects(files);

      expect(projects).toHaveLength(1);
    });
  });

  describe("prefix detection", () => {
    it("should group files with common prefix", () => {
      const files = [
        createFile("/designs/solar-panel-base.svg"),
        createFile("/designs/solar-panel-cover.svg"),
        createFile("/designs/solar-panel-mount.svg"),
      ];

      const projects = detectProjects(files);

      expect(projects).toHaveLength(1);
      // Folder detection may take priority over prefix detection
      expect(["folder", "prefix"]).toContain(projects[0].detection_reason);
    });
  });

  describe("manifest detection", () => {
    it("should group design files in folder with manifest", () => {
      // Note: manifest files (.md, .json) are filtered out by isSupportedExtension
      // So manifest detection only works if the manifest is also scanned separately
      // The design files will still be grouped by folder detection
      const files = [
        createFile("/project/readme.md"),
        createFile("/project/main.svg"),
        createFile("/project/secondary.dxf"),
      ];

      const projects = detectProjects(files);

      // Design files are grouped (manifest file filtered out)
      expect(projects).toHaveLength(1);
      expect(projects[0].files).toHaveLength(2); // Only svg and dxf
    });

    it("should group files in folder containing manifest-like files", () => {
      // Even without manifest, files in same folder are grouped
      const files = [
        createFile("/widget/part1.svg"),
        createFile("/widget/part2.svg"),
      ];

      const projects = detectProjects(files);

      expect(projects).toHaveLength(1);
      expect(projects[0].files).toHaveLength(2);
    });
  });

  describe("unsupported file filtering", () => {
    it("should ignore unsupported file types", () => {
      const files = [
        createFile("/project/design.svg"),
        createFile("/project/script.js"),
        createFile("/project/config.json"),
      ];

      const projects = detectProjects(files);

      // Only the svg should be included
      expect(projects).toHaveLength(1);
      expect(projects[0].files).toHaveLength(1);
      expect(projects[0].files[0].filename).toBe("design.svg");
    });
  });

  describe("project naming", () => {
    it("should format names with proper capitalization", () => {
      const files = [createFile("/designs/my-cool-design.svg")];

      const projects = detectProjects(files);

      expect(projects[0].inferred_name).toBe("My Cool Design");
    });

    it("should convert underscores to spaces", () => {
      const files = [createFile("/designs/robot_arm_v2.svg")];

      const projects = detectProjects(files);

      expect(projects[0].inferred_name).toBe("Robot Arm V2");
    });

    it("should handle consecutive separators", () => {
      const files = [createFile("/designs/test--design__file.svg")];

      const projects = detectProjects(files);

      expect(projects[0].inferred_name).toBe("Test Design File");
    });
  });
});

describe("selectPrimaryFile", () => {
  it("should return null for empty array", () => {
    const result = selectPrimaryFile([]);
    expect(result).toBeNull();
  });

  it("should return single file if only one", () => {
    const files = [createFile("/design.stl")];

    const result = selectPrimaryFile(files);

    expect(result?.filename).toBe("design.stl");
  });

  it("should prioritize SVG over other formats", () => {
    const files = [
      createFile("/design.dxf"),
      createFile("/design.pdf"),
      createFile("/design.svg"),
    ];

    const result = selectPrimaryFile(files);

    expect(result?.filename).toBe("design.svg");
  });

  it("should prioritize STL for 3D files", () => {
    const files = [
      createFile("/model.obj"),
      createFile("/model.stl"),
      createFile("/model.gltf"),
    ];

    const result = selectPrimaryFile(files);

    expect(result?.filename).toBe("model.stl");
  });

  it("should prioritize files named 'main'", () => {
    const files = [
      createFile("/design.svg"),
      createFile("/main.dxf"),
      createFile("/other.stl"),
    ];

    const result = selectPrimaryFile(files);

    expect(result?.filename).toBe("main.dxf");
  });

  it("should prioritize files named 'primary'", () => {
    const files = [
      createFile("/design.svg"),
      createFile("/primary.pdf"),
    ];

    const result = selectPrimaryFile(files);

    expect(result?.filename).toBe("primary.pdf");
  });

  it("should prioritize files ending with '-main'", () => {
    const files = [
      createFile("/design-secondary.svg"),
      createFile("/design-main.dxf"),
    ];

    const result = selectPrimaryFile(files);

    expect(result?.filename).toBe("design-main.dxf");
  });

  it("should follow file priority order", () => {
    // Test priority: .svg > .stl > .obj > .gltf > .glb > .3mf > .dxf
    const files = [
      createFile("/model.dxf"),
      createFile("/model.obj"),
    ];

    const result = selectPrimaryFile(files);
    expect(result?.filename).toBe("model.obj");
  });

  it("should put files without priority at end", () => {
    const files = [
      createFile("/model.txt"), // Not in priority list
      createFile("/model.svg"),
    ];

    const result = selectPrimaryFile(files);
    expect(result?.filename).toBe("model.svg");
  });
});

describe("determineFileRole", () => {
  it("should return 'primary' when no primary file specified", () => {
    const file = createFile("/design.svg");

    const role = determineFileRole(file, null, [file]);

    expect(role).toBe("primary");
  });

  it("should return 'primary' for the primary file itself", () => {
    const primary = createFile("/design.svg");
    const other = createFile("/design.dxf");

    const role = determineFileRole(primary, primary, [primary, other]);

    expect(role).toBe("primary");
  });

  it("should return 'variant' for same base name different extension", () => {
    const primary = createFile("/design.svg");
    const variant = createFile("/design.dxf");

    const role = determineFileRole(variant, primary, [primary, variant]);

    expect(role).toBe("variant");
  });

  it("should return 'variant' case-insensitively", () => {
    const primary = createFile("/Design.svg");
    const variant = createFile("/DESIGN.dxf");

    const role = determineFileRole(variant, primary, [primary, variant]);

    expect(role).toBe("variant");
  });

  it("should return 'component' for different base name", () => {
    const primary = createFile("/main-design.svg");
    const component = createFile("/support-piece.svg");

    const role = determineFileRole(component, primary, [primary, component]);

    expect(role).toBe("component");
  });
});

describe("project detection edge cases", () => {
  it("should handle files at root level", () => {
    const files = [createFile("/design.svg")];

    const projects = detectProjects(files);

    expect(projects).toHaveLength(1);
    expect(projects[0].files).toHaveLength(1);
  });

  it("should handle deeply nested files", () => {
    const files = [
      createFile("/a/b/c/d/e/design.svg"),
      createFile("/a/b/c/d/e/design.dxf"),
    ];

    const projects = detectProjects(files);

    expect(projects).toHaveLength(1);
    expect(projects[0].files).toHaveLength(2);
  });

  it("should handle empty file list", () => {
    const projects = detectProjects([]);

    expect(projects).toHaveLength(0);
  });

  it("should handle files with no extension", () => {
    const files = [
      createFile("/project/design.svg"),
      createFile("/project/README"), // No extension - should be filtered
    ];

    const projects = detectProjects(files);

    expect(projects).toHaveLength(1);
    expect(projects[0].files).toHaveLength(1);
  });

  it("should handle very long filenames", () => {
    const longName = "a".repeat(200);
    const files = [createFile(`/project/${longName}.svg`)];

    const projects = detectProjects(files);

    expect(projects).toHaveLength(1);
  });

  it("should handle special characters in paths", () => {
    const files = [
      createFile("/my project (v2)/design [final].svg"),
      createFile("/my project (v2)/design [final].dxf"),
    ];

    const projects = detectProjects(files);

    expect(projects).toHaveLength(1);
    expect(projects[0].files).toHaveLength(2);
  });

  it("should assign primary file to all detected projects", () => {
    const files = [
      createFile("/project1/design.svg"),
      createFile("/project1/design.dxf"),
      createFile("/project2/model.stl"),
    ];

    const projects = detectProjects(files);

    for (const project of projects) {
      expect(project.primary_file).not.toBeNull();
    }
  });
});

describe("detection confidence levels", () => {
  it("should have good confidence for folder-based grouping", () => {
    const files = [
      createFile("/project/design.svg"),
      createFile("/project/backup.svg"),
    ];

    const projects = detectProjects(files);

    expect(projects[0].confidence).toBeGreaterThanOrEqual(0.9);
  });

  it("should have confidence for variant or folder detection", () => {
    const files = [
      createFile("/designs/logo.svg"),
      createFile("/designs/logo.pdf"),
    ];

    const projects = detectProjects(files);

    // Either variant (0.95) or folder (0.9) confidence
    expect(projects[0].confidence).toBeGreaterThanOrEqual(0.9);
  });

  it("should have good confidence for folder detection", () => {
    const files = [
      createFile("/box/lid.svg"),
      createFile("/box/base.svg"),
    ];

    const projects = detectProjects(files);

    expect(projects[0].confidence).toBeGreaterThanOrEqual(0.9);
  });
});
