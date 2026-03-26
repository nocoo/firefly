import { randomBytes } from "node:crypto";
import { getDb } from "@/lib/db";
import { jsonResponse, errorResponse } from "@/lib/api";
import { APP_VERSION } from "@/lib/version";
import { getBackyEnvironment, buildBackyTag } from "@/models/backup";
import type { BackyHistoryResponse } from "@/models/backup";
import { verifyBackyPullKey, getBackyConfig } from "@/data/backup";
import { serializeBackup } from "@/data/backup-export";

/**
 * HEAD /api/backup/pull
 *
 * Test connection endpoint. Verifies the X-Webhook-Key is valid.
 * Returns 200 with no body on success, 401 if invalid.
 */
export async function HEAD(request: Request) {
  const key = request.headers.get("x-webhook-key");

  if (!key) {
    return new Response(null, { status: 401 });
  }

  const db = getDb();
  const valid = await verifyBackyPullKey(db, key);
  if (!valid) {
    return new Response(null, { status: 401 });
  }

  return new Response(null, { status: 200 });
}

/**
 * POST /api/backup/pull
 *
 * Webhook endpoint called by Backy cron to trigger a backup push.
 * Authentication via X-Webhook-Key header (NOT OAuth — this is M2M).
 */
export async function POST(request: Request) {
  const key = request.headers.get("x-webhook-key");

  if (!key) {
    return jsonResponse({ error: "Missing X-Webhook-Key header" }, 401);
  }

  try {
    const db = getDb();
    const valid = await verifyBackyPullKey(db, key);
    if (!valid) {
      return jsonResponse({ error: "Invalid webhook credentials" }, 401);
    }

    // Get push config (remote webhook URL + API key)
    const config = await getBackyConfig(db);
    if (!config) {
      return errorResponse("Backy push config not configured", 422);
    }

    const start = Date.now();

    // Collect, serialize, and compress
    const { buffer, envelope } = await serializeBackup(db);

    // Build tag and filename
    const rand = randomBytes(3).toString("base64url").slice(0, 4);
    const datetime = new Date()
      .toISOString()
      .slice(0, 19)
      .replaceAll(":", "-");
    const tag = buildBackyTag(
      APP_VERSION,
      {
        posts: envelope.posts.length,
        categories: envelope.categories.length,
        tags: envelope.tags.length,
      },
      rand,
      datetime,
    );
    const fileName = `firefly-backup-${datetime}-${rand}.json.gz`;

    // Push to Backy
    const form = new FormData();
    const blob = new Blob([new Uint8Array(buffer)], {
      type: "application/gzip",
    });
    form.append("file", blob, fileName);
    form.append("environment", getBackyEnvironment());
    form.append("tag", tag);

    // Push to Backy (30s timeout to prevent hanging on network issues)
    const res = await fetch(config.webhookUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.apiKey}` },
      body: form,
      signal: AbortSignal.timeout(30_000),
    });

    const durationMs = Date.now() - start;

    if (!res.ok) {
      let body: unknown;
      const text = await res.text().catch(() => "");
      try {
        body = JSON.parse(text);
      } catch {
        body = text || null;
      }
      return jsonResponse(
        {
          error: "Backup push failed",
          durationMs,
          status: res.status,
          body,
        },
        502,
      );
    }

    // Consume response body
    await res.json().catch(() => null);

    // Fetch history inline (non-critical, 5s timeout)
    let history: BackyHistoryResponse | undefined;
    try {
      const historyRes = await fetch(config.webhookUrl, {
        method: "GET",
        headers: { Authorization: `Bearer ${config.apiKey}` },
        signal: AbortSignal.timeout(5_000),
      });
      if (historyRes.ok) {
        history = (await historyRes.json()) as BackyHistoryResponse;
      }
    } catch {
      // Non-critical
    }

    return jsonResponse({
      ok: true,
      message: `Backup pushed successfully (${durationMs}ms)`,
      durationMs,
      tag,
      fileName,
      stats: {
        posts: envelope.posts.length,
        categories: envelope.categories.length,
        tags: envelope.tags.length,
        postTags: envelope.postTags.length,
        comments: envelope.comments.length,
        attachments: envelope.attachments.length,
        redirects: envelope.redirects.length,
      },
      history,
    });
  } catch (error) {
    console.error("Backup pull error:", error);
    return errorResponse("Internal server error", 500);
  }
}
