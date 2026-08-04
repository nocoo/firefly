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
    // Advance to exactly the deadline. Helper must have settled — with no
    // slack for a straggling sleep or extra attempt.
    await advanceFake(SEED_TOTAL_DEADLINE_MS);
    const err = (await settled) as Error;

    expect(started).toEqual([`POST ${BASE}/api/posts`]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(err.message).toMatch(
      new RegExp(
        `Failed to seed post before deadline \\(${SEED_TOTAL_DEADLINE_MS}ms\\)`,
      ),
    );
  });

  it("aborts a pending reconcile GET at the deadline (settles at deadline, no straggling sleep)", async () => {
    vi.useFakeTimers();
    // First POST fails 5xx so the loop enters slugExists. GET hangs and
    // must be aborted by the deadline. Prior to the fix the loop would
    // swallow the abort in slugExists and then wait a full 250 ms sleep
    // before throwing, so the diagnostic surfaced ~250 ms past deadline.
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

    // Step 1: advance to exactly the deadline. Helper must be settled
    // right here — not one millisecond later.
    await advanceFake(SEED_TOTAL_DEADLINE_MS);

    // Race: advance no further time; require settlement now.
    const marker = { pending: true };
    const check = Promise.race([
      settled.then(() => ({ pending: false })),
      Promise.resolve().then(() => Promise.resolve()).then(() => marker),
    ]);
    const outcome = await check;
    expect(outcome).not.toBe(marker); // proved settled at deadline

    const err = (await settled) as Error;
    expect(err.message).toMatch(
      new RegExp(
        `Failed to seed post before deadline \\(${SEED_TOTAL_DEADLINE_MS}ms\\)`,
      ),
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("aborts a pending GET on attempt 5 during the long 6s backoff window", async () => {
    vi.useFakeTimers();
    // Attempts 1..4 all fail with 5xx + reconcile miss; each consumes
    // 250+500+1000+3000 = 4750 ms of virtual time from sleeps. Attempt 5's
    // POST returns 5xx synchronously, then its GET hangs. Deadline (20s)
    // fires while the 5th GET is pending. If slugExists / sleep swallowed
    // the abort, the helper would then attempt a 6 s backoff before
    // throwing at 26 s — this test locks the settlement to the deadline.
    let attempt = 0;
    let getStarted = 0;
    const fetchMock = vi.fn(
      (_url: string, init: RequestInit & { signal: AbortSignal }) => {
        if (init.method === "POST") {
          attempt++;
          return Promise.resolve(res(500, '{"error":"down"}'));
        }
        getStarted++;
        if (getStarted < 5) return Promise.resolve(res(404));
        // 5th GET hangs.
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
    await advanceFake(SEED_TOTAL_DEADLINE_MS);

    // No extra advance. If the helper still needs 6 s more, this fails.
    const marker = { pending: true };
    const outcome = await Promise.race([
      settled.then(() => ({ pending: false })),
      Promise.resolve().then(() => Promise.resolve()).then(() => marker),
    ]);
    expect(outcome).not.toBe(marker);

    const err = (await settled) as Error;
    expect(err.message).toMatch(
      new RegExp(
        `Failed to seed post before deadline \\(${SEED_TOTAL_DEADLINE_MS}ms\\)`,
      ),
    );
    expect(attempt).toBe(5); // reached but did not exceed attempt 5
  });

  it("does not fire the 6th attempt once the deadline has aborted (last-attempt boundary)", async () => {
    vi.useFakeTimers();
    // POST 5xx + GET 404 for attempts 1..4 (fast). Attempt 5 POST is slow
    // (blocks for 10 s virtual) and gets aborted by the 20 s deadline
    // during attempt 5, since sleeps 250+500+1000+3000 = 4.75 s + 10 s = 14.75 s > 20 s
    // is not — recompute: sleeps only run between attempts; before
    // attempt 5 the cumulative sleep is 250+500+1000+3000 = 4.75 s and POST 5
    // starts at t=4.75s and hangs for 10 s → aborted at t=14.75+? Actually
    // we make POST 5 hang forever so the abort clearly fires during it.
    let postCount = 0;
    let getCount = 0;
    const fetchMock = vi.fn(
      (_url: string, init: RequestInit & { signal: AbortSignal }) => {
        if (init.method === "POST") {
          postCount++;
          if (postCount < 5) return Promise.resolve(res(500));
          // 5th POST hangs → aborted at deadline.
          return new Promise<Response>((_, reject) => {
            init.signal.addEventListener(
              "abort",
              () => reject(init.signal.reason ?? new Error("aborted")),
              { once: true },
            );
          });
        }
        getCount++;
        return Promise.resolve(res(404));
      },
    );

    const p = seedPostIdempotent(BASE, BODY, depsWithFetch(fetchMock));
    const settled = p.catch((e) => e);
    await advanceFake(SEED_TOTAL_DEADLINE_MS + 60_000);
    const err = (await settled) as Error;
    expect(err).toBeInstanceOf(Error);
    // The 5th POST is where abort fires. The 6th POST must NOT run.
    expect(postCount).toBe(5);
    // 4 GETs (one per completed 5xx POST) — no 5th because attempt 5's
    // POST never returned normally.
    expect(getCount).toBe(4);
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
