import { APP_VERSION } from "@/lib/version";

export const dynamic = "force-dynamic";

/**
 * GET /api/live — public liveness check (no auth required).
 */
export function GET() {
  return Response.json(
    { status: "ok", version: APP_VERSION, component: "firefly" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
