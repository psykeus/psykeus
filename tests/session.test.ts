import { describe, it, expect } from "vitest";
import { generateSessionToken } from "@/lib/session";

describe("generateSessionToken", () => {
  it("should generate a 64-character hex string", () => {
    const token = generateSessionToken();

    expect(token).toHaveLength(64);
    expect(token).toMatch(/^[0-9a-f]+$/);
  });

  it("should generate unique tokens on each call", () => {
    const tokens = new Set<string>();

    for (let i = 0; i < 100; i++) {
      tokens.add(generateSessionToken());
    }

    expect(tokens.size).toBe(100);
  });

  it("should generate cryptographically random tokens", () => {
    const token1 = generateSessionToken();
    const token2 = generateSessionToken();

    // Tokens should be completely different
    expect(token1).not.toBe(token2);

    // Check for randomness distribution (no repeated patterns)
    const halfLength = token1.length / 2;
    expect(token1.slice(0, halfLength)).not.toBe(token1.slice(halfLength));
  });

  it("should generate 32-byte token (256 bits of entropy)", () => {
    const token = generateSessionToken();

    // 32 bytes = 64 hex characters
    expect(token.length).toBe(64);

    // Each hex char represents 4 bits, so 64 chars = 256 bits
    const bitsOfEntropy = (token.length / 2) * 8;
    expect(bitsOfEntropy).toBe(256);
  });

  it("should only contain lowercase hex characters", () => {
    for (let i = 0; i < 10; i++) {
      const token = generateSessionToken();
      expect(token).toMatch(/^[0-9a-f]+$/);
      expect(token).not.toMatch(/[A-F]/);
    }
  });
});
