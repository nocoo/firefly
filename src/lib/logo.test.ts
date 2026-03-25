import { describe, it, expect, vi } from "vitest";

// Mock server-only (noop in test environment)
vi.mock("server-only", () => ({}));

// Mock r2-client before importing logo
vi.mock("./r2-client", () => ({
  getR2PublicUrl: vi.fn(() => "https://test-cdn.example.com"),
}));

// Mock r2 to provide a stable key prefix for tests
vi.mock("./r2", () => ({
  getR2KeyPrefix: vi.fn(() => "uploads/firefly/"),
}));

import { getLogoUrl, getLogoR2Key, LOGO_SIZES, type LogoSize } from "./logo";

describe("getLogoUrl", () => {
  it("builds correct URL for a given version and size", () => {
    expect(getLogoUrl("a1b2c3d4", 32)).toBe(
      "https://test-cdn.example.com/uploads/firefly/site/a1b2c3d4/logo-32.png",
    );
  });

  it("builds correct URL for all standard sizes", () => {
    const sizes: LogoSize[] = [16, 32, 48, 80, 180, 192, 512];
    for (const size of sizes) {
      const url = getLogoUrl("ver123", size);
      expect(url).toContain(`/logo-${size}.png`);
      expect(url).toContain("/ver123/");
      expect(url.startsWith("https://test-cdn.example.com/")).toBe(true);
    }
  });
});

describe("getLogoR2Key", () => {
  it("builds R2 key without CDN prefix", () => {
    expect(getLogoR2Key("a1b2c3d4", 32)).toBe(
      "uploads/firefly/site/a1b2c3d4/logo-32.png",
    );
  });

  it("does not include protocol or domain", () => {
    const key = getLogoR2Key("ver123", 512);
    expect(key).not.toContain("https://");
    expect(key).toMatch(/^uploads\/firefly\//);
  });
});

describe("LOGO_SIZES", () => {
  it("contains all 7 standard sizes", () => {
    expect(LOGO_SIZES).toEqual([16, 32, 48, 80, 180, 192, 512]);
  });
});
