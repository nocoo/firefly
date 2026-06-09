import { describe, expect, it } from "vitest";
import { inferErrorField } from "./post-form-helpers";

describe("inferErrorField", () => {
  it("maps 'slug already exists' to slug", () => {
    expect(inferErrorField("Slug already exists")).toBe("slug");
    expect(inferErrorField("slug is required")).toBe("slug");
  });

  it("maps 'title is required' to title", () => {
    expect(inferErrorField("title is required")).toBe("title");
    expect(inferErrorField("Title cannot be empty")).toBe("title");
  });

  it("maps content errors to content", () => {
    expect(inferErrorField("content is required")).toBe("content");
  });

  it("prefers slug when both slug and title appear (slug is the more specific failure)", () => {
    expect(inferErrorField("Slug for title 'foo' already exists")).toBe("slug");
  });

  it("returns null when the message names no field", () => {
    expect(inferErrorField("Internal server error")).toBeNull();
    expect(inferErrorField("")).toBeNull();
  });
});
