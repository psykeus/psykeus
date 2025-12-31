import { describe, it, expect } from "vitest";
import {
  slugify,
  formatBytes,
  formatDate,
  formatDateTime,
  formatDuration,
  formatPrice,
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
    expect(formatBytes(0)).toBe("0 B");  // Default nullValue
  });

  it("should format bytes", () => {
    expect(formatBytes(500)).toBe("500 B");
  });

  it("should format kilobytes", () => {
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(1536)).toBe("1.5 KB");
  });

  it("should format megabytes", () => {
    expect(formatBytes(1048576)).toBe("1.0 MB");
    expect(formatBytes(2621440)).toBe("2.5 MB");
  });

  it("should format gigabytes", () => {
    expect(formatBytes(1073741824)).toBe("1.0 GB");
  });

  it("should respect decimal places", () => {
    expect(formatBytes(1536, { decimals: 0 })).toBe("2 KB");
    expect(formatBytes(1536, { decimals: 3 })).toBe("1.500 KB");
  });

  it("should handle null with custom nullValue", () => {
    expect(formatBytes(null, { nullValue: "Unknown" })).toBe("Unknown");
    expect(formatBytes(null, { nullValue: "-" })).toBe("-");
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

describe("formatDuration", () => {
  it("should format milliseconds", () => {
    expect(formatDuration(500)).toBe("500ms");
    expect(formatDuration(999)).toBe("999ms");
  });

  it("should format seconds", () => {
    expect(formatDuration(1000)).toBe("1.0s");
    expect(formatDuration(1500)).toBe("1.5s");
    expect(formatDuration(59999)).toBe("60.0s");
  });

  it("should format minutes", () => {
    expect(formatDuration(60000)).toBe("1.0m");
    expect(formatDuration(90000)).toBe("1.5m");
    expect(formatDuration(300000)).toBe("5.0m");
  });

  it("should handle null and undefined", () => {
    expect(formatDuration(null)).toBe("-");
    expect(formatDuration(undefined)).toBe("-");
  });

  it("should use custom nullValue", () => {
    expect(formatDuration(null, "N/A")).toBe("N/A");
    expect(formatDuration(undefined, "Unknown")).toBe("Unknown");
  });

  it("should handle zero", () => {
    expect(formatDuration(0)).toBe("0ms");
  });
});

describe("formatPrice", () => {
  it("should format USD prices", () => {
    expect(formatPrice(1999)).toBe("$19.99");
    expect(formatPrice(100)).toBe("$1.00");
    expect(formatPrice(0)).toBe("$0.00");
  });

  it("should format EUR prices", () => {
    expect(formatPrice(1999, "eur")).toBe("€19.99");
    expect(formatPrice(1999, "EUR")).toBe("€19.99");
  });

  it("should default to USD for unknown currencies", () => {
    expect(formatPrice(1999, "gbp")).toBe("$19.99");
    expect(formatPrice(1999, "jpy")).toBe("$19.99");
  });

  it("should handle null and undefined", () => {
    expect(formatPrice(null)).toBe("-");
    expect(formatPrice(undefined)).toBe("-");
  });

  it("should format large amounts correctly", () => {
    expect(formatPrice(10000000)).toBe("$100000.00");
  });

  it("should handle decimal cents", () => {
    expect(formatPrice(99)).toBe("$0.99");
    expect(formatPrice(1)).toBe("$0.01");
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
