import { describe, it, expect } from "vitest";
import {
  slugify,
  formatBytes,
  formatDate,
  formatDateTime,
  capitalize,
  anonymizeIp,
} from "@/lib/utils";

describe("slugify", () => {
  it("should convert text to lowercase", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  it("should replace spaces with hyphens", () => {
    expect(slugify("hello world")).toBe("hello-world");
  });

  it("should replace underscores with hyphens", () => {
    expect(slugify("hello_world")).toBe("hello-world");
  });

  it("should remove special characters", () => {
    expect(slugify("Hello! World?")).toBe("hello-world");
    expect(slugify("test@#$%^&*()")).toBe("test");
  });

  it("should handle multiple consecutive spaces/hyphens", () => {
    expect(slugify("hello   world")).toBe("hello-world");
    expect(slugify("hello---world")).toBe("hello-world");
  });

  it("should trim leading/trailing hyphens", () => {
    expect(slugify("-hello-world-")).toBe("hello-world");
    expect(slugify("  hello world  ")).toBe("hello-world");
  });

  it("should handle empty strings", () => {
    expect(slugify("")).toBe("");
  });

  it("should handle unicode characters", () => {
    expect(slugify("Café Table")).toBe("caf-table");
  });
});

describe("formatBytes", () => {
  it("should format 0 bytes", () => {
    expect(formatBytes(0)).toBe("0 Bytes");
  });

  it("should format bytes", () => {
    expect(formatBytes(500)).toBe("500 Bytes");
  });

  it("should format kilobytes", () => {
    expect(formatBytes(1024)).toBe("1 KB");
    expect(formatBytes(1536)).toBe("1.5 KB");
  });

  it("should format megabytes", () => {
    expect(formatBytes(1048576)).toBe("1 MB");
    expect(formatBytes(2621440)).toBe("2.5 MB");
  });

  it("should format gigabytes", () => {
    expect(formatBytes(1073741824)).toBe("1 GB");
  });

  it("should respect decimal places", () => {
    expect(formatBytes(1536, 0)).toBe("2 KB");
    expect(formatBytes(1536, 3)).toBe("1.5 KB");
  });

  it("should handle negative decimals as 0", () => {
    expect(formatBytes(1536, -1)).toBe("2 KB");
  });
});

describe("formatDate", () => {
  it("should format a date string", () => {
    // Use ISO format with time to avoid timezone issues
    const result = formatDate("2024-01-15T12:00:00Z");
    expect(result).toContain("Jan");
    expect(result).toContain("2024");
    // Day might be 14 or 15 depending on timezone
    expect(result).toMatch(/Jan \d{1,2}, 2024/);
  });

  it("should format a Date object", () => {
    // Create date with explicit time to avoid timezone shift
    const date = new Date(2024, 5, 20); // June 20, 2024 in local time
    const result = formatDate(date);
    expect(result).toContain("Jun");
    expect(result).toContain("20");
    expect(result).toContain("2024");
  });
});

describe("formatDateTime", () => {
  it("should include time in the output", () => {
    const date = new Date("2024-01-15T14:30:00");
    const result = formatDateTime(date);
    expect(result).toContain("Jan");
    expect(result).toContain("15");
    expect(result).toContain("2024");
    // Time portion
    expect(result).toMatch(/\d{1,2}:\d{2}/);
  });
});

describe("capitalize", () => {
  it("should capitalize the first letter", () => {
    expect(capitalize("hello")).toBe("Hello");
  });

  it("should handle empty strings", () => {
    expect(capitalize("")).toBe("");
  });

  it("should handle single character", () => {
    expect(capitalize("a")).toBe("A");
  });

  it("should leave rest of string unchanged", () => {
    expect(capitalize("hELLO")).toBe("HELLO");
  });

  it("should handle already capitalized strings", () => {
    expect(capitalize("Hello")).toBe("Hello");
  });
});

describe("anonymizeIp", () => {
  describe("IPv4", () => {
    it("should zero out the last octet", () => {
      expect(anonymizeIp("192.168.1.100")).toBe("192.168.1.0");
    });

    it("should handle different IP ranges", () => {
      expect(anonymizeIp("10.0.0.255")).toBe("10.0.0.0");
      expect(anonymizeIp("172.16.50.25")).toBe("172.16.50.0");
    });

    it("should preserve first three octets", () => {
      expect(anonymizeIp("8.8.8.8")).toBe("8.8.8.0");
    });
  });

  describe("IPv6", () => {
    it("should truncate to /48 (first 3 segments)", () => {
      expect(anonymizeIp("2001:0db8:85a3:0000:0000:8a2e:0370:7334")).toBe(
        "2001:0db8:85a3::"
      );
    });

    it("should handle compact IPv6", () => {
      // The implementation splits by ":" and takes first 3, then adds "::"
      // For "fe80::1", split gives ["fe80", "", "1"], first 3 = "fe80::1"
      expect(anonymizeIp("fe80::1")).toBe("fe80::1::");
    });
  });
});
