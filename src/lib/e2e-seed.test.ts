import { describe, it, expect, vi } from "vitest";
import {
  seedPostIdempotent,
  type SeedDeps,
  type SeedPostBody,
} from "./e2e-seed";

const BASE = "http://localhost:27028";
const BODY: SeedPostBody = {
  title: "E2E Seed",
  slug: "e2e-seed-slug",
  content: "# hi",
  status: "published",
  published_at: 1_700_000_000,
};

// ---------------------------------------------------------------------------
// Helpers for building fetch responses
// ---------------------------------------------------------------------------

function res(status: number, bodyText = ""): Response {
  return new Response(bodyText, { status });
}

function makeDeps(fetchImpl: SeedDeps["fetch"]): SeedDeps {
  return { fetch: fetchImpl, sleep: () => Promise.resolve() };
}

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------

describe("seedPostIdempotent", () => {
  it("returns without retry when POST 201 succeeds", async () => {
    const fetchMock = vi.fn().mockResolvedValue(res(201));
    await seedPostIdempotent(BASE, BODY, makeDeps(fetchMock));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const call = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(call[0]).toBe(`${BASE}/api/posts`);
    expect(call[1].method).toBe("POST");
  });

  // -------------------------------------------------------------------------
  // Reconcile path 1: POST throws → GET hit
  // -------------------------------------------------------------------------

  it("throws → reconcile hit → success (no second POST)", async () => {
    const calls: string[] = [];
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      calls.push(`${init?.method ?? "GET"} ${String(url)}`);
      if (init?.method === "POST") throw new TypeError("fetch failed");
      // GET reconcile → hit
      return res(200, '{"slug":"e2e-seed-slug"}');
    });

    await seedPostIdempotent(BASE, BODY, makeDeps(fetchMock));

    expect(calls).toEqual([
      `POST ${BASE}/api/posts`,
      `GET ${BASE}/api/posts/e2e-seed-slug`,
    ]);
  });

  // -------------------------------------------------------------------------
  // Reconcile path 2: POST 5xx → GET miss → retry POST → 201
  // -------------------------------------------------------------------------

  it("5xx → reconcile miss → backoff → retry POST → success", async () => {
    let postCount = 0;
    let getCount = 0;
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      if (init?.method === "POST") {
        postCount++;
        return postCount === 1
          ? res(500, '{"error":"Network error: fetch failed"}')
          : res(201);
      }
      getCount++;
      return res(404); // slug not yet committed
    });

    await seedPostIdempotent(BASE, BODY, makeDeps(fetchMock));

    expect(postCount).toBe(2);
    expect(getCount).toBe(1);
  });

  // -------------------------------------------------------------------------
  // 4xx must fail fast — no reconcile, no retry
  // -------------------------------------------------------------------------

  it("4xx fails fast without reconcile or retry", async () => {
    const fetchMock = vi.fn().mockResolvedValue(res(400, '{"error":"slug is required"}'));

    await expect(
      seedPostIdempotent(BASE, BODY, makeDeps(fetchMock)),
    ).rejects.toThrow("Failed to seed post: 400");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does NOT mask a 4xx by finding an unrelated pre-existing slug", async () => {
    // If a prior test left the slug behind, a 4xx on this call must still
    // fail — reconcile-on-4xx would let a real client bug pass silently.
    const fetchMock = vi.fn().mockResolvedValue(res(400, '{"error":"bad"}'));

    await expect(
      seedPostIdempotent(BASE, BODY, makeDeps(fetchMock)),
    ).rejects.toThrow("Failed to seed post: 400");
    // Only the POST — no GET issued.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  // -------------------------------------------------------------------------
  // Exhaustion path
  // -------------------------------------------------------------------------

  it("throws after 6 exhausted attempts on continuous 5xx + miss", async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      if (init?.method === "POST") return res(500, '{"error":"down"}');
      return res(404);
    });

    await expect(
      seedPostIdempotent(BASE, BODY, makeDeps(fetchMock)),
    ).rejects.toThrow(/Failed to seed post after 6 attempts/);
    // 6 POSTs + 6 GETs (one reconcile after each POST failure).
    expect(fetchMock).toHaveBeenCalledTimes(12);
  });

  it("throws after 6 exhausted attempts on continuous throws + GET throw", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("fetch failed"));

    await expect(
      seedPostIdempotent(BASE, BODY, makeDeps(fetchMock)),
    ).rejects.toThrow(/Failed to seed post after 6 attempts/);
    expect(fetchMock).toHaveBeenCalledTimes(12);
  });
});
