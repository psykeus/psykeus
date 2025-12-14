import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  checkRateLimit,
  getClientIdentifier,
  RATE_LIMITS,
} from "@/lib/rate-limit";

// Reset module state between tests
beforeEach(() => {
  vi.useFakeTimers();
});

describe("checkRateLimit", () => {
  describe("basic functionality", () => {
    it("should allow requests within the limit", () => {
      const config = { limit: 5, windowSeconds: 60 };
      const identifier = `test-${Date.now()}-${Math.random()}`;

      const result = checkRateLimit(identifier, config);

      expect(result.success).toBe(true);
      expect(result.remaining).toBe(4);
    });

    it("should track request count", () => {
      const config = { limit: 5, windowSeconds: 60 };
      const identifier = `test-count-${Date.now()}-${Math.random()}`;

      checkRateLimit(identifier, config); // 1
      checkRateLimit(identifier, config); // 2
      const result = checkRateLimit(identifier, config); // 3

      expect(result.remaining).toBe(2);
    });

    it("should block requests over the limit", () => {
      const config = { limit: 3, windowSeconds: 60 };
      const identifier = `test-block-${Date.now()}-${Math.random()}`;

      checkRateLimit(identifier, config); // 1
      checkRateLimit(identifier, config); // 2
      checkRateLimit(identifier, config); // 3
      const result = checkRateLimit(identifier, config); // 4 - blocked

      expect(result.success).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it("should reset after window expires", () => {
      const config = { limit: 3, windowSeconds: 60 };
      const identifier = `test-reset-${Date.now()}-${Math.random()}`;

      checkRateLimit(identifier, config); // 1
      checkRateLimit(identifier, config); // 2
      checkRateLimit(identifier, config); // 3

      // Advance time past window
      vi.advanceTimersByTime(61000);

      const result = checkRateLimit(identifier, config);

      expect(result.success).toBe(true);
      expect(result.remaining).toBe(2);
    });
  });

  describe("headers", () => {
    it("should include rate limit headers", () => {
      const config = { limit: 10, windowSeconds: 60 };
      const identifier = `test-headers-${Date.now()}-${Math.random()}`;

      const result = checkRateLimit(identifier, config);

      expect(result.headers).toHaveProperty("X-RateLimit-Limit");
      expect(result.headers).toHaveProperty("X-RateLimit-Remaining");
      expect(result.headers).toHaveProperty("X-RateLimit-Reset");
    });

    it("should have correct limit in headers", () => {
      const config = { limit: 100, windowSeconds: 60 };
      const identifier = `test-limit-${Date.now()}-${Math.random()}`;

      const result = checkRateLimit(identifier, config);

      expect(result.headers["X-RateLimit-Limit"]).toBe("100");
    });

    it("should have remaining count in headers", () => {
      const config = { limit: 10, windowSeconds: 60 };
      const identifier = `test-remaining-${Date.now()}-${Math.random()}`;

      checkRateLimit(identifier, config); // 1
      checkRateLimit(identifier, config); // 2
      const result = checkRateLimit(identifier, config); // 3

      expect(result.headers["X-RateLimit-Remaining"]).toBe("7");
    });

    it("should have reset timestamp in headers", () => {
      const config = { limit: 10, windowSeconds: 60 };
      const identifier = `test-timestamp-${Date.now()}-${Math.random()}`;

      const result = checkRateLimit(identifier, config);
      const resetTime = parseInt(result.headers["X-RateLimit-Reset"]);

      // Reset time should be in the future (within 60 seconds)
      const now = Math.ceil(Date.now() / 1000);
      expect(resetTime).toBeGreaterThan(now);
      expect(resetTime).toBeLessThanOrEqual(now + 60);
    });
  });

  describe("different identifiers", () => {
    it("should track different identifiers separately", () => {
      const config = { limit: 3, windowSeconds: 60 };

      const id1 = `user-1-${Date.now()}`;
      const id2 = `user-2-${Date.now()}`;

      // Exhaust limit for id1
      checkRateLimit(id1, config);
      checkRateLimit(id1, config);
      checkRateLimit(id1, config);
      const result1 = checkRateLimit(id1, config);

      // id2 should still have full limit
      const result2 = checkRateLimit(id2, config);

      expect(result1.success).toBe(false);
      expect(result2.success).toBe(true);
      expect(result2.remaining).toBe(2);
    });
  });
});

describe("getClientIdentifier", () => {
  it("should prefer user ID if provided", () => {
    const request = new Request("https://example.com/api/test");
    const identifier = getClientIdentifier(request, "user-123");

    expect(identifier).toBe("user:user-123");
  });

  it("should use x-forwarded-for header", () => {
    const request = new Request("https://example.com/api/test", {
      headers: {
        "x-forwarded-for": "192.168.1.100, 10.0.0.1",
      },
    });

    const identifier = getClientIdentifier(request);

    expect(identifier).toBe("ip:192.168.1.100");
  });

  it("should use x-real-ip header as fallback", () => {
    const request = new Request("https://example.com/api/test", {
      headers: {
        "x-real-ip": "172.16.0.50",
      },
    });

    const identifier = getClientIdentifier(request);

    expect(identifier).toBe("ip:172.16.0.50");
  });

  it("should fallback to localhost", () => {
    const request = new Request("https://example.com/api/test");
    const identifier = getClientIdentifier(request);

    expect(identifier).toBe("ip:127.0.0.1");
  });

  it("should prefer user ID over IP headers", () => {
    const request = new Request("https://example.com/api/test", {
      headers: {
        "x-forwarded-for": "192.168.1.100",
      },
    });

    const identifier = getClientIdentifier(request, "user-456");

    expect(identifier).toBe("user:user-456");
  });
});

describe("RATE_LIMITS presets", () => {
  it("should have browse preset", () => {
    expect(RATE_LIMITS.browse).toEqual({ limit: 100, windowSeconds: 60 });
  });

  it("should have search preset", () => {
    expect(RATE_LIMITS.search).toEqual({ limit: 60, windowSeconds: 60 });
  });

  it("should have download preset", () => {
    expect(RATE_LIMITS.download).toEqual({ limit: 30, windowSeconds: 60 });
  });

  it("should have auth preset", () => {
    expect(RATE_LIMITS.auth).toEqual({ limit: 10, windowSeconds: 60 });
  });

  it("should have admin preset", () => {
    expect(RATE_LIMITS.admin).toEqual({ limit: 120, windowSeconds: 60 });
  });

  it("should have upload preset", () => {
    expect(RATE_LIMITS.upload).toEqual({ limit: 20, windowSeconds: 60 });
  });
});

describe("rate limit edge cases", () => {
  it("should handle exactly at limit", () => {
    const config = { limit: 3, windowSeconds: 60 };
    const identifier = `edge-${Date.now()}-${Math.random()}`;

    checkRateLimit(identifier, config); // 1
    checkRateLimit(identifier, config); // 2
    const result = checkRateLimit(identifier, config); // 3 - exactly at limit

    expect(result.success).toBe(true);
    expect(result.remaining).toBe(0);
  });

  it("should handle limit of 1", () => {
    const config = { limit: 1, windowSeconds: 60 };
    const identifier = `single-${Date.now()}-${Math.random()}`;

    const result1 = checkRateLimit(identifier, config);
    const result2 = checkRateLimit(identifier, config);

    expect(result1.success).toBe(true);
    expect(result1.remaining).toBe(0);
    expect(result2.success).toBe(false);
  });

  it("should handle short window", () => {
    const config = { limit: 5, windowSeconds: 1 };
    const identifier = `short-${Date.now()}-${Math.random()}`;

    // Exhaust limit
    for (let i = 0; i < 5; i++) {
      checkRateLimit(identifier, config);
    }

    const blocked = checkRateLimit(identifier, config);
    expect(blocked.success).toBe(false);

    // Wait for window to expire
    vi.advanceTimersByTime(1100);

    const allowed = checkRateLimit(identifier, config);
    expect(allowed.success).toBe(true);
  });
});
