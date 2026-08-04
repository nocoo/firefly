import { describe, it, expect, vi, afterEach } from "vitest";
import {
  seedPostIdempotent,
  SEED_TOTAL_DEADLINE_MS,
  defaultSeedDeps,
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

function res(status: number, bodyText = ""): Response {
  return new Response(bodyText, { status });
}

/** Wrap defaultSeedDeps.setTimer/sleep (both use setTimeout under the hood
 *  so vi.useFakeTimers() controls them) with an injected fetch. */
function depsWithFetch(fetchImpl: SeedDeps["fetch"]): SeedDeps {
  return {
    fetch: fetchImpl,
    sleep: defaultSeedDeps.sleep,
    setTimer: defaultSeedDeps.setTimer,
  };
}

/** Advance vitest's fake timers by `ms` while giving microtasks a chance to
 *  drain between ticks. Returns after `ms` virtual time has passed. */
async function advanceFake(ms: number): Promise<void> {
  // Small step size so per-attempt work (POST resolve → decide → GET →
  // decide → schedule sleep) has room to schedule its next sleeper before
  // we jump the clock again.
  const step = 25;
  for (let elapsed = 0; elapsed < ms; elapsed += step) {
    await vi.advanceTimersByTimeAsync(step);
  }
}

afterEach(() => {
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------

describe("seedPostIdempotent", () => {
  it("returns without retry when POST 201 succeeds", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue(res(201));
    const p = seedPostIdempotent(BASE, BODY, depsWithFetch(fetchMock));
    await advanceFake(SEED_TOTAL_DEADLINE_MS);
    await p;
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE}/api/posts`);
    expect(init.method).toBe("POST");
  });

  // -------------------------------------------------------------------------
  // Reconcile path 1: POST throws → GET hit
  // -------------------------------------------------------------------------

  it("throws → reconcile hit → success (no second POST)", async () => {
    vi.useFakeTimers();
    const calls: string[] = [];
    const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      calls.push(`${init.method ?? "GET"} ${url}`);
      if (init.method === "POST") throw new TypeError("fetch failed");
      return res(200, '{"slug":"e2e-seed-slug"}');
    });

    const p = seedPostIdempotent(BASE, BODY, depsWithFetch(fetchMock));
    await advanceFake(SEED_TOTAL_DEADLINE_MS);
    await p;

    expect(calls).toEqual([
      `POST ${BASE}/api/posts`,
      `GET ${BASE}/api/posts/e2e-seed-slug`,
    ]);
  });

  // -------------------------------------------------------------------------
  // Reconcile path 2: POST 5xx → GET miss → retry POST → 201
  // -------------------------------------------------------------------------

  it("5xx → reconcile miss → backoff → retry POST → success", async () => {
    vi.useFakeTimers();
    let postCount = 0;
    let getCount = 0;
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      if (init.method === "POST") {
        postCount++;
        return postCount === 1
          ? res(500, '{"error":"Network error: fetch failed"}')
          : res(201);
      }
      getCount++;
      return res(404);
    });

    const p = seedPostIdempotent(BASE, BODY, depsWithFetch(fetchMock));
    await advanceFake(SEED_TOTAL_DEADLINE_MS);
    await p;

    expect(postCount).toBe(2);
    expect(getCount).toBe(1);
  });

  // -------------------------------------------------------------------------
  // 4xx must fail fast — no reconcile, no retry
  // -------------------------------------------------------------------------

  it("4xx fails fast without reconcile or retry", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValue(res(400, '{"error":"slug is required"}'));

    const p = seedPostIdempotent(BASE, BODY, depsWithFetch(fetchMock));
    const settled = p.catch((e) => e);
    await advanceFake(SEED_TOTAL_DEADLINE_MS);
    await expect(settled).resolves.toMatchObject({
      message: expect.stringContaining("Failed to seed post: 400"),
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does NOT mask a 4xx by finding an unrelated pre-existing slug", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue(res(400, '{"error":"bad"}'));

    const p = seedPostIdempotent(BASE, BODY, depsWithFetch(fetchMock));
    const settled = p.catch((e) => e);
    await advanceFake(SEED_TOTAL_DEADLINE_MS);
    await expect(settled).resolves.toMatchObject({
      message: expect.stringContaining("Failed to seed post: 400"),
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  // -------------------------------------------------------------------------
  // Exhaustion path — attempts run out inside the deadline
  // -------------------------------------------------------------------------

  it("throws after 6 exhausted attempts on continuous 5xx + miss", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      if (init.method === "POST") return res(500, '{"error":"down"}');
      return res(404);
    });

    const p = seedPostIdempotent(BASE, BODY, depsWithFetch(fetchMock));
    const settled = p.catch((e) => e);
    // Total backoff sum = 10.75s (< deadline 20s), so exhaustion wins.
    await advanceFake(15_000);
    const err = (await settled) as Error;
    expect(err.message).toMatch(/Failed to seed post after 6 attempts/);
    expect(fetchMock).toHaveBeenCalledTimes(12);
  });

  it("throws after 6 exhausted attempts on continuous throws + GET throw", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("fetch failed"));

    const p = seedPostIdempotent(BASE, BODY, depsWithFetch(fetchMock));
    const settled = p.catch((e) => e);
    await advanceFake(15_000);
    const err = (await settled) as Error;
    expect(err.message).toMatch(/Failed to seed post after 6 attempts/);
    expect(fetchMock).toHaveBeenCalledTimes(12);
  });

  // -------------------------------------------------------------------------
  // Deadline aborts an in-flight request (P1 in review of 6b2a710)
  // -------------------------------------------------------------------------

  it("aborts a pending POST at the deadline and throws its own diagnostic", async () => {
    vi.useFakeTimers();
    const started: string[] = [];
    const fetchMock = vi.fn(
      (url: string, init: RequestInit & { signal: AbortSignal }) => {
        started.push(`${init.method ?? "GET"} ${url}`);
        // Never resolve; the caller must abort us at the deadline.
        return new Promise<Response>((_, reject) => {
          init.signal.addEventListener(
            "abort",
            () => reject(init.signal.reason ?? new Error("aborted")),
            { once: true },
          );
        });
      },
    );

    const p = seedPostIdempotent(BASE, BODY, depsWithFetch(fetchMock));
    const settled = p.catch((e) => e);
    await advanceFake(SEED_TOTAL_DEADLINE_MS + 5_000);
    const err = (await settled) as Error;

    expect(started).toEqual([`POST ${BASE}/api/posts`]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(err.message).toMatch(
      new RegExp(
        `Failed to seed post before deadline \\(${SEED_TOTAL_DEADLINE_MS}ms\\)`,
      ),
    );
  });

  it("aborts a pending reconcile GET at the deadline", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(
      (_url: string, init: RequestInit & { signal: AbortSignal }) => {
        if (init.method === "POST") {
          return Promise.resolve(res(500, '{"error":"down"}'));
        }
        return new Promise<Response>((_, reject) => {
          init.signal.addEventListener(
            "abort",
            () => reject(init.signal.reason ?? new Error("aborted")),
            { once: true },
          );
        });
      },
    );

    const p = seedPostIdempotent(BASE, BODY, depsWithFetch(fetchMock));
    const settled = p.catch((e) => e);
    await advanceFake(SEED_TOTAL_DEADLINE_MS + 5_000);
    const err = (await settled) as Error;

    expect(err.message).toMatch(
      new RegExp(
        `Failed to seed post before deadline \\(${SEED_TOTAL_DEADLINE_MS}ms\\)`,
      ),
    );
    // 1 POST resolved + 1 GET pending until abort → 2 calls, no further.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not fire any further attempt after the deadline (last-attempt boundary)", async () => {
    vi.useFakeTimers();
    // POST hangs each time so the loop never gets past attempt 1 before
    // deadline. If the deadline handler is buggy the loop could still fire
    // additional POSTs — the assert catches that.
    let started = 0;
    const fetchMock = vi.fn(
      (_url: string, init: RequestInit & { signal: AbortSignal }) => {
        started++;
        return new Promise<Response>((_, reject) => {
          init.signal.addEventListener(
            "abort",
            () => reject(init.signal.reason ?? new Error("aborted")),
            { once: true },
          );
        });
      },
    );

    const p = seedPostIdempotent(BASE, BODY, depsWithFetch(fetchMock));
    const settled = p.catch((e) => e);
    await advanceFake(SEED_TOTAL_DEADLINE_MS + 60_000);
    await settled;
    expect(started).toBe(1);
  });

  it("uses default deps (real timers) when no deps argument given", async () => {
    // Real timers path — no vi.useFakeTimers().
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue(res(201)) as unknown as typeof fetch;
    try {
      await seedPostIdempotent(BASE, BODY);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
