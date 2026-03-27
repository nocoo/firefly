import { describe, it, expect, vi } from "vitest";

// Mock all heavy dependencies that proxy.ts imports
vi.mock("next/server", () => ({
  NextRequest: vi.fn(),
  NextResponse: { next: vi.fn(), redirect: vi.fn(), json: vi.fn() },
}));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({ createDb: vi.fn() }));
vi.mock("@/lib/tracking", () => ({ trackPageView: vi.fn() }));
vi.mock("@/lib/cache", () => ({
  createCache: () => ({ get: vi.fn(), set: vi.fn() }),
}));

import { _testHelpers } from "./proxy";

const { isProtectedApiRoute } = _testHelpers;

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
