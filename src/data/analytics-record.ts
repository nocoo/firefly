// ---------------------------------------------------------------------------
// Analytics — page view ingest
// ---------------------------------------------------------------------------

import type { Db } from "@/lib/db";
import { newId } from "@/data/core/timestamps";

export interface RecordPageViewInput {
  path: string;
  postId?: string | null | undefined;
  referrer?: string | null | undefined;
  userAgent?: string | null | undefined;
  ipHash?: string | null | undefined;
  country?: string | null | undefined;
  city?: string | null | undefined;
  deviceType?: string | null | undefined;
  browser?: string | null | undefined;
  os?: string | null | undefined;
  isBot?: boolean | undefined;
  botName?: string | null | undefined;
  botCategory?: string | null | undefined;
  sessionId?: string | null | undefined;
}

export async function recordPageView(
  db: Db,
  input: RecordPageViewInput,
): Promise<void> {
  const id = newId();
  await db.execute(
    `INSERT INTO page_views (id, post_id, path, referrer, user_agent, ip_hash, country, city, device_type, browser, os, is_bot, bot_name, bot_category, session_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.postId ?? null,
      input.path,
      input.referrer ?? null,
      input.userAgent ?? null,
      input.ipHash ?? null,
      input.country ?? null,
      input.city ?? null,
      input.deviceType ?? null,
      input.browser ?? null,
      input.os ?? null,
      input.isBot ? 1 : 0,
      input.botName ?? null,
      input.botCategory ?? null,
      input.sessionId ?? null,
    ],
  );

  // Increment posts.view_count for human visitors (cache-type field, eventual consistency)
  // UPDATE failure does not affect the page_view INSERT above.
  if (input.postId && !input.isBot) {
    await db
      .execute("UPDATE posts SET view_count = view_count + 1 WHERE id = ?", [
        input.postId,
      ])
      .catch(() => {
        // Silently ignore — view_count is a denormalized cache field
      });
  }
}
