import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// The module keeps process-wide singleton state (history buffer, interval
// handle). Reset modules between tests so each scenario sees a clean start.
async function freshModule() {
  vi.resetModules();
  return await import("./instrumentation");
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("getCurrentMemory", () => {
  it("returns a snapshot with all numeric MB fields", async () => {
    const { getCurrentMemory } = await freshModule();
    const snap = getCurrentMemory();
    expect(typeof snap.timestamp).toBe("number");
    expect(snap.timestamp).toBeGreaterThan(0);
    for (const k of [
      "heapUsedMB",
      "heapTotalMB",
      "rssMB",
      "externalMB",
      "arrayBuffersMB",
    ] as const) {
      expect(typeof snap[k]).toBe("number");
      expect(Number.isFinite(snap[k])).toBe(true);
      expect(snap[k]).toBeGreaterThanOrEqual(0);
    }
  });

  it("falls back to 0 when arrayBuffers is undefined", async () => {
    const { getCurrentMemory } = await freshModule();
    vi.spyOn(process, "memoryUsage").mockImplementation((() => ({
      heapUsed: 0,
      heapTotal: 0,
      rss: 0,
      external: 0,
      arrayBuffers: undefined as unknown as number,
    })) as typeof process.memoryUsage);
    expect(getCurrentMemory().arrayBuffersMB).toBe(0);
  });
});

describe("getMemoryStats", () => {
  it("uses current snapshot for peak/avg when history is empty (pre-collection)", async () => {
    const { getMemoryHistory, getMemoryStats } = await freshModule();
    // Stable memory readings so peak/avg comparisons are deterministic.
    vi.spyOn(process, "memoryUsage").mockImplementation((() => ({
      heapUsed: 100 * 1024 * 1024,
      heapTotal: 200 * 1024 * 1024,
      rss: 300 * 1024 * 1024,
      external: 0,
      arrayBuffers: 0,
    })) as typeof process.memoryUsage);
    expect(getMemoryHistory()).toEqual([]);
    const stats = getMemoryStats();
    expect(stats.current.heapUsedMB).toBe(stats.peakHeapMB);
    expect(stats.current.heapUsedMB).toBe(stats.avgHeapMB);
    expect(stats.history.length).toBeGreaterThanOrEqual(1);
  });

  it("returns a copied history array (mutating result does not affect future reads)", async () => {
    const { getMemoryHistory, getMemoryStats } = await freshModule();
    getMemoryStats();
    const a = getMemoryHistory();
    a.push({
      timestamp: 0,
      heapUsedMB: 0,
      heapTotalMB: 0,
      rssMB: 0,
      externalMB: 0,
      arrayBuffersMB: 0,
    });
    const b = getMemoryHistory();
    expect(b.length).toBe(a.length - 1);
  });

  it("collectionStarted timestamp matches the first sample after start", async () => {
    const { getMemoryStats } = await freshModule();
    const stats = getMemoryStats();
    expect(stats.collectionStarted).toBe(stats.history[0]!.timestamp);
  });

  it("setInterval keeps appending samples and trims to MAX_SAMPLES", async () => {
    const { getMemoryStats, getMemoryHistory } = await freshModule();
    getMemoryStats(); // arms the interval
    // Advance enough for several ticks
    vi.advanceTimersByTime(60_000 * 5);
    expect(getMemoryHistory().length).toBeGreaterThan(1);
  });

  it("trims memoryHistory to MAX_SAMPLES (2880) when buffer overflows", async () => {
    const { getMemoryStats, getMemoryHistory } = await freshModule();
    getMemoryStats(); // arms the interval (1 initial sample collected)
    // Advance enough ticks to exceed MAX_SAMPLES=2880 and trigger the trim branch.
    vi.advanceTimersByTime(60_000 * 2900);
    const history = getMemoryHistory();
    expect(history.length).toBeLessThanOrEqual(2880);
    expect(history.length).toBeGreaterThan(2000);
  });

  it("warns when heap usage exceeds threshold (and respects throttle)", async () => {
    const { getMemoryStats } = await freshModule();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    // Force every snapshot to report 600MB heap usage
    vi.spyOn(process, "memoryUsage").mockImplementation((() => ({
      heapUsed: 600 * 1024 * 1024,
      heapTotal: 800 * 1024 * 1024,
      rss: 900 * 1024 * 1024,
      external: 0,
      arrayBuffers: 0,
    })) as typeof process.memoryUsage);
    getMemoryStats(); // start interval
    vi.advanceTimersByTime(60_000); // first tick → should warn
    expect(warn).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(60_000); // within 5min throttle window → no new warn
    expect(warn).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(5 * 60_000 + 1); // past throttle window → warn again
    expect(warn.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("does not warn when heap usage is below threshold", async () => {
    const { getMemoryStats } = await freshModule();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(process, "memoryUsage").mockImplementation((() => ({
      heapUsed: 1 * 1024 * 1024,
      heapTotal: 2 * 1024 * 1024,
      rss: 3 * 1024 * 1024,
      external: 0,
      arrayBuffers: 0,
    })) as typeof process.memoryUsage);
    getMemoryStats();
    vi.advanceTimersByTime(60_000 * 3);
    expect(warn).not.toHaveBeenCalled();
  });
});

describe("register", () => {
  it("uses 10s collection interval in development mode", async () => {
    vi.stubEnv("NODE_ENV", "development");
    try {
      const { getMemoryStats, getMemoryHistory } = await freshModule();
      getMemoryStats(); // arms the interval (1 initial sample)
      // In development, the interval fires every 10s instead of 60s.
      vi.advanceTimersByTime(10_000 * 3);
      // 1 initial + 3 ticks = 4 samples
      expect(getMemoryHistory().length).toBeGreaterThanOrEqual(3);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("starts collection when NEXT_RUNTIME=nodejs", async () => {
    const original = process.env.NEXT_RUNTIME;
    process.env.NEXT_RUNTIME = "nodejs";
    try {
      const { register, getMemoryHistory } = await freshModule();
      vi.spyOn(console, "log").mockImplementation(() => {});
      await register();
      expect(getMemoryHistory().length).toBeGreaterThan(0);
    } finally {
      if (original === undefined) delete process.env.NEXT_RUNTIME;
      else process.env.NEXT_RUNTIME = original;
    }
  });

  it("is idempotent when register is called twice (already-running guard)", async () => {
    const original = process.env.NEXT_RUNTIME;
    process.env.NEXT_RUNTIME = "nodejs";
    try {
      const { register, getMemoryHistory } = await freshModule();
      vi.spyOn(console, "log").mockImplementation(() => {});
      await register();
      const after1 = getMemoryHistory().length;
      // Second register() must hit the "already running" early return,
      // so no extra initial sample is appended.
      await register();
      const after2 = getMemoryHistory().length;
      expect(after2).toBe(after1);
    } finally {
      if (original === undefined) delete process.env.NEXT_RUNTIME;
      else process.env.NEXT_RUNTIME = original;
    }
  });

  it("is a no-op outside Node.js runtime (e.g. Edge)", async () => {
    const original = process.env.NEXT_RUNTIME;
    process.env.NEXT_RUNTIME = "edge";
    try {
      const { register, getMemoryHistory } = await freshModule();
      await register();
      expect(getMemoryHistory()).toEqual([]);
    } finally {
      if (original === undefined) delete process.env.NEXT_RUNTIME;
      else process.env.NEXT_RUNTIME = original;
    }
  });
});
