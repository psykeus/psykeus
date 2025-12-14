import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  browseDesignsSchema,
  designSlugSchema,
  designIdSchema,
  updateDesignSchema,
  createDesignSchema,
  createTagSchema,
  updateTagsSchema,
  createCollectionSchema,
  updateCollectionSchema,
  favoriteParamsSchema,
  collectionParamsSchema,
  addCollectionItemSchema,
  removeCollectionItemSchema,
  updateCollectionItemSchema,
  parseSearchParams,
  formatZodError,
  escapeIlikePattern,
} from "@/lib/validations";

describe("browseDesignsSchema", () => {
  it("should accept valid browse parameters", () => {
    const result = browseDesignsSchema.parse({
      q: "test query",
      tag: "woodworking",
      difficulty: "beginner",
      category: "furniture",
      page: 1,
      pageSize: 30,
    });

    expect(result.q).toBe("test query");
    expect(result.difficulty).toBe("beginner");
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(30);
  });

  it("should use defaults for missing values", () => {
    const result = browseDesignsSchema.parse({});
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(30);
  });

  it("should coerce page and pageSize to numbers", () => {
    const result = browseDesignsSchema.parse({
      page: "5",
      pageSize: "50",
    });
    expect(result.page).toBe(5);
    expect(result.pageSize).toBe(50);
  });

  it("should trim search query", () => {
    const result = browseDesignsSchema.parse({ q: "  test  " });
    expect(result.q).toBe("test");
  });

  it("should transform empty difficulty to undefined", () => {
    const result = browseDesignsSchema.parse({ difficulty: "" });
    expect(result.difficulty).toBeUndefined();
  });

  it("should reject page size over 100", () => {
    expect(() => browseDesignsSchema.parse({ pageSize: 200 })).toThrow();
  });

  it("should reject page less than 1", () => {
    expect(() => browseDesignsSchema.parse({ page: 0 })).toThrow();
  });

  it("should reject query over 200 characters", () => {
    expect(() =>
      browseDesignsSchema.parse({ q: "a".repeat(201) })
    ).toThrow();
  });
});

describe("designSlugSchema", () => {
  it("should accept valid slugs", () => {
    const result = designSlugSchema.parse({ slug: "my-design-123" });
    expect(result.slug).toBe("my-design-123");
  });

  it("should reject invalid slugs", () => {
    expect(() => designSlugSchema.parse({ slug: "Invalid Slug!" })).toThrow();
    expect(() => designSlugSchema.parse({ slug: "UPPERCASE" })).toThrow();
    expect(() => designSlugSchema.parse({ slug: "" })).toThrow();
  });

  it("should reject slugs over 200 characters", () => {
    expect(() => designSlugSchema.parse({ slug: "a".repeat(201) })).toThrow();
  });
});

describe("designIdSchema", () => {
  const validUuid = "550e8400-e29b-41d4-a716-446655440000";

  it("should accept valid UUIDs", () => {
    const result = designIdSchema.parse({ id: validUuid });
    expect(result.id).toBe(validUuid);
  });

  it("should reject invalid UUIDs", () => {
    expect(() => designIdSchema.parse({ id: "not-a-uuid" })).toThrow();
    expect(() => designIdSchema.parse({ id: "123" })).toThrow();
  });

  it("should accept optional designId", () => {
    const result = designIdSchema.parse({ id: validUuid, designId: validUuid });
    expect(result.designId).toBe(validUuid);
  });
});

describe("updateDesignSchema", () => {
  it("should accept valid updates", () => {
    const result = updateDesignSchema.parse({
      title: "Updated Title",
      description: "New description",
      is_public: true,
      difficulty: "intermediate",
    });

    expect(result.title).toBe("Updated Title");
    expect(result.is_public).toBe(true);
  });

  it("should accept empty updates", () => {
    const result = updateDesignSchema.parse({});
    expect(Object.keys(result).length).toBe(0);
  });

  it("should reject title over 500 characters", () => {
    expect(() =>
      updateDesignSchema.parse({ title: "a".repeat(501) })
    ).toThrow();
  });

  it("should reject description over 10000 characters", () => {
    expect(() =>
      updateDesignSchema.parse({ description: "a".repeat(10001) })
    ).toThrow();
  });

  it("should accept categories array", () => {
    const result = updateDesignSchema.parse({
      categories: ["furniture", "storage"],
    });
    expect(result.categories).toEqual(["furniture", "storage"]);
  });

  it("should reject more than 20 categories", () => {
    expect(() =>
      updateDesignSchema.parse({
        categories: Array(21).fill("category"),
      })
    ).toThrow();
  });
});

describe("createDesignSchema", () => {
  it("should require title and preview_path", () => {
    expect(() =>
      createDesignSchema.parse({
        slug: "test-slug",
        preview_path: "/path/to/preview",
      })
    ).toThrow();

    expect(() =>
      createDesignSchema.parse({
        title: "Test",
        slug: "test-slug",
      })
    ).toThrow();
  });

  it("should accept valid design creation data", () => {
    const result = createDesignSchema.parse({
      title: "My Design",
      slug: "my-design",
      preview_path: "/previews/design.png",
      is_public: true,
    });

    expect(result.title).toBe("My Design");
    expect(result.is_public).toBe(true);
  });

  it("should default is_public to false", () => {
    const result = createDesignSchema.parse({
      title: "My Design",
      slug: "my-design",
      preview_path: "/previews/design.png",
    });

    expect(result.is_public).toBe(false);
  });
});

describe("createTagSchema", () => {
  it("should normalize tag names to lowercase", () => {
    const result = createTagSchema.parse({ name: "WoodWorking" });
    expect(result.name).toBe("woodworking");
  });

  it("should trim whitespace", () => {
    const result = createTagSchema.parse({ name: "  laser cut  " });
    expect(result.name).toBe("laser cut");
  });

  it("should reject empty tag names", () => {
    expect(() => createTagSchema.parse({ name: "" })).toThrow();
  });

  it("should reject tag names over 100 characters", () => {
    expect(() => createTagSchema.parse({ name: "a".repeat(101) })).toThrow();
  });
});

describe("updateTagsSchema", () => {
  const validUuid = "550e8400-e29b-41d4-a716-446655440000";

  it("should accept array of UUIDs", () => {
    const result = updateTagsSchema.parse({ tagIds: [validUuid] });
    expect(result.tagIds).toHaveLength(1);
  });

  it("should reject more than 50 tags", () => {
    expect(() =>
      updateTagsSchema.parse({
        tagIds: Array(51).fill(validUuid),
      })
    ).toThrow();
  });

  it("should reject invalid UUIDs", () => {
    expect(() => updateTagsSchema.parse({ tagIds: ["not-uuid"] })).toThrow();
  });
});

describe("Collection schemas", () => {
  describe("createCollectionSchema", () => {
    it("should accept valid collection data", () => {
      const result = createCollectionSchema.parse({
        name: "My Collection",
        description: "A test collection",
        is_public: true,
      });

      expect(result.name).toBe("My Collection");
      expect(result.is_public).toBe(true);
    });

    it("should trim name", () => {
      const result = createCollectionSchema.parse({
        name: "  Trimmed Name  ",
      });
      expect(result.name).toBe("Trimmed Name");
    });

    it("should default is_public to false", () => {
      const result = createCollectionSchema.parse({ name: "Test" });
      expect(result.is_public).toBe(false);
    });

    it("should reject empty name", () => {
      expect(() => createCollectionSchema.parse({ name: "" })).toThrow();
    });

    it("should reject name over 255 characters", () => {
      expect(() =>
        createCollectionSchema.parse({ name: "a".repeat(256) })
      ).toThrow();
    });
  });

  describe("updateCollectionSchema", () => {
    it("should accept partial updates", () => {
      const result = updateCollectionSchema.parse({ name: "Updated" });
      expect(result.name).toBe("Updated");
    });

    it("should accept null description", () => {
      const result = updateCollectionSchema.parse({ description: null });
      expect(result.description).toBeNull();
    });

    it("should accept valid cover_image_url", () => {
      const result = updateCollectionSchema.parse({
        cover_image_url: "https://example.com/image.png",
      });
      expect(result.cover_image_url).toBe("https://example.com/image.png");
    });

    it("should reject invalid URLs", () => {
      expect(() =>
        updateCollectionSchema.parse({ cover_image_url: "not-a-url" })
      ).toThrow();
    });
  });
});

describe("Favorite and Collection param schemas", () => {
  const validUuid = "550e8400-e29b-41d4-a716-446655440000";

  describe("favoriteParamsSchema", () => {
    it("should accept valid design ID", () => {
      const result = favoriteParamsSchema.parse({ designId: validUuid });
      expect(result.designId).toBe(validUuid);
    });

    it("should reject invalid UUIDs", () => {
      expect(() =>
        favoriteParamsSchema.parse({ designId: "invalid" })
      ).toThrow();
    });
  });

  describe("collectionParamsSchema", () => {
    it("should accept valid collection ID", () => {
      const result = collectionParamsSchema.parse({ id: validUuid });
      expect(result.id).toBe(validUuid);
    });

    it("should reject invalid UUIDs", () => {
      expect(() => collectionParamsSchema.parse({ id: "invalid" })).toThrow();
    });
  });

  describe("addCollectionItemSchema", () => {
    it("should accept valid design_id", () => {
      const result = addCollectionItemSchema.parse({ design_id: validUuid });
      expect(result.design_id).toBe(validUuid);
    });

    it("should accept optional notes", () => {
      const result = addCollectionItemSchema.parse({
        design_id: validUuid,
        notes: "Some notes",
      });
      expect(result.notes).toBe("Some notes");
    });

    it("should reject notes over 1000 characters", () => {
      expect(() =>
        addCollectionItemSchema.parse({
          design_id: validUuid,
          notes: "a".repeat(1001),
        })
      ).toThrow();
    });
  });

  describe("removeCollectionItemSchema", () => {
    it("should accept design_id", () => {
      const result = removeCollectionItemSchema.parse({
        design_id: validUuid,
      });
      expect(result.design_id).toBe(validUuid);
    });

    it("should accept item_id", () => {
      const result = removeCollectionItemSchema.parse({ item_id: validUuid });
      expect(result.item_id).toBe(validUuid);
    });

    it("should reject if neither is provided", () => {
      expect(() => removeCollectionItemSchema.parse({})).toThrow();
    });
  });

  describe("updateCollectionItemSchema", () => {
    it("should require item_id", () => {
      expect(() =>
        updateCollectionItemSchema.parse({ sort_order: 1 })
      ).toThrow();
    });

    it("should accept sort_order update", () => {
      const result = updateCollectionItemSchema.parse({
        item_id: validUuid,
        sort_order: 5,
      });
      expect(result.sort_order).toBe(5);
    });

    it("should accept notes update", () => {
      const result = updateCollectionItemSchema.parse({
        item_id: validUuid,
        notes: "Updated notes",
      });
      expect(result.notes).toBe("Updated notes");
    });

    it("should require at least one update field", () => {
      expect(() =>
        updateCollectionItemSchema.parse({ item_id: validUuid })
      ).toThrow();
    });

    it("should reject negative sort_order", () => {
      expect(() =>
        updateCollectionItemSchema.parse({
          item_id: validUuid,
          sort_order: -1,
        })
      ).toThrow();
    });
  });
});

describe("parseSearchParams", () => {
  it("should parse URL search params through a schema", () => {
    const params = new URLSearchParams("page=2&pageSize=50");
    const result = parseSearchParams(params, browseDesignsSchema);

    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(50);
  });

  it("should handle empty params with defaults", () => {
    const params = new URLSearchParams("");
    const result = parseSearchParams(params, browseDesignsSchema);

    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(30);
  });
});

describe("formatZodError", () => {
  it("should format validation errors", () => {
    const schema = z.object({
      name: z.string().min(1),
      age: z.number().min(0),
    });

    try {
      schema.parse({ name: "", age: -1 });
    } catch (err) {
      if (err instanceof z.ZodError) {
        const message = formatZodError(err);
        expect(message).toContain("name");
        expect(message).toContain("age");
      }
    }
  });

  it("should handle null/undefined errors", () => {
    expect(formatZodError(null)).toBe("Validation failed");
    expect(formatZodError(undefined)).toBe("Validation failed");
  });
});

describe("escapeIlikePattern", () => {
  it("should escape percent signs", () => {
    expect(escapeIlikePattern("100%")).toBe("100\\%");
  });

  it("should escape underscores", () => {
    expect(escapeIlikePattern("test_file")).toBe("test\\_file");
  });

  it("should escape backslashes", () => {
    expect(escapeIlikePattern("path\\to\\file")).toBe("path\\\\to\\\\file");
  });

  it("should escape multiple special characters", () => {
    expect(escapeIlikePattern("100%_test\\file")).toBe(
      "100\\%\\_test\\\\file"
    );
  });

  it("should leave normal text unchanged", () => {
    expect(escapeIlikePattern("hello world")).toBe("hello world");
  });

  it("should handle empty strings", () => {
    expect(escapeIlikePattern("")).toBe("");
  });
});
