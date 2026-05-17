import { describe, it, expect } from "vitest";
import { generatePullWebhookKey } from "./backup.server";

describe("generatePullWebhookKey", () => {
  it("returns a v4-style UUID string", () => {
    const key = generatePullWebhookKey();
    expect(typeof key).toBe("string");
    // 8-4-4-4-12 hex digits with version-4 nibble
    expect(key).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it("generates unique keys across calls", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 100; i++) seen.add(generatePullWebhookKey());
    expect(seen.size).toBe(100);
  });
});
