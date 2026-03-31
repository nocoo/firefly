#!/usr/bin/env bun
/**
 * 09-rewrite-asset-domain.ts — Replace assets.lizheng.me → b.no.mt in D1.
 *
 * Columns updated:
 *   posts.featured_image
 *   posts.content
 *   posts.content_html
 *   posts.excerpt
 *   posts.reference_image
 *   comments.content
 *   users.avatar_url
 *
 * After the URL rewrite, triggers FTS re-sync for every affected post.
 *
 * Usage: bun scripts/migrations/09-rewrite-asset-domain.ts [--dry-run]
 */

import { createDb, type Db } from "../../src/lib/db";

// biome-ignore lint: allow require for dotenv
require("dotenv").config();

const OLD_DOMAIN = "assets.lizheng.me";
const NEW_DOMAIN = "b.no.mt";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function countMatches(
  db: Db,
  table: string,
  column: string,
): Promise<number> {
  const result = await db.query<{ cnt: number }>(
    `SELECT COUNT(*) AS cnt FROM ${table} WHERE ${column} LIKE ?`,
    [`%${OLD_DOMAIN}%`],
  );
  return result.results[0]?.cnt ?? 0;
}

async function rewriteColumn(
  db: Db,
  table: string,
  column: string,
): Promise<number> {
  const count = await countMatches(db, table, column);
  if (count === 0) {
    console.log(`  ${table}.${column}: 0 rows — skipped`);
    return 0;
  }

  if (dryRun) {
    console.log(`  ${table}.${column}: ${count} rows — would update (dry-run)`);
    return count;
  }

  const meta = await db.execute(
    `UPDATE ${table} SET ${column} = REPLACE(${column}, ?, ?) WHERE ${column} LIKE ?`,
    [OLD_DOMAIN, NEW_DOMAIN, `%${OLD_DOMAIN}%`],
  );
  console.log(
    `  ${table}.${column}: ${meta.changes} rows updated (${meta.duration}ms)`,
  );
  return meta.changes;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const workerUrl = process.env.WORKER_URL;
  const workerSecret = process.env.WORKER_SECRET;
  if (!workerUrl || !workerSecret) {
    console.error("WORKER_URL and WORKER_SECRET are required");
    process.exit(1);
  }

  const db = createDb(workerUrl, workerSecret);

  console.log(
    `\nRewriting "${OLD_DOMAIN}" → "${NEW_DOMAIN}" in D1${dryRun ? " (DRY RUN)" : ""}\n`,
  );

  // --- Posts ----------------------------------------------------------------
  let postsAffected = 0;
  for (const col of [
    "featured_image",
    "content",
    "content_html",
    "excerpt",
    "reference_image",
  ]) {
    postsAffected += await rewriteColumn(db, "posts", col);
  }

  // --- Comments -------------------------------------------------------------
  await rewriteColumn(db, "comments", "content");

  // --- Users ----------------------------------------------------------------
  await rewriteColumn(db, "users", "avatar_url");

  // --- FTS re-sync ----------------------------------------------------------
  if (postsAffected > 0 && !dryRun) {
    console.log("\nRe-syncing FTS index for affected posts...");
    const { results: affectedPosts } = await db.query<{
      id: string;
      title: string;
      content: string;
      excerpt: string | null;
    }>(
      `SELECT id, title, content, excerpt FROM posts WHERE content LIKE ? OR featured_image LIKE ? OR excerpt LIKE ?`,
      [`%${NEW_DOMAIN}%`, `%${NEW_DOMAIN}%`, `%${NEW_DOMAIN}%`],
    );

    let synced = 0;
    for (const post of affectedPosts) {
      try {
        await db.call("/api/v1/fts-sync", {
          action: "upsert",
          postId: post.id,
          title: post.title,
          content: post.content,
          excerpt: post.excerpt ?? "",
        });
        synced++;
      } catch (err) {
        console.error(`  FTS sync failed for post ${post.id}:`, err);
      }
    }
    console.log(`  FTS synced: ${synced}/${affectedPosts.length} posts`);
  }

  console.log("\nDone.");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
