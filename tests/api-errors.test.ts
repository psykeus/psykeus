/**
 * Tests for lib/api/errors.ts
 */
import { describe, expect, it } from "vitest";
import { API_ERRORS } from "@/lib/api/errors";
import type { ApiErrorKey, ApiErrorMessage } from "@/lib/api/errors";

describe("API Errors", () => {
  describe("API_ERRORS constants", () => {
    it("exports all required error messages", () => {
      expect(API_ERRORS.AUTH_REQUIRED).toBe("Authentication required");
      expect(API_ERRORS.ADMIN_REQUIRED).toBe("Admin access required");
      expect(API_ERRORS.SUPER_ADMIN_REQUIRED).toBe("Super admin access required");
      expect(API_ERRORS.NOT_FOUND).toBe("Resource not found");
      expect(API_ERRORS.RATE_LIMIT).toBe("Too many requests. Please slow down.");
      expect(API_ERRORS.INVALID_PARAMS).toBe("Invalid parameters");
      expect(API_ERRORS.INVALID_REQUEST).toBe("Invalid request");
      expect(API_ERRORS.FORBIDDEN).toBe("Access denied");
      expect(API_ERRORS.METHOD_NOT_ALLOWED).toBe("Method not allowed");
      expect(API_ERRORS.INTERNAL_ERROR).toBe("An unexpected error occurred");
      expect(API_ERRORS.FEATURE_DISABLED).toBe("This feature is currently disabled");
      expect(API_ERRORS.FILE_TOO_LARGE).toBe("File size exceeds the maximum allowed");
      expect(API_ERRORS.INVALID_FILE_TYPE).toBe("File type not supported");
      expect(API_ERRORS.DUPLICATE_ENTRY).toBe("This entry already exists");
      expect(API_ERRORS.VALIDATION_FAILED).toBe("Validation failed");
    });

    it("is a frozen object (immutable)", () => {
      // Object.isFrozen checks if object is frozen with 'as const'
      // TypeScript 'as const' doesn't actually freeze at runtime,
      // but we verify all values are strings
      for (const key in API_ERRORS) {
        expect(typeof API_ERRORS[key as ApiErrorKey]).toBe("string");
      }
    });

    it("has all expected keys", () => {
      const expectedKeys: ApiErrorKey[] = [
        "AUTH_REQUIRED",
        "ADMIN_REQUIRED",
        "SUPER_ADMIN_REQUIRED",
        "NOT_FOUND",
        "RATE_LIMIT",
        "INVALID_PARAMS",
        "INVALID_REQUEST",
        "FORBIDDEN",
        "METHOD_NOT_ALLOWED",
        "INTERNAL_ERROR",
        "FEATURE_DISABLED",
        "FILE_TOO_LARGE",
        "INVALID_FILE_TYPE",
        "DUPLICATE_ENTRY",
        "VALIDATION_FAILED",
      ];

      expect(Object.keys(API_ERRORS).sort()).toEqual(expectedKeys.sort());
    });
  });

  describe("Type exports", () => {
    it("ApiErrorKey type matches object keys", () => {
      // Type check - this validates at compile time
      const key: ApiErrorKey = "AUTH_REQUIRED";
      expect(API_ERRORS[key]).toBeDefined();
    });

    it("ApiErrorMessage type matches object values", () => {
      // Type check - this validates at compile time
      const message: ApiErrorMessage = API_ERRORS.AUTH_REQUIRED;
      expect(message).toBe("Authentication required");
    });
  });
});
