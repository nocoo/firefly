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

  const stats = getMemoryStats();

  return NextResponse.json({
    current: stats.current,
    history: stats.history,
    summary: {
      peakHeapMB: stats.peakHeapMB,
      avgHeapMB: stats.avgHeapMB,
      sampleCount: stats.history.length,
      collectionStarted: stats.collectionStarted,
      uptimeSeconds: process.uptime(),
    },
  });
}
