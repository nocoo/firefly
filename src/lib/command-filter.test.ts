import { describe, it, expect } from "vitest";
import { filterCommandsByQuery } from "./command-filter";

const commands = [
  { label: "Dashboard", keywords: ["dashboard", "概览"] },
  { label: "文章", keywords: ["posts", "articles"] },
  { label: "Media Library", keywords: ["media", "图片"] },
];

describe("filterCommandsByQuery", () => {
  it("returns a copy of the input on empty / whitespace query", () => {
    expect(filterCommandsByQuery(commands, "")).toEqual(commands);
    expect(filterCommandsByQuery(commands, "   ")).toEqual(commands);
    // copy, not the same reference
    expect(filterCommandsByQuery(commands, "")).not.toBe(commands);
  });

  it("matches case-insensitively against the label", () => {
    expect(filterCommandsByQuery(commands, "DASH")).toHaveLength(1);
    expect(filterCommandsByQuery(commands, "media")[0].label).toBe(
      "Media Library",
    );
  });

  it("matches against any keyword", () => {
    expect(filterCommandsByQuery(commands, "posts")[0].label).toBe("文章");
    expect(filterCommandsByQuery(commands, "图片")[0].label).toBe(
      "Media Library",
    );
  });

  it("returns nothing when no command matches", () => {
    expect(filterCommandsByQuery(commands, "xyz-no-match")).toEqual([]);
  });

  it("preserves the input order on partial matches", () => {
    // both "Media Library" (label match) and "文章" (keyword "articles")
    // would NOT match "ar" the same way — only 文章 matches via keyword;
    // verify result preserves source ordering when several hit.
    const fuzzy = filterCommandsByQuery(commands, "a");
    expect(fuzzy.map((c) => c.label)).toEqual([
      "Dashboard",
      "文章",
      "Media Library",
    ]);
  });
});
