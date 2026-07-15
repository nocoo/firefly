import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock all heavy dependencies that proxy.ts imports
vi.mock("next/server", () => ({
  NextRequest: vi.fn(),
  NextResponse: {
    next: vi.fn(() => ({ type: "next" })),
    redirect: vi.fn((url, status) => ({ type: "redirect", url, status })),
    json: vi.fn((body, init) => ({ type: "json", body, init })),
    rewrite: vi.fn((url) => {
      const headers = new Map<string, string>();
      return {
        type: "rewrite",
        url,
        headers: {
          set: (k: string, v: string) => headers.set(k.toLowerCase(), v),
          get: (k: string) => headers.get(k.toLowerCase()) ?? null,
        },
      };
    }),
  },
}));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({ createDb: vi.fn() }));
vi.mock("@/lib/tracking", () => ({ trackPageView: vi.fn(() => Promise.resolve()) }));
vi.mock("@/lib/cache", () => ({
  createCache: () => ({ get: vi.fn(), set: vi.fn() }),
}));

import { NextResponse } from "next/server";
import { _testHelpers, proxy } from "./proxy";
import { _testHelpers as rlTestHelpers } from "./lib/rate-limit";
import { auth } from "@/lib/auth";

const {
  isProtectedApiRoute,
  markdownRejected,
  getRateLimitConfig,
  extractClientIp,
  skipStaticAssets,
} = _testHelpers;

// ---------------------------------------------------------------------------
// Helper to build a NextRequest-like object for proxy() tests
// ---------------------------------------------------------------------------

function makeRequest(
  pathname: string,
  acceptHeader?: string,
  method = "GET",
  extraHeaders?: Record<string, string>,
) {
  const headers = new Map<string, string>();
  if (acceptHeader !== undefined) headers.set("accept", acceptHeader);
  if (extraHeaders) {
    for (const [k, v] of Object.entries(extraHeaders)) {
      headers.set(k.toLowerCase(), v);
    }
  }

  const url = {
    pathname,
    clone() {
      const cloned = { ...this, pathname: this.pathname };
      cloned.clone = url.clone;
      return cloned;
    },
  };

  return {
    method,
    headers: { get: (k: string) => headers.get(k.toLowerCase()) ?? null },
    nextUrl: url,
  } as never;
}

// ---------------------------------------------------------------------------
// isProtectedApiRoute — backup routes
// ---------------------------------------------------------------------------

describe("isProtectedApiRoute — backup routes", () => {
  // Management endpoints: all methods are protected
  it("protects GET /api/backup", () => {
    expect(isProtectedApiRoute("/api/backup", "GET")).toBe(true);
  });

  it("protects GET /api/backup/history", () => {
    expect(isProtectedApiRoute("/api/backup/history", "GET")).toBe(true);
  });

  it("protects GET /api/backup/pull-key", () => {
    expect(isProtectedApiRoute("/api/backup/pull-key", "GET")).toBe(true);
  });

  it("protects PUT /api/backup", () => {
    expect(isProtectedApiRoute("/api/backup", "PUT")).toBe(true);
  });

  it("protects DELETE /api/backup", () => {
    expect(isProtectedApiRoute("/api/backup", "DELETE")).toBe(true);
  });

  it("protects POST /api/backup/test", () => {
    expect(isProtectedApiRoute("/api/backup/test", "POST")).toBe(true);
  });

  it("protects POST /api/backup/push", () => {
    expect(isProtectedApiRoute("/api/backup/push", "POST")).toBe(true);
  });

  it("protects DELETE /api/backup/pull-key", () => {
    expect(isProtectedApiRoute("/api/backup/pull-key", "DELETE")).toBe(true);
  });

  it("protects POST /api/backup/pull-key", () => {
    expect(isProtectedApiRoute("/api/backup/pull-key", "POST")).toBe(true);
  });

  // Pull webhook: exact path exemption
  it("exempts HEAD /api/backup/pull (M2M)", () => {
    expect(isProtectedApiRoute("/api/backup/pull", "HEAD")).toBe(false);
  });

  it("exempts POST /api/backup/pull (M2M)", () => {
    expect(isProtectedApiRoute("/api/backup/pull", "POST")).toBe(false);
  });

  it("exempts GET /api/backup/pull (M2M)", () => {
    expect(isProtectedApiRoute("/api/backup/pull", "GET")).toBe(false);
  });

  // Critical: /api/backup/pull-key must NOT be exempted by the pull exemption
  it("does NOT exempt /api/backup/pull-key (not pull)", () => {
    expect(isProtectedApiRoute("/api/backup/pull-key", "GET")).toBe(true);
  });

  it("does NOT exempt /api/backup/pull-key POST", () => {
    expect(isProtectedApiRoute("/api/backup/pull-key", "POST")).toBe(true);
  });

  it("does NOT exempt /api/backup/pull/ (with trailing slash)", () => {
    expect(isProtectedApiRoute("/api/backup/pull/", "POST")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// isProtectedApiRoute — media routes
// ---------------------------------------------------------------------------

describe("isProtectedApiRoute — media routes", () => {
  it("protects GET /api/media", () => {
    expect(isProtectedApiRoute("/api/media", "GET")).toBe(true);
  });

  it("protects POST /api/media", () => {
    expect(isProtectedApiRoute("/api/media", "POST")).toBe(true);
  });

  it("protects GET /api/media/some-id", () => {
    expect(isProtectedApiRoute("/api/media/some-id", "GET")).toBe(true);
  });

  it("protects DELETE /api/media/some-id", () => {
    expect(isProtectedApiRoute("/api/media/some-id", "DELETE")).toBe(true);
  });

  it("protects PATCH /api/media/associate", () => {
    expect(isProtectedApiRoute("/api/media/associate", "PATCH")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// isProtectedApiRoute — existing behavior (regression tests)
// ---------------------------------------------------------------------------

describe("isProtectedApiRoute — existing behavior", () => {
  it("protects POST /api/posts", () => {
    expect(isProtectedApiRoute("/api/posts", "POST")).toBe(true);
  });

  it("does not protect GET /api/posts", () => {
    expect(isProtectedApiRoute("/api/posts", "GET")).toBe(false);
  });

  it("protects GET /api/admin/posts", () => {
    expect(isProtectedApiRoute("/api/admin/posts", "GET")).toBe(true);
  });

  it("protects GET /api/admin/search", () => {
    expect(isProtectedApiRoute("/api/admin/search", "GET")).toBe(true);
  });

  it("protects all methods for /api/analytics", () => {
    expect(isProtectedApiRoute("/api/analytics", "GET")).toBe(true);
    expect(isProtectedApiRoute("/api/analytics/dashboard", "GET")).toBe(true);
  });

  it("does not protect /api/auth routes", () => {
    expect(isProtectedApiRoute("/api/auth/callback", "POST")).toBe(false);
  });

  it("protects POST /api/mcp/register", () => {
    expect(isProtectedApiRoute("/api/mcp/register", "POST")).toBe(true);
  });

  it("does not protect /api/mcp routes (except register POST)", () => {
    expect(isProtectedApiRoute("/api/mcp", "POST")).toBe(false);
    expect(isProtectedApiRoute("/api/mcp/tools", "GET")).toBe(false);
    expect(isProtectedApiRoute("/api/mcp/register", "GET")).toBe(false);
  });

  it("does not protect non-api routes", () => {
    expect(isProtectedApiRoute("/about", "GET")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// markdownRejected — Accept header q=0 parsing
// ---------------------------------------------------------------------------

describe("markdownRejected", () => {
  it("returns false when accept does not mention markdown", () => {
    expect(markdownRejected("text/html")).toBe(false);
  });

  it("returns false for plain text/markdown", () => {
    expect(markdownRejected("text/markdown")).toBe(false);
  });

  it("returns true for text/markdown;q=0", () => {
    expect(markdownRejected("text/markdown;q=0")).toBe(true);
  });

  it("returns true for text/markdown; q=0 (with space)", () => {
    expect(markdownRejected("text/markdown; q=0")).toBe(true);
  });

  it("returns true for text/markdown;q=0.0", () => {
    expect(markdownRejected("text/markdown;q=0.0")).toBe(true);
  });

  it("returns true for text/markdown;q=0;profile=llm (extensions after q=0)", () => {
    expect(markdownRejected("text/markdown;q=0;profile=llm")).toBe(true);
  });

  it("returns true when q=0 entry appears alongside other entries", () => {
    expect(markdownRejected("text/html, text/markdown;q=0")).toBe(true);
  });

  it("returns false for text/markdown;q=0.5 (non-zero quality)", () => {
    expect(markdownRejected("text/markdown;q=0.5")).toBe(false);
  });

  it("returns false for text/markdown;q=1", () => {
    expect(markdownRejected("text/markdown;q=1")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// proxy() — HTTPS redirect
// ---------------------------------------------------------------------------

describe("proxy — HTTPS redirect", () => {
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.clearAllMocks();
    // @ts-expect-error -- test needs to override NODE_ENV
    process.env.NODE_ENV = "production";
  });

  afterEach(() => {
    // @ts-expect-error -- restore NODE_ENV
    process.env.NODE_ENV = originalEnv;
  });

  it("redirects HTTP to HTTPS in production with x-forwarded-proto: http", async () => {
    const req = makeRequest("/api/posts", undefined, "GET", {
      "x-forwarded-proto": "http",
      host: "example.com",
    });
    const res = (await proxy(req)) as unknown as {
      type: string;
      url: { protocol: string };
      status: number;
    };
    expect(res.type).toBe("redirect");
    expect(res.status).toBe(301);
  });

  it("does NOT redirect when x-forwarded-proto is https", async () => {
    const req = makeRequest("/api/posts", undefined, "GET", {
      "x-forwarded-proto": "https",
      host: "example.com",
    });
    await proxy(req);
    expect(NextResponse.redirect).not.toHaveBeenCalled();
  });

  it("does NOT redirect when host is localhost", async () => {
    const req = makeRequest("/api/posts", undefined, "GET", {
      "x-forwarded-proto": "http",
      host: "localhost:17028",
    });
    await proxy(req);
    expect(NextResponse.redirect).not.toHaveBeenCalled();
  });

  it("does NOT redirect when host is 127.0.0.1", async () => {
    const req = makeRequest("/api/posts", undefined, "GET", {
      "x-forwarded-proto": "http",
      host: "127.0.0.1:17028",
    });
    await proxy(req);
    expect(NextResponse.redirect).not.toHaveBeenCalled();
  });

  it("does NOT redirect when x-forwarded-proto is missing", async () => {
    const req = makeRequest("/api/posts", undefined, "GET", {
      host: "example.com",
    });
    await proxy(req);
    expect(NextResponse.redirect).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// proxy() — markdown content negotiation
// ---------------------------------------------------------------------------

describe("proxy — markdown negotiation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes through normal HTML request to a blog post", async () => {
    const req = makeRequest("/2025/03/hello-world", "text/html");
    await proxy(req);
    expect(NextResponse.rewrite).not.toHaveBeenCalled();
    expect(NextResponse.next).toHaveBeenCalled();
  });

  it("rewrites blog post to /api/md/... on Accept: text/markdown with Vary: Accept", async () => {
    const req = makeRequest("/2025/03/hello-world", "text/markdown");
    const response = (await proxy(req)) as unknown as {
      type: string;
      url: { pathname: string };
      headers: { get: (k: string) => string | null };
    };
    expect(NextResponse.rewrite).toHaveBeenCalled();
    expect(response.type).toBe("rewrite");
    expect(response.url.pathname).toBe("/api/md/2025/03/hello-world");
    expect(response.headers.get("Vary")).toBe("Accept");
  });

  it("does NOT rewrite when Accept: text/markdown;q=0", async () => {
    const req = makeRequest("/2025/03/hello-world", "text/markdown;q=0");
    await proxy(req);
    expect(NextResponse.rewrite).not.toHaveBeenCalled();
  });

  it("does NOT rewrite when Accept: text/markdown; q=0 (space before q)", async () => {
    const req = makeRequest("/2025/03/hello-world", "text/markdown; q=0");
    await proxy(req);
    expect(NextResponse.rewrite).not.toHaveBeenCalled();
  });

  it("does NOT rewrite when Accept: text/markdown;q=0;profile=llm", async () => {
    const req = makeRequest(
      "/2025/03/hello-world",
      "text/markdown;q=0;profile=llm",
    );
    await proxy(req);
    expect(NextResponse.rewrite).not.toHaveBeenCalled();
  });

  it("does not rewrite a non-post URL even with Accept: text/markdown", async () => {
    const req = makeRequest("/about", "text/markdown");
    await proxy(req);
    expect(NextResponse.rewrite).not.toHaveBeenCalled();
  });

  it("rewrites homepage / to /api/md on Accept: text/markdown with Vary: Accept", async () => {
    const req = makeRequest("/", "text/markdown");
    const response = (await proxy(req)) as unknown as {
      type: string;
      url: { pathname: string };
      headers: { get: (k: string) => string | null };
    };
    expect(NextResponse.rewrite).toHaveBeenCalled();
    expect(response.type).toBe("rewrite");
    expect(response.url.pathname).toBe("/api/md");
    expect(response.headers.get("Vary")).toBe("Accept");
  });
});

// ---------------------------------------------------------------------------
// extractClientIp
// ---------------------------------------------------------------------------

describe("extractClientIp", () => {
  function reqWith(headers: Record<string, string>) {
    return {
      headers: {
        get: (k: string) => headers[k.toLowerCase()] ?? null,
      },
    } as never;
  }

  it("returns the first IP from x-forwarded-for", () => {
    expect(
      extractClientIp(reqWith({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" })),
    ).toBe("1.2.3.4");
  });

  it("trims whitespace from x-forwarded-for entries", () => {
    expect(
      extractClientIp(reqWith({ "x-forwarded-for": "  9.9.9.9 , 5.5.5.5" })),
    ).toBe("9.9.9.9");
  });

  it("falls back to x-real-ip when x-forwarded-for is absent", () => {
    expect(extractClientIp(reqWith({ "x-real-ip": "10.0.0.1" }))).toBe(
      "10.0.0.1",
    );
  });

  it("returns 'unknown' when no IP headers are present", () => {
    expect(extractClientIp(reqWith({}))).toBe("unknown");
  });
});

// ---------------------------------------------------------------------------
// getRateLimitConfig
// ---------------------------------------------------------------------------

describe("getRateLimitConfig", () => {
  it("returns null for non-API routes", () => {
    expect(getRateLimitConfig("/about", "GET")).toBeNull();
  });

  it("returns null for /api/auth routes", () => {
    expect(getRateLimitConfig("/api/auth/callback", "POST")).toBeNull();
  });

  it("applies stricter limit to POST /api/mcp/register", () => {
    const cfg = getRateLimitConfig("/api/mcp/register", "POST");
    expect(cfg).toEqual({ limit: 10, windowMs: 60_000 });
  });

  it("does not throttle non-POST /api/mcp/register requests", () => {
    expect(getRateLimitConfig("/api/mcp/register", "GET")).toBeNull();
  });

  it("applies rate limit to /api/mcp/token", () => {
    const cfg = getRateLimitConfig("/api/mcp/token", "POST");
    expect(cfg).toEqual({ limit: 20, windowMs: 60_000 });
    // Any method should be rate-limited
    expect(getRateLimitConfig("/api/mcp/token", "GET")).toEqual({
      limit: 20,
      windowMs: 60_000,
    });
  });

  it("exempts other /api/mcp routes", () => {
    expect(getRateLimitConfig("/api/mcp", "POST")).toBeNull();
    expect(getRateLimitConfig("/api/mcp/tools", "GET")).toBeNull();
  });

  it("applies the public API limit to other /api/ routes", () => {
    expect(getRateLimitConfig("/api/posts", "GET")).toEqual({
      limit: 60,
      windowMs: 60_000,
    });
    expect(getRateLimitConfig("/api/search", "GET")).toEqual({
      limit: 60,
      windowMs: 60_000,
    });
  });
});

// ---------------------------------------------------------------------------
// proxy() — rate limiting integration
// ---------------------------------------------------------------------------

describe("proxy — rate limiting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rlTestHelpers.reset();
  });

  it("returns 429 with Retry-After when public /api/ limit is exceeded", async () => {
    // Public API: 60/min. Use a unique IP per test to isolate buckets.
    const ip = "10.10.10.1";
    for (let i = 0; i < 60; i++) {
      const req = makeRequest("/api/posts", undefined, "GET", {
        "x-forwarded-for": ip,
      });
      await proxy(req);
    }
    const blocked = makeRequest("/api/posts", undefined, "GET", {
      "x-forwarded-for": ip,
    });
    const res = (await proxy(blocked)) as unknown as {
      type: string;
      init: { status: number; headers: Record<string, string> };
    };
    expect(res.type).toBe("json");
    expect(res.init.status).toBe(429);
    expect(res.init.headers["Retry-After"]).toBeDefined();
    expect(Number(res.init.headers["Retry-After"])).toBeGreaterThanOrEqual(1);
  });

  it("returns 401 for unauthenticated /api/mcp/register POST (auth guard runs before rate limit)", async () => {
    const ip = "10.10.10.2";
    const req = makeRequest("/api/mcp/register", undefined, "POST", {
      "x-forwarded-for": ip,
    });
    const res = (await proxy(req)) as unknown as {
      type: string;
      init: { status: number };
    };
    expect(res.type).toBe("json");
    expect(res.init.status).toBe(401);
  });

  it("does not rate-limit /api/auth requests", async () => {
    const ip = "10.10.10.3";
    // Far above any cap.
    for (let i = 0; i < 200; i++) {
      const req = makeRequest("/api/auth/session", undefined, "GET", {
        "x-forwarded-for": ip,
      });
      const res = (await proxy(req)) as unknown as { type: string };
      expect(res.type).not.toBe("json"); // never 429
    }
  });

  it("does not rate-limit non-/register MCP requests", async () => {
    const ip = "10.10.10.4";
    for (let i = 0; i < 100; i++) {
      const req = makeRequest("/api/mcp/tools", undefined, "GET", {
        "x-forwarded-for": ip,
      });
      const res = (await proxy(req)) as unknown as { type: string };
      expect(res.type).not.toBe("json");
    }
  });

  it("isolates rate limits per IP", async () => {
    // Exhaust IP A then verify IP B is unaffected.
    for (let i = 0; i < 60; i++) {
      await proxy(
        makeRequest("/api/posts", undefined, "GET", {
          "x-forwarded-for": "10.20.0.1",
        }),
      );
    }
    const blockedA = (await proxy(
      makeRequest("/api/posts", undefined, "GET", {
        "x-forwarded-for": "10.20.0.1",
      }),
    )) as unknown as { type: string; init: { status: number } };
    expect(blockedA.init.status).toBe(429);

    const allowedB = (await proxy(
      makeRequest("/api/posts", undefined, "GET", {
        "x-forwarded-for": "10.20.0.2",
      }),
    )) as unknown as { type: string };
    expect(allowedB.type).not.toBe("json"); // not 429
  });
});

// ---------------------------------------------------------------------------
// skipStaticAssets — middleware bypass regression
//
// Background: skipStaticAssets used to call NextResponse.next() for any path
// containing a dot, which let attackers smuggle write operations onto routes
// like DELETE /api/media/<uuid>.png past authGuard. The fix excludes /api/*
// from the dot-based static-asset shortcut. These tests pin that contract.
// ---------------------------------------------------------------------------

describe("skipStaticAssets — does not short-circuit /api paths", () => {
  it("does NOT skip /api/media/<uuid>.png (was the bypass)", () => {
    const req = makeRequest("/api/media/abc-123.png", undefined, "DELETE");
    expect(skipStaticAssets(req)).toBeNull();
  });

  it("does NOT skip /api/media/<uuid>.gif", () => {
    const req = makeRequest("/api/media/abc-123.gif", undefined, "GET");
    expect(skipStaticAssets(req)).toBeNull();
  });

  it("does NOT skip /api/posts/<slug>.bak", () => {
    const req = makeRequest("/api/posts/some-slug.bak", undefined, "PUT");
    expect(skipStaticAssets(req)).toBeNull();
  });

  it("does NOT skip /api/admin/posts/<id>.json", () => {
    const req = makeRequest("/api/admin/posts/x.json", undefined, "DELETE");
    expect(skipStaticAssets(req)).toBeNull();
  });

  it("still skips /favicon.ico (real static asset)", () => {
    const req = makeRequest("/favicon.ico");
    expect(skipStaticAssets(req)).not.toBeNull();
  });

  it("still skips /_next/static/chunk.js", () => {
    const req = makeRequest("/_next/static/chunk.js");
    expect(skipStaticAssets(req)).not.toBeNull();
  });

  it("still skips arbitrary asset-like paths with a dot", () => {
    const req = makeRequest("/images/hero.png");
    expect(skipStaticAssets(req)).not.toBeNull();
  });

  it("does NOT skip /index.php/foo (WP legacy redirect lookup)", () => {
    const req = makeRequest("/index.php/foo");
    expect(skipStaticAssets(req)).toBeNull();
  });

  it("does NOT skip clean paths without a dot", () => {
    const req = makeRequest("/about");
    expect(skipStaticAssets(req)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// proxy() — middleware bypass end-to-end (the real regression)
//
// Pre-fix: DELETE /api/media/<id>.png would short-circuit at skipStaticAssets
// and never reach authGuard. authGuard now runs and returns 401 for
// unauthenticated requests.
// ---------------------------------------------------------------------------

describe("proxy — protected /api routes with dot in pathname reach authGuard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rlTestHelpers.reset();
    vi.mocked(auth).mockResolvedValue(null);
  });

  it("returns 401 for unauthenticated DELETE /api/media/<uuid>.png", async () => {
    const req = makeRequest("/api/media/abc-123.png", undefined, "DELETE");
    const res = (await proxy(req)) as unknown as {
      type: string;
      init: { status: number };
    };
    expect(res.type).toBe("json");
    expect(res.init.status).toBe(401);
  });

  it("returns 401 for unauthenticated GET /api/media/<uuid>.png", async () => {
    const req = makeRequest("/api/media/abc-123.png", undefined, "GET");
    const res = (await proxy(req)) as unknown as {
      type: string;
      init: { status: number };
    };
    expect(res.type).toBe("json");
    expect(res.init.status).toBe(401);
  });

  it("returns 401 for unauthenticated PUT /api/posts/<slug>.bak", async () => {
    const req = makeRequest("/api/posts/foo.bar", undefined, "PUT");
    const res = (await proxy(req)) as unknown as {
      type: string;
      init: { status: number };
    };
    expect(res.type).toBe("json");
    expect(res.init.status).toBe(401);
  });

  it("returns 401 for unauthenticated DELETE /api/posts/<slug>.bak", async () => {
    const req = makeRequest("/api/posts/foo.bar", undefined, "DELETE");
    const res = (await proxy(req)) as unknown as {
      type: string;
      init: { status: number };
    };
    expect(res.type).toBe("json");
    expect(res.init.status).toBe(401);
  });

  it("still allows real static assets through unchanged", async () => {
    const req = makeRequest("/favicon.ico");
    await proxy(req);
    expect(NextResponse.next).toHaveBeenCalled();
    expect(NextResponse.json).not.toHaveBeenCalled();
  });

  it("still allows /_next internals through unchanged", async () => {
    const req = makeRequest("/_next/static/chunk.js");
    await proxy(req);
    expect(NextResponse.next).toHaveBeenCalled();
    expect(NextResponse.json).not.toHaveBeenCalled();
  });
});
