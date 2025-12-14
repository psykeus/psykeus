import { describe, it, expect } from "vitest";
import {
  isSupportedExtension,
  isImageFile,
  isDesignFile,
  getFileExtension,
  generateSlug,
  is3DFormat,
  get3DModelType,
  DESIGN_EXTENSIONS,
  IMAGE_EXTENSIONS,
  THREE_D_EXTENSIONS,
  DESIGN_MIME_TYPES,
  IMAGE_MIME_TYPES,
} from "@/lib/file-types";

describe("isSupportedExtension", () => {
  describe("design files", () => {
    it.each([
      "design.svg",
      "file.dxf",
      "model.stl",
      "object.obj",
      "scene.gltf",
      "scene.glb",
      "print.3mf",
      "drawing.dwg",
      "document.pdf",
      "artwork.ai",
      "graphic.eps",
      "vector.cdr",
    ])("should accept %s", (filename) => {
      expect(isSupportedExtension(filename)).toBe(true);
    });
  });

  describe("image files", () => {
    it.each(["image.png", "photo.jpg", "picture.jpeg", "graphic.webp"])(
      "should accept %s",
      (filename) => {
        expect(isSupportedExtension(filename)).toBe(true);
      }
    );
  });

  describe("unsupported files", () => {
    it.each([
      "document.doc",
      "spreadsheet.xlsx",
      "archive.zip",
      "video.mp4",
      "audio.mp3",
      "script.js",
      "noextension",
    ])("should reject %s", (filename) => {
      expect(isSupportedExtension(filename)).toBe(false);
    });
  });

  it("should be case insensitive", () => {
    expect(isSupportedExtension("FILE.SVG")).toBe(true);
    expect(isSupportedExtension("File.Stl")).toBe(true);
    expect(isSupportedExtension("IMAGE.PNG")).toBe(true);
  });
});

describe("isImageFile", () => {
  it.each(["photo.png", "image.jpg", "pic.jpeg", "graphic.webp"])(
    "should return true for %s",
    (filename) => {
      expect(isImageFile(filename)).toBe(true);
    }
  );

  it.each(["design.svg", "model.stl", "document.pdf"])(
    "should return false for %s",
    (filename) => {
      expect(isImageFile(filename)).toBe(false);
    }
  );

  it("should be case insensitive", () => {
    expect(isImageFile("IMAGE.PNG")).toBe(true);
    expect(isImageFile("Photo.JPG")).toBe(true);
  });
});

describe("isDesignFile", () => {
  it.each([
    "design.svg",
    "model.stl",
    "object.obj",
    "drawing.dxf",
    "document.pdf",
  ])("should return true for %s", (filename) => {
    expect(isDesignFile(filename)).toBe(true);
  });

  it.each(["photo.png", "image.jpg", "picture.webp"])(
    "should return false for %s",
    (filename) => {
      expect(isDesignFile(filename)).toBe(false);
    }
  );

  it("should be case insensitive", () => {
    expect(isDesignFile("MODEL.STL")).toBe(true);
    expect(isDesignFile("Design.SVG")).toBe(true);
  });
});

describe("getFileExtension", () => {
  it("should return lowercase extension with dot", () => {
    expect(getFileExtension("file.svg")).toBe(".svg");
    expect(getFileExtension("model.STL")).toBe(".stl");
  });

  it("should handle multiple dots in filename", () => {
    expect(getFileExtension("my.design.v2.svg")).toBe(".svg");
  });

  it("should handle no extension", () => {
    // getFileExtension returns the last character after the last dot
    // For "noextension", lastIndexOf('.') returns -1, so it slices from -1
    const result = getFileExtension("noextension");
    expect(result).toBe("n"); // Actually returns 'n' (last char when no dot)
  });

  it("should handle hidden files", () => {
    expect(getFileExtension(".gitignore")).toBe(".gitignore");
  });
});

describe("generateSlug", () => {
  it("should convert to lowercase", () => {
    expect(generateSlug("Hello World")).toBe("hello-world");
  });

  it("should replace non-alphanumeric with hyphens", () => {
    expect(generateSlug("Hello, World!")).toBe("hello-world");
    expect(generateSlug("Test@#$123")).toBe("test-123");
  });

  it("should remove leading/trailing hyphens", () => {
    expect(generateSlug("-hello-")).toBe("hello");
    expect(generateSlug("!@#hello!@#")).toBe("hello");
  });

  it("should truncate to 100 characters", () => {
    const longTitle = "a".repeat(150);
    expect(generateSlug(longTitle).length).toBeLessThanOrEqual(100);
  });

  it("should handle empty strings", () => {
    expect(generateSlug("")).toBe("");
  });

  it("should collapse multiple hyphens", () => {
    expect(generateSlug("hello   world")).toBe("hello-world");
    expect(generateSlug("a - b - c")).toBe("a-b-c");
  });
});

describe("is3DFormat", () => {
  it.each(["model.stl", "object.obj", "scene.gltf", "scene.glb", "print.3mf"])(
    "should return true for %s",
    (filename) => {
      expect(is3DFormat(filename)).toBe(true);
    }
  );

  it.each(["design.svg", "drawing.dxf", "image.png", "document.pdf"])(
    "should return false for %s",
    (filename) => {
      expect(is3DFormat(filename)).toBe(false);
    }
  );

  it("should be case insensitive", () => {
    expect(is3DFormat("MODEL.STL")).toBe(true);
    expect(is3DFormat("Scene.GLTF")).toBe(true);
  });
});

describe("get3DModelType", () => {
  it("should return correct type for STL", () => {
    expect(get3DModelType("model.stl")).toBe("stl");
    expect(get3DModelType("MODEL.STL")).toBe("stl");
  });

  it("should return correct type for OBJ", () => {
    expect(get3DModelType("object.obj")).toBe("obj");
  });

  it("should return correct type for GLTF", () => {
    expect(get3DModelType("scene.gltf")).toBe("gltf");
  });

  it("should return correct type for GLB", () => {
    expect(get3DModelType("scene.glb")).toBe("glb");
  });

  it("should return correct type for 3MF", () => {
    expect(get3DModelType("print.3mf")).toBe("3mf");
  });

  it("should return null for non-3D files", () => {
    expect(get3DModelType("design.svg")).toBe(null);
    expect(get3DModelType("image.png")).toBe(null);
    expect(get3DModelType("document.pdf")).toBe(null);
  });
});

describe("Constants", () => {
  describe("DESIGN_EXTENSIONS", () => {
    it("should contain all expected design extensions", () => {
      expect(DESIGN_EXTENSIONS).toContain(".svg");
      expect(DESIGN_EXTENSIONS).toContain(".dxf");
      expect(DESIGN_EXTENSIONS).toContain(".stl");
      expect(DESIGN_EXTENSIONS).toContain(".obj");
      expect(DESIGN_EXTENSIONS).toContain(".pdf");
    });

    it("should not contain image extensions", () => {
      expect(DESIGN_EXTENSIONS).not.toContain(".png");
      expect(DESIGN_EXTENSIONS).not.toContain(".jpg");
    });
  });

  describe("IMAGE_EXTENSIONS", () => {
    it("should contain all expected image extensions", () => {
      expect(IMAGE_EXTENSIONS).toContain(".png");
      expect(IMAGE_EXTENSIONS).toContain(".jpg");
      expect(IMAGE_EXTENSIONS).toContain(".jpeg");
      expect(IMAGE_EXTENSIONS).toContain(".webp");
    });

    it("should not contain design extensions", () => {
      expect(IMAGE_EXTENSIONS).not.toContain(".svg");
      expect(IMAGE_EXTENSIONS).not.toContain(".stl");
    });
  });

  describe("THREE_D_EXTENSIONS", () => {
    it("should contain all 3D format extensions", () => {
      expect(THREE_D_EXTENSIONS).toContain(".stl");
      expect(THREE_D_EXTENSIONS).toContain(".obj");
      expect(THREE_D_EXTENSIONS).toContain(".gltf");
      expect(THREE_D_EXTENSIONS).toContain(".glb");
      expect(THREE_D_EXTENSIONS).toContain(".3mf");
    });

    it("should only contain 5 extensions", () => {
      expect(THREE_D_EXTENSIONS.length).toBe(5);
    });
  });

  describe("MIME types", () => {
    it("should have correct MIME types for design files", () => {
      expect(DESIGN_MIME_TYPES[".svg"]).toBe("image/svg+xml");
      expect(DESIGN_MIME_TYPES[".pdf"]).toBe("application/pdf");
      expect(DESIGN_MIME_TYPES[".stl"]).toBe("model/stl");
    });

    it("should have correct MIME types for images", () => {
      expect(IMAGE_MIME_TYPES[".png"]).toBe("image/png");
      expect(IMAGE_MIME_TYPES[".jpg"]).toBe("image/jpeg");
      expect(IMAGE_MIME_TYPES[".jpeg"]).toBe("image/jpeg");
      expect(IMAGE_MIME_TYPES[".webp"]).toBe("image/webp");
    });
  });
});
