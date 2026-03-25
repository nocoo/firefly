import { jsonResponse } from "@/lib/api";
import { APP_VERSION } from "@/lib/version";

/**
 * GET /api/live — public health-check endpoint (no auth required).
 *
 * Returns the application version and a timestamp. Useful for uptime
 * monitoring and deployment verification.
 */
export function GET() {
  return jsonResponse({
    status: "ok",
    version: APP_VERSION,
    timestamp: new Date().toISOString(),
  });
}
