import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const configSource = readFileSync("./next.config.ts", "utf-8");

describe("CSP policy (next.config.ts)", () => {
  it("does not allow unsafe-eval in script-src", () => {
    expect(configSource).not.toContain("unsafe-eval");
  });

  it("includes frame-ancestors 'none'", () => {
    expect(configSource).toContain("frame-ancestors 'none'");
  });

  it("includes base-uri 'self'", () => {
    expect(configSource).toContain("base-uri 'self'");
  });
});
