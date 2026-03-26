import { randomBytes } from "node:crypto";
import { getDb, DbError } from "@/lib/db";
import { jsonResponse, errorResponse } from "@/lib/api";
import { APP_VERSION } from "@/lib/version";
import { getBackyEnvironment, buildBackyTag } from "@/models/backup";
import type { BackyHistoryResponse, BackyPushDetail } from "@/models/backup";
import { getBackyConfig } from "@/data/backup";
import { serializeBackup } from "@/data/backup-export";

function handleError(error: unknown) {
  if (error instanceof DbError) {
    return errorResponse(error.message, error.status ?? 500);
  }
  console.error("Backup push API error:", error);
  return errorResponse("Internal server error", 500);
}

// POST /api/backup/push — execute backup push to Backy
export async function POST() {
  try {
    const db = getDb();
    const config = await getBackyConfig(db);

    if (!config) {
      return errorResponse("Backup not configured", 422);
    }

    const start = Date.now();

    // Collect, serialize, and compress all backup data
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

    // Build multipart/form-data
    const form = new FormData();
    const blob = new Blob([new Uint8Array(buffer)], { type: "application/gzip" });
    form.append("file", blob, fileName);
    form.append("environment", getBackyEnvironment());
    form.append("tag", tag);

    const requestMeta = {
      tag,
      fileName,
      fileSizeBytes: buffer.length,
      backupStats: {
        posts: envelope.posts.length,
        categories: envelope.categories.length,
        tags: envelope.tags.length,
        postTags: envelope.postTags.length,
        comments: envelope.comments.length,
        attachments: envelope.attachments.length,
        redirects: envelope.redirects.length,
      } as Record<string, number>,
    };

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

      const detail: BackyPushDetail = {
        ok: false,
        message: `Push failed (${res.status})`,
        durationMs,
        request: requestMeta,
        response: { status: res.status, body },
      };
      return jsonResponse(detail, res.status >= 500 ? 502 : res.status);
    }

    // Success — consume the POST response, then fetch history inline
    await res.json().catch(() => null);

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
      // Non-critical — history will be undefined
    }

    const detail: BackyPushDetail = {
      ok: true,
      message: `Push succeeded (${durationMs}ms)`,
      durationMs,
      request: requestMeta,
      history,
    };
    return jsonResponse(detail);
  } catch (error) {
    return handleError(error);
  }
}
