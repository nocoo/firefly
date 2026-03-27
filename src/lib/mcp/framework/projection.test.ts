import { describe, it, expect } from "vitest";
import { projectFields } from "./projection";
import type { ProjectionConfig } from "./types";

const sampleConfig: ProjectionConfig = {
  omit: ["content", "content_html", "wp_id", "wp_permalink"],
  groups: {
    content: ["content"],
    content_html: ["content_html"],
    wp: ["wp_id", "wp_permalink"],
  },
};

const sampleRecord = {
  id: "1",
  title: "Hello",
  slug: "hello",
  content: "Full text...",
  content_html: "<p>Full text...</p>",
  wp_id: 42,
  wp_permalink: "/old/path",
};

describe("projectFields", () => {
  it("omits all configured fields by default", () => {
    const result = projectFields(sampleRecord, sampleConfig);
    expect(result).toEqual({ id: "1", title: "Hello", slug: "hello" });
    expect(result).not.toHaveProperty("content");
    expect(result).not.toHaveProperty("content_html");
    expect(result).not.toHaveProperty("wp_id");
    expect(result).not.toHaveProperty("wp_permalink");
  });

  it("restores fields for a single include group", () => {
    const result = projectFields(sampleRecord, sampleConfig, ["content"]);
    expect(result).toHaveProperty("content", "Full text...");
    expect(result).not.toHaveProperty("content_html");
    expect(result).not.toHaveProperty("wp_id");
  });

  it("restores fields for multiple include groups", () => {
    const result = projectFields(sampleRecord, sampleConfig, [
      "content",
      "wp",
    ]);
    expect(result).toHaveProperty("content");
    expect(result).toHaveProperty("wp_id");
    expect(result).toHaveProperty("wp_permalink");
    expect(result).not.toHaveProperty("content_html");
  });

  it("returns all fields when include contains 'full'", () => {
    const result = projectFields(sampleRecord, sampleConfig, ["full"]);
    expect(result).toEqual(sampleRecord);
  });

  it("handles empty config (no omissions)", () => {
    const result = projectFields(sampleRecord, { omit: [], groups: {} });
    expect(result).toEqual(sampleRecord);
  });

  it("ignores unknown include group names", () => {
    const result = projectFields(sampleRecord, sampleConfig, ["nonexistent"]);
    // Unknown group maps to empty array, so all omits still apply
    expect(result).toEqual({ id: "1", title: "Hello", slug: "hello" });
  });

  it("does not mutate the original record", () => {
    const copy = { ...sampleRecord };
    projectFields(sampleRecord, sampleConfig);
    expect(sampleRecord).toEqual(copy);
  });

  it("handles undefined include (same as no include)", () => {
    const result = projectFields(sampleRecord, sampleConfig, undefined);
    expect(result).toEqual({ id: "1", title: "Hello", slug: "hello" });
  });
});
