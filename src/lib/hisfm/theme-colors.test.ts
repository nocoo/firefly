import { describe, it, expect } from "vitest";
import {
  parseHexColor,
  contrastRatio,
  resolveCardAccent,
  pickReadableOnAccent,
} from "./theme-colors";

describe("theme-colors", () => {
  it("parses 6-digit hex only", () => {
    expect(parseHexColor("#A6AF94")).toBe("#A6AF94");
    expect(parseHexColor("#abc")).toBeNull();
    expect(parseHexColor("red")).toBeNull();
  });

  it("resolves accent when contrast on journal surface is sufficient", () => {
    const accent = resolveCardAccent(
      { accent: "#263C35", ink: "#263C35" },
      false,
    );
    expect(accent).toBe("#263C35");
  });

  it("picks readable play button foreground", () => {
    expect(pickReadableOnAccent("#A6AF94")).toMatch(/^#(FFFFFF|000000)$/);
    expect(contrastRatio("#FFFFFF", "#263C35")).toBeGreaterThan(4.5);
  });

  it("returns null accent when color fails contrast on surface", () => {
    expect(
      resolveCardAccent({ accent: "#ECEBE1", ink: "#ECEBE1" }, false),
    ).toBeNull();
  });
});
