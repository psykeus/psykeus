import { describe, it, expect } from "vitest";
import { hasRole, isAdmin, isSuperAdmin } from "@/lib/auth";
import type { User } from "@/lib/types";

// Helper to create a mock user
function createMockUser(role: "user" | "admin" | "super_admin"): User {
  return {
    id: "test-user-id",
    email: "test@example.com",
    role,
    name: "Test User",
    created_at: new Date().toISOString(),
    tier_id: null,
    tier_expires_at: null,
    status: "active",
    suspended_reason: null,
    suspended_at: null,
    suspended_by: null,
    paused_reason: null,
    paused_at: null,
    paused_by: null,
    disabled_reason: null,
    disabled_at: null,
    disabled_by: null,
    last_login_at: null,
    login_count: 0,
    profile_image_url: null,
    bio: null,
    website: null,
    updated_at: null,
  };
}

describe("hasRole", () => {
  describe("with valid user", () => {
    it("should return true when user has the specified role", () => {
      const user = createMockUser("admin");
      expect(hasRole(user, ["admin"])).toBe(true);
    });

    it("should return true when user has one of multiple roles", () => {
      const user = createMockUser("admin");
      expect(hasRole(user, ["user", "admin", "super_admin"])).toBe(true);
    });

    it("should return false when user does not have any of the roles", () => {
      const user = createMockUser("user");
      expect(hasRole(user, ["admin", "super_admin"])).toBe(false);
    });

    it("should handle single role in array", () => {
      const user = createMockUser("super_admin");
      expect(hasRole(user, ["super_admin"])).toBe(true);
    });
  });

  describe("with null user", () => {
    it("should return false", () => {
      expect(hasRole(null, ["admin"])).toBe(false);
      expect(hasRole(null, ["user", "admin"])).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("should return false for empty roles array", () => {
      const user = createMockUser("admin");
      expect(hasRole(user, [])).toBe(false);
    });
  });
});

describe("isAdmin", () => {
  it("should return true for admin role", () => {
    const user = createMockUser("admin");
    expect(isAdmin(user)).toBe(true);
  });

  it("should return true for super_admin role", () => {
    const user = createMockUser("super_admin");
    expect(isAdmin(user)).toBe(true);
  });

  it("should return false for user role", () => {
    const user = createMockUser("user");
    expect(isAdmin(user)).toBe(false);
  });

  it("should return false for null user", () => {
    expect(isAdmin(null)).toBe(false);
  });
});

describe("isSuperAdmin", () => {
  it("should return true for super_admin role", () => {
    const user = createMockUser("super_admin");
    expect(isSuperAdmin(user)).toBe(true);
  });

  it("should return false for admin role", () => {
    const user = createMockUser("admin");
    expect(isSuperAdmin(user)).toBe(false);
  });

  it("should return false for user role", () => {
    const user = createMockUser("user");
    expect(isSuperAdmin(user)).toBe(false);
  });

  it("should return false for null user", () => {
    expect(isSuperAdmin(null)).toBe(false);
  });
});

describe("Role hierarchy behavior", () => {
  it("super_admin should pass admin checks", () => {
    const superAdmin = createMockUser("super_admin");
    expect(isAdmin(superAdmin)).toBe(true);
  });

  it("admin should NOT pass super_admin checks", () => {
    const admin = createMockUser("admin");
    expect(isSuperAdmin(admin)).toBe(false);
  });

  it("user should NOT pass any admin checks", () => {
    const user = createMockUser("user");
    expect(isAdmin(user)).toBe(false);
    expect(isSuperAdmin(user)).toBe(false);
  });
});
