/**
 * In-route auth check for /api/posts/[slug] — defense in depth.
 *
 * Mirrors the media route test: pins that the route handler itself fails
 * closed when the session is missing, independent of the proxy authGuard.
 * Only PUT and DELETE require auth — GET remains public (published posts).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({ getDb: vi.fn(() => ({})) }));
vi.mock("@/data/entities/post", () => ({ getPostBySlug: vi.fn() }));
vi.mock("@/services/post-service", () => ({
  PostService: { update: vi.fn(), delete: vi.fn() },
}));

import { auth } from "@/lib/auth";
import { getPostBySlug } from "@/data/entities/post";
import { PostService } from "@/services/post-service";
import { GET, PUT, DELETE } from "./route";

const fakeParams = { params: Promise.resolve({ slug: "hello-world" }) };

function fakeRequestWithBody(body: unknown) {
  return {
    json: vi.fn().mockResolvedValue(body),
  } as never;
}

describe("PUT /api/posts/[slug] — in-route auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when there is no session (does not read body or DB)", async () => {
    vi.mocked(auth).mockResolvedValue(null);

    const request = fakeRequestWithBody({ title: "hacked" });
    const response = await PUT(request, fakeParams);

    expect(response.status).toBe(401);
    expect(getPostBySlug).not.toHaveBeenCalled();
    expect(PostService.update).not.toHaveBeenCalled();
  });

  it("returns 401 when session has no user", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(auth).mockResolvedValue({} as any);

    const response = await PUT(fakeRequestWithBody({}), fakeParams);

    expect(response.status).toBe(401);
    expect(PostService.update).not.toHaveBeenCalled();
  });

  it("reaches data layer when authenticated", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(auth).mockResolvedValue({ user: { email: "admin@example.com" } } as any);
    vi.mocked(getPostBySlug).mockResolvedValue(null);

    const response = await PUT(fakeRequestWithBody({ title: "ok" }), fakeParams);

    expect(getPostBySlug).toHaveBeenCalled();
    expect(response.status).toBe(404);
  });
});

describe("DELETE /api/posts/[slug] — in-route auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when there is no session (does not call PostService.delete)", async () => {
    vi.mocked(auth).mockResolvedValue(null);

    const response = await DELETE({} as never, fakeParams);

    expect(response.status).toBe(401);
    expect(getPostBySlug).not.toHaveBeenCalled();
    expect(PostService.delete).not.toHaveBeenCalled();
  });

  it("reaches data layer when authenticated", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(auth).mockResolvedValue({ user: { email: "admin@example.com" } } as any);
    vi.mocked(getPostBySlug).mockResolvedValue(null);

    const response = await DELETE({} as never, fakeParams);

    expect(getPostBySlug).toHaveBeenCalled();
    expect(response.status).toBe(404);
  });
});

describe("GET /api/posts/[slug] — remains public (no auth)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does NOT call auth() — GET is public for published posts", async () => {
    vi.mocked(getPostBySlug).mockResolvedValue(null);

    const response = await GET({} as never, fakeParams);

    expect(auth).not.toHaveBeenCalled();
    expect(getPostBySlug).toHaveBeenCalled();
    // 404 because mock returns null — what matters is auth was not invoked.
    expect(response.status).toBe(404);
  });
});
