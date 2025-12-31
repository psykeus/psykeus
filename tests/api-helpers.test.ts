/**
 * Tests for lib/api/helpers.ts
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import {
  getAnonymizedIp,
  parsePaginationParams,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
  featureDisabledResponse,
} from "@/lib/api/helpers";

describe("API Helpers", () => {
  // =========================================================================
  // getAnonymizedIp
  // =========================================================================
  describe("getAnonymizedIp", () => {
    it("extracts and anonymizes IPv4 from x-forwarded-for header", () => {
      const request = new NextRequest("http://localhost/api/test", {
        headers: { "x-forwarded-for": "192.168.1.100" },
      });
      const ip = getAnonymizedIp(request);
      expect(ip).toBe("192.168.1.0");
    });

    it("handles multiple IPs in x-forwarded-for (takes first)", () => {
      const request = new NextRequest("http://localhost/api/test", {
        headers: { "x-forwarded-for": "192.168.1.100, 10.0.0.1, 172.16.0.1" },
      });
      const ip = getAnonymizedIp(request);
      expect(ip).toBe("192.168.1.0");
    });

    it("anonymizes IPv6 addresses", () => {
      const request = new NextRequest("http://localhost/api/test", {
        headers: { "x-forwarded-for": "2001:db8:85a3::8a2e:370:7334" },
      });
      const ip = getAnonymizedIp(request);
      expect(ip).toBe("2001:db8:85a3::");
    });

    it("returns null when x-forwarded-for is missing", () => {
      const request = new NextRequest("http://localhost/api/test");
      const ip = getAnonymizedIp(request);
      expect(ip).toBeNull();
    });

    it("handles whitespace in x-forwarded-for", () => {
      const request = new NextRequest("http://localhost/api/test", {
        headers: { "x-forwarded-for": "  192.168.1.100  " },
      });
      const ip = getAnonymizedIp(request);
      expect(ip).toBe("192.168.1.0");
    });
  });

  // =========================================================================
  // parsePaginationParams
  // =========================================================================
  describe("parsePaginationParams", () => {
    it("returns default values when no params provided", () => {
      const params = new URLSearchParams();
      const result = parsePaginationParams(params);

      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
      expect(result.from).toBe(0);
      expect(result.to).toBe(19);
    });

    it("parses page and pageSize from query params", () => {
      const params = new URLSearchParams({ page: "3", pageSize: "50" });
      const result = parsePaginationParams(params);

      expect(result.page).toBe(3);
      expect(result.pageSize).toBe(50);
      expect(result.from).toBe(100); // (3-1) * 50
      expect(result.to).toBe(149);
    });

    it("respects custom default pageSize", () => {
      const params = new URLSearchParams();
      const result = parsePaginationParams(params, { defaultPageSize: 10 });

      expect(result.pageSize).toBe(10);
      expect(result.from).toBe(0);
      expect(result.to).toBe(9);
    });

    it("caps pageSize at maxPageSize", () => {
      const params = new URLSearchParams({ pageSize: "500" });
      const result = parsePaginationParams(params, { maxPageSize: 50 });

      expect(result.pageSize).toBe(50);
    });

    it("ensures page is at least 1", () => {
      const params = new URLSearchParams({ page: "-5" });
      const result = parsePaginationParams(params);

      expect(result.page).toBe(1);
    });

    it("ensures pageSize is at least 1", () => {
      const params = new URLSearchParams({ pageSize: "0" });
      const result = parsePaginationParams(params);

      expect(result.pageSize).toBe(1);
    });

    it("handles non-numeric values gracefully", () => {
      const params = new URLSearchParams({ page: "invalid", pageSize: "bad" });
      const result = parsePaginationParams(params);

      // Invalid values fall back to defaults
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20); // Default pageSize
    });
  });

  // =========================================================================
  // Response Helpers
  // =========================================================================
  describe("Response Helpers", () => {
    describe("unauthorizedResponse", () => {
      it("returns 401 status with error message", async () => {
        const response = unauthorizedResponse();
        expect(response.status).toBe(401);

        const body = await response.json();
        expect(body.error).toBe("Authentication required");
      });

      it("includes custom headers", async () => {
        const response = unauthorizedResponse({ "X-Custom": "value" });
        expect(response.headers.get("X-Custom")).toBe("value");
      });
    });

    describe("forbiddenResponse", () => {
      it("returns 403 status with default message", async () => {
        const response = forbiddenResponse();
        expect(response.status).toBe(403);

        const body = await response.json();
        expect(body.error).toBe("Access denied");
      });

      it("accepts custom message", async () => {
        const response = forbiddenResponse("Custom forbidden message");
        const body = await response.json();
        expect(body.error).toBe("Custom forbidden message");
      });
    });

    describe("notFoundResponse", () => {
      it("returns 404 status with default message", async () => {
        const response = notFoundResponse();
        expect(response.status).toBe(404);

        const body = await response.json();
        expect(body.error).toBe("Resource not found");
      });

      it("accepts custom resource name", async () => {
        const response = notFoundResponse("Design");
        const body = await response.json();
        expect(body.error).toBe("Design not found");
      });
    });

    describe("featureDisabledResponse", () => {
      it("returns 403 status with feature name", async () => {
        const response = featureDisabledResponse("Favorites");
        expect(response.status).toBe(403);

        const body = await response.json();
        expect(body.error).toBe("Favorites feature is disabled");
      });
    });
  });
});
