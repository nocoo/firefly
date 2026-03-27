import { describe, it, expect } from "vitest";
import { ok, error } from "./response";

describe("ok", () => {
  it("serializes data as pretty JSON in content array", () => {
    const result = ok({ name: "Test", count: 42 });
    expect(result.content).toHaveLength(1);
    expect(result.content[0]).toEqual({
      type: "text",
      text: JSON.stringify({ name: "Test", count: 42 }, null, 2),
    });
  });

  it("does not set isError", () => {
    const result = ok({ ok: true });
    expect(result.isError).toBeUndefined();
  });

  it("handles arrays", () => {
    const result = ok([1, 2, 3]);
    const item = result.content[0];
    expect(item.type).toBe("text");
    if (item.type === "text") {
      const parsed = JSON.parse(item.text);
      expect(parsed).toEqual([1, 2, 3]);
    }
  });

  it("handles null", () => {
    const result = ok(null);
    const item = result.content[0];
    expect(item.type).toBe("text");
    if (item.type === "text") {
      expect(item.text).toBe("null");
    }
  });
});

describe("error", () => {
  it("returns message in content with isError: true", () => {
    const result = error("Something went wrong");
    expect(result.content).toHaveLength(1);
    expect(result.content[0]).toEqual({
      type: "text",
      text: "Something went wrong",
    });
    expect(result.isError).toBe(true);
  });
});
