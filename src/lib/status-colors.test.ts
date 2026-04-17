import { describe, it, expect } from "vitest";
import { STATUS_COLORS } from "./status-colors";

describe("STATUS_COLORS", () => {
  it("maps all four PostStatus values to Tailwind classes", () => {
    expect(Object.keys(STATUS_COLORS)).toEqual([
      "draft",
      "published",
      "private",
      "archived",
    ]);
  });

  it("each value contains Tailwind class strings", () => {
    for (const value of Object.values(STATUS_COLORS)) {
      expect(typeof value).toBe("string");
      expect(value.length).toBeGreaterThan(0);
    }
  });
});
