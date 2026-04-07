// ---------------------------------------------------------------------------
// Next.js Instrumentation — Memory monitoring
// https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
// ---------------------------------------------------------------------------

/**
 * Memory snapshot for tracking usage over time.
 */
export interface MemorySnapshot {
  timestamp: number;
  heapUsedMB: number;
  heapTotalMB: number;
  rssMB: number;
  externalMB: number;
  arrayBuffersMB: number;
}

/**
 * In-memory circular buffer for memory snapshots.
 * Keeps last N samples to avoid unbounded growth.
 */
const MAX_SAMPLES = 2880; // 48 hours at 1 sample/min
const memoryHistory: MemorySnapshot[] = [];

let collectionInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Collect a memory snapshot using Node.js process.memoryUsage().
 */
function collectMemorySnapshot(): MemorySnapshot {
  const usage = process.memoryUsage();
  return {
    timestamp: Date.now(),
    heapUsedMB: Math.round(usage.heapUsed / 1024 / 1024 * 100) / 100,
    heapTotalMB: Math.round(usage.heapTotal / 1024 / 1024 * 100) / 100,
    rssMB: Math.round(usage.rss / 1024 / 1024 * 100) / 100,
    externalMB: Math.round(usage.external / 1024 / 1024 * 100) / 100,
    arrayBuffersMB: Math.round((usage.arrayBuffers ?? 0) / 1024 / 1024 * 100) / 100,
  };
}

/**
 * Start collecting memory snapshots at regular intervals.
 */
function startMemoryCollection(intervalMs: number = 60_000): void {
  if (collectionInterval) return; // Already running

  // Collect initial snapshot
  memoryHistory.push(collectMemorySnapshot());

  collectionInterval = setInterval(() => {
    const snapshot = collectMemorySnapshot();
    memoryHistory.push(snapshot);

    // Trim to MAX_SAMPLES (circular buffer)
    if (memoryHistory.length > MAX_SAMPLES) {
      memoryHistory.shift();
    }

    // Log warning if heap usage exceeds threshold
    if (snapshot.heapUsedMB > 500) {
      console.warn(
        `[memory] High heap usage: ${snapshot.heapUsedMB}MB / ${snapshot.heapTotalMB}MB`,
      );
    }
  }, intervalMs);
}

/**
 * Get current memory snapshot (real-time).
 */
export function getCurrentMemory(): MemorySnapshot {
  return collectMemorySnapshot();
}

/**
 * Get memory history (circular buffer).
 */
export function getMemoryHistory(): MemorySnapshot[] {
  return [...memoryHistory];
}

/**
 * Get memory stats summary.
 */
export function getMemoryStats(): {
  current: MemorySnapshot;
  history: MemorySnapshot[];
  peakHeapMB: number;
  avgHeapMB: number;
  collectionStarted: number | null;
} {
  const current = collectMemorySnapshot();
  const history = getMemoryHistory();

  const peakHeapMB = history.length > 0
    ? Math.max(...history.map((s) => s.heapUsedMB))
    : current.heapUsedMB;

  const avgHeapMB = history.length > 0
    ? Math.round(history.reduce((sum, s) => sum + s.heapUsedMB, 0) / history.length * 100) / 100
    : current.heapUsedMB;

  return {
    current,
    history,
    peakHeapMB,
    avgHeapMB,
    collectionStarted: history.length > 0 ? history[0].timestamp : null,
  };
}

// ---------------------------------------------------------------------------
// Next.js register function — called once on server startup
// ---------------------------------------------------------------------------

export async function register(): Promise<void> {
  // Only run on Node.js runtime (not Edge)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    console.log("[instrumentation] Starting memory collection...");
    startMemoryCollection(60_000); // Collect every 60 seconds
  }
}
