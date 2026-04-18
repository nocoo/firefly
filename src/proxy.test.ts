import { describe, it, expect, vi, beforeEach } from "vitest";

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

const { isProtectedApiRoute, markdownRejected } = _testHelpers;

// ---------------------------------------------------------------------------
// Helper to build a NextRequest-like object for proxy() tests
// ---------------------------------------------------------------------------

function makeRequest(
  pathname: string,
  acceptHeader?: string,
  method: string = "GET",
) {
  const headers = new Map<string, string>();
  if (acceptHeader !== undefined) headers.set("accept", acceptHeader);

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

  it("protects all methods for /api/analytics", () => {
    expect(isProtectedApiRoute("/api/analytics", "GET")).toBe(true);
    expect(isProtectedApiRoute("/api/analytics/dashboard", "GET")).toBe(true);
  });

  it("does not protect /api/auth routes", () => {
    expect(isProtectedApiRoute("/api/auth/callback", "POST")).toBe(false);
  });

  it("does not protect /api/mcp routes", () => {
    expect(isProtectedApiRoute("/api/mcp", "POST")).toBe(false);
    expect(isProtectedApiRoute("/api/mcp/tools", "GET")).toBe(false);
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
