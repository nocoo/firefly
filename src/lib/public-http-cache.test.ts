import { describe, expect, it } from "vitest";
import {
  PUBLIC_CONTENT_CACHE_CONTROL,
  cacheControlForPublicApiGet,
  hasAuthSessionCookie,
  shouldCachePublicHtmlRequest,
} from "./public-http-cache";

describe("public-http-cache", () => {
  it("detects auth session cookies", () => {
    expect(hasAuthSessionCookie(null)).toBe(false);
    expect(hasAuthSessionCookie("theme=dark")).toBe(false);
    expect(
      hasAuthSessionCookie("__Secure-authjs.session-token=abc; theme=dark"),
    ).toBe(true);
  });

  it("allows anonymous public HTML", () => {
    expect(shouldCachePublicHtmlRequest("/", "GET", null)).toBe(true);
    expect(
      shouldCachePublicHtmlRequest("/2024/01/example", "GET", null),
    ).toBe(true);
    expect(
      shouldCachePublicHtmlRequest("/category/reading", "GET", null),
    ).toBe(true);
  });

  it("skips admin, login, preview and authenticated HTML", () => {
    expect(shouldCachePublicHtmlRequest("/admin", "GET", null)).toBe(false);
    expect(shouldCachePublicHtmlRequest("/login", "GET", null)).toBe(false);
    expect(
      shouldCachePublicHtmlRequest("/", "GET", "authjs.session-token=x"),
    ).toBe(false);
  });

  it("classifies public API GET cache targets", () => {
    expect(cacheControlForPublicApiGet("/api/live", "GET")).toBeNull();
    expect(cacheControlForPublicApiGet("/api/admin/posts", "GET")).toBeNull();
    expect(cacheControlForPublicApiGet("/api/posts/hello", "GET")).toBe(
      PUBLIC_CONTENT_CACHE_CONTROL,
    );
    expect(cacheControlForPublicApiGet("/feed.xml", "GET")).toBe(
      PUBLIC_CONTENT_CACHE_CONTROL,
    );
  });
});
