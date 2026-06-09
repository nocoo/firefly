import { describe, it, expect } from "vitest";
import { slugify } from "@/models/post";
import { validateSlug, formatSlugError } from "./slug-validation";

const empty = new Set<string>();

describe("validateSlug", () => {
  it("accepts canonical lowercase-with-hyphens", () => {
    expect(validateSlug("hello", empty)).toBeNull();
    expect(validateSlug("hello-world", empty)).toBeNull();
    expect(validateSlug("post-2026-03-27", empty)).toBeNull();
    expect(validateSlug("a", empty)).toBeNull();
  });

  it("accepts CJK slugs (matches slugify())", () => {
    expect(validateSlug("我的博客文章", empty)).toBeNull();
    expect(validateSlug("hello-世界", empty)).toBeNull();
    expect(validateSlug("post-2026", empty)).toBeNull();
    expect(validateSlug("分类-1", empty)).toBeNull();
  });

  it("agrees with slugify() — every slugify output passes validation", () => {
    const samples = [
      "Hello World",
      "我的博客文章",
      "Hello 世界 Post",
      "Post 2026-03-27",
      "  multiple   spaces  ",
    ];
    for (const sample of samples) {
      const slug = slugify(sample);
      if (!slug) continue;
      expect(validateSlug(slug, empty), `slugify(${sample}) = ${slug}`).toBeNull();
    }
  });

  it("rejects empty / whitespace-only", () => {
    expect(validateSlug("", empty)?.kind).toBe("empty");
    expect(validateSlug("   ", empty)?.kind).toBe("empty");
  });

  it("rejects uppercase, underscores, spaces, leading/trailing/double hyphen", () => {
    expect(validateSlug("Hello", empty)?.kind).toBe("format");
    expect(validateSlug("hello_world", empty)?.kind).toBe("format");
    expect(validateSlug("hello world", empty)?.kind).toBe("format");
    expect(validateSlug("-hello", empty)?.kind).toBe("format");
    expect(validateSlug("hello-", empty)?.kind).toBe("format");
    expect(validateSlug("hello--world", empty)?.kind).toBe("format");
    // Punctuation that's not a hyphen is rejected
    expect(validateSlug("hello.world", empty)?.kind).toBe("format");
    expect(validateSlug("hello!world", empty)?.kind).toBe("format");
  });

  it("rejects > 80 chars", () => {
    const long = "a".repeat(81);
    const err = validateSlug(long, empty);
    expect(err?.kind).toBe("too-long");
    if (err?.kind === "too-long") expect(err.max).toBe(80);
  });

  it("rejects duplicate against existing set", () => {
    const existing = new Set(["foo", "bar"]);
    expect(validateSlug("foo", existing)?.kind).toBe("duplicate");
    expect(validateSlug("baz", existing)).toBeNull();
  });

  it("trims surrounding whitespace before checking", () => {
    expect(validateSlug("  hello  ", empty)).toBeNull();
  });
});

describe("formatSlugError", () => {
  it("returns a non-empty Chinese message for every error kind", () => {
    expect(formatSlugError({ kind: "empty" })).toContain("空");
    expect(formatSlugError({ kind: "format" })).toContain("别名");
    expect(formatSlugError({ kind: "too-long", max: 80 })).toContain("80");
    expect(formatSlugError({ kind: "duplicate" })).toContain("已存在");
  });
});
