import { describe, it, expect } from "vitest";
import { isSafeCallbackPath, resolveCallbackUrl } from "./safe-callback";

describe("isSafeCallbackPath", () => {
  it("accepts a normal relative path", () => {
    expect(isSafeCallbackPath("/admin")).toBe(true);
    expect(isSafeCallbackPath("/admin/posts")).toBe(true);
    expect(isSafeCallbackPath("/admin/posts?foo=bar")).toBe(true);
  });

  it("rejects protocol-relative URLs (// bypass)", () => {
    expect(isSafeCallbackPath("//evil.com")).toBe(false);
    expect(isSafeCallbackPath("//evil.com/admin")).toBe(false);
  });

  it("rejects backslash bypass (some browsers normalize \\ → /)", () => {
    expect(isSafeCallbackPath("/\\evil.com")).toBe(false);
  });

  it("rejects absolute external URLs", () => {
    expect(isSafeCallbackPath("https://evil.com/admin")).toBe(false);
    expect(isSafeCallbackPath("http://evil.com")).toBe(false);
  });

  it("rejects non-slash-prefixed values", () => {
    expect(isSafeCallbackPath("admin")).toBe(false);
    expect(isSafeCallbackPath("javascript:alert(1)")).toBe(false);
    expect(isSafeCallbackPath("")).toBe(false);
  });

  it("rejects non-string values", () => {
    expect(isSafeCallbackPath(undefined)).toBe(false);
    expect(isSafeCallbackPath(null)).toBe(false);
    expect(isSafeCallbackPath(123)).toBe(false);
    expect(isSafeCallbackPath(["/admin"])).toBe(false);
  });
});

describe("resolveCallbackUrl", () => {
  it("returns the raw value for safe paths", () => {
    expect(resolveCallbackUrl("/admin/posts")).toBe("/admin/posts");
  });

  it("falls back to /admin when value is missing", () => {
    expect(resolveCallbackUrl(undefined)).toBe("/admin");
    expect(resolveCallbackUrl(null)).toBe("/admin");
  });

  it("falls back to /admin for protocol-relative bypass", () => {
    expect(resolveCallbackUrl("//evil.com")).toBe("/admin");
  });

  it("falls back to /admin for backslash bypass", () => {
    expect(resolveCallbackUrl("/\\evil.com")).toBe("/admin");
  });

  it("falls back to /admin for absolute external URLs", () => {
    expect(resolveCallbackUrl("https://evil.com")).toBe("/admin");
  });

  it("honors custom fallback", () => {
    expect(resolveCallbackUrl("//evil.com", "/login")).toBe("/login");
  });
});
