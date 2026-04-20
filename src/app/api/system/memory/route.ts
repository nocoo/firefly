// ---------------------------------------------------------------------------
// GET /api/system/memory — Return memory usage stats
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getMemoryStats } from "@/instrumentation";

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
  });
}
