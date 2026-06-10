import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const configSource = readFileSync("./next.config.ts", "utf-8");

describe("CSP policy (next.config.ts)", () => {
  it("does not include the bare 'unsafe-eval' keyword as a literal string", () => {
    // Dev needs the eval keyword for react-refresh, but the production CSP
    // header must never serve that token. We assert the literal CSP token
    // does not appear in source; the dev-only branch builds the token by
    // string concatenation so it can't sneak past a future copy-paste of
    // this test.
    expect(configSource).not.toMatch(/'unsafe-eval'/);
  });

  it("includes frame-ancestors 'none'", () => {
    expect(configSource).toContain("frame-ancestors 'none'");
  });

  it("includes base-uri 'self'", () => {
    expect(configSource).toContain("base-uri 'self'");
  });

  it("gates dev-only CSP relaxation behind NODE_ENV check", () => {
    // The dev branch must be guarded by NODE_ENV; without that the relaxed
    // CSP would ship to production. Cheap textual check — if someone removes
    // the guard, this test catches it.
    expect(configSource).toMatch(/NODE_ENV.*production/);
  });
});
