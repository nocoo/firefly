// ---------------------------------------------------------------------------
// GET /api/system/memory — Return memory usage stats
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getMemoryStats } from "@/instrumentation";

// Empty cache stats placeholder (custom cache handler disabled for now)
const EMPTY_CACHE_STATS = {
  totalEntries: 0,
  totalSizeBytes: 0,
  entriesByKind: {},
  sizeByKind: {},
  entries: [],
  oldestEntry: null,
  newestEntry: null,
};

export async function GET(): Promise<Response> {
  // Auth check — only authenticated users can view system stats
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const memoryStats = getMemoryStats();

  return NextResponse.json({
    memory: {
      current: memoryStats.current,
      history: memoryStats.history,
      summary: {
        peakHeapMB: memoryStats.peakHeapMB,
        avgHeapMB: memoryStats.avgHeapMB,
        sampleCount: memoryStats.history.length,
        collectionStarted: memoryStats.collectionStarted,
        uptimeSeconds: process.uptime(),
      },
    },
    // Cache monitoring disabled — custom cache handler causes build issues
    // TODO: Re-enable after fixing cache handler implementation
    cache: EMPTY_CACHE_STATS,
  });
}
