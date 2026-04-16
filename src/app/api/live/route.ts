import { APP_VERSION } from "@/lib/version";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/live — public liveness check (no auth required).
 *
 * Conforms to the surety /api/live standard.
 */
export async function GET() {
  const timestamp = new Date().toISOString();
  const uptime = Math.floor(process.uptime());

  let database: { connected: boolean; error?: string };
  try {
    const db = getDb();
    await db.query("SELECT 1 AS probe");
    database = { connected: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    database = { connected: false, error: msg.replace(/\bok\b/gi, "***") };
  }

  const healthy = database.connected;

  return Response.json(
    {
      status: healthy ? "ok" : "error",
      version: APP_VERSION,
      component: "firefly",
      timestamp,
      uptime,
      database,
    },
    {
      status: healthy ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
