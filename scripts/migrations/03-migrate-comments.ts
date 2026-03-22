#!/usr/bin/env bun
/**
 * 03-migrate-comments.ts — Migrate WordPress comments to Firefly D1.
 *
 * Reads: scripts/migrations/data/wp-comments.json
 * Requires: Posts must already be migrated (02-migrate-posts.ts)
 *
 * Handles threaded comments by remapping wp_comment_parent → new parent ID.
 * Only approved comments (comment_approved = '1') are migrated.
 *
 * Usage: bun scripts/migrations/03-migrate-comments.ts [--test]
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { createDb } from "../../src/lib/db";

// biome-ignore lint: allow require for dotenv
require("dotenv").config();

const DATA_DIR = resolve(dirname(new URL(import.meta.url).pathname), "data");

const WORKER_URL = process.env.WORKER_URL!;
const WORKER_SECRET = process.env.WORKER_SECRET!;

if (!WORKER_URL || !WORKER_SECRET) {
  console.error("Missing WORKER_URL or WORKER_SECRET");
  process.exit(1);
}

const db = createDb(WORKER_URL, WORKER_SECRET);

// ---------------------------------------------------------------------------
// Load data
// ---------------------------------------------------------------------------

interface WpComment {
  comment_ID: string;
  comment_post_ID: string;
  comment_author: string;
  comment_author_email: string | null;
  comment_author_url: string | null;
  comment_date: string;
  comment_content: string;
  comment_approved: string;
  comment_parent: string;
}

const wpComments = JSON.parse(
  readFileSync(resolve(DATA_DIR, "wp-comments.json"), "utf-8"),
) as WpComment[];

console.log(`Loaded ${wpComments.length} WordPress comments`);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateUlid(): string {
  const ts = Date.now().toString(36).padStart(10, "0");
  const rand = Math.random().toString(36).slice(2, 12).padStart(10, "0");
  return (ts + rand).toUpperCase();
}

function wpDateToUnix(dateStr: string | null): number {
  if (!dateStr || dateStr === "0000-00-00 00:00:00") {
    return Math.floor(Date.now() / 1000);
  }
  return Math.floor(new Date(dateStr + "Z").getTime() / 1000);
}

// ---------------------------------------------------------------------------
// Build post ID map (wp_post_id → firefly_post_id)
// ---------------------------------------------------------------------------

async function buildPostIdMap(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const result = await db.query<{ id: string; wp_id: number }>(
    "SELECT id, wp_id FROM posts WHERE wp_id IS NOT NULL",
  );
  for (const row of result.results) {
    map.set(String(row.wp_id), row.id);
  }
  return map;
}

// ---------------------------------------------------------------------------
// Migrate comments
// ---------------------------------------------------------------------------

async function migrateComments() {
  const postIdMap = await buildPostIdMap();
  console.log(`Found ${postIdMap.size} posts with wp_id for mapping`);

  // Filter: only approved comments
  const approved = wpComments.filter((c) => c.comment_approved === "1");
  console.log(`Approved comments: ${approved.length}`);

  // Sort by date to ensure parents are processed before children
  approved.sort(
    (a, b) =>
      new Date(a.comment_date).getTime() - new Date(b.comment_date).getTime(),
  );

  // Track wp_comment_id → new_id for parent remapping
  const commentIdMap = new Map<string, string>();

  let migrated = 0;
  let skipped = 0;

  for (const comment of approved) {
    // Map to new post ID
    const postId = postIdMap.get(comment.comment_post_ID);
    if (!postId) {
      skipped++;
      continue;
    }

    const id = generateUlid();
    commentIdMap.set(comment.comment_ID, id);

    // Remap parent comment
    let parentId: string | null = null;
    if (comment.comment_parent && comment.comment_parent !== "0") {
      parentId = commentIdMap.get(comment.comment_parent) ?? null;
    }

    const createdAt = wpDateToUnix(comment.comment_date);

    await db.execute(
      `INSERT INTO comments (id, post_id, parent_id, author_name, author_email, author_url, content, wp_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT DO NOTHING`,
      [
        id,
        postId,
        parentId,
        comment.comment_author,
        comment.comment_author_email || null,
        comment.comment_author_url || null,
        comment.comment_content,
        parseInt(comment.comment_ID, 10),
        createdAt,
      ],
    );

    migrated++;
    if (migrated % 100 === 0) {
      console.log(`  Migrated ${migrated}/${approved.length}...`);
    }
  }

  // Update comment counts on posts
  console.log("\nUpdating post comment counts...");
  await db.execute(
    `UPDATE posts SET comment_count = (
       SELECT COUNT(*) FROM comments WHERE comments.post_id = posts.id
     )`,
  );

  // Enable comments on posts that have them
  await db.execute(
    `UPDATE posts SET comment_enabled = 1
     WHERE id IN (SELECT DISTINCT post_id FROM comments)`,
  );

  console.log(`\n✓ Comments migration complete!`);
  console.log(`  Migrated: ${migrated}`);
  console.log(`  Skipped (no matching post): ${skipped}`);
  console.log(`  Parent remaps: ${[...commentIdMap.values()].length}`);
}

await migrateComments();
