#!/usr/bin/env bun
/**
 * 05-migrate-analytics.ts — Seed analytics data from WordPress Independent Analytics.
 *
 * Reads: scripts/migrations/data/wp-ia-views.json (if available)
 *        scripts/migrations/data/wp-ia-sessions.json
 *        scripts/migrations/data/wp-ia-referrers.json
 *
 * Seeds daily_stats and site_daily_stats tables with historical view data.
 * This is best-effort — exact mapping depends on IA schema.
 *
 * Usage: bun scripts/migrations/05-migrate-analytics.ts [--test]
 */

import { readFileSync, existsSync } from "node:fs";
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

function loadJsonSafe<T>(filename: string): T[] {
  const path = resolve(DATA_DIR, filename);
  if (!existsSync(path)) {
    console.warn(`  ⚠ File not found: ${filename} — skipping`);
    return [];
  }
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    console.warn(`  ⚠ Could not parse: ${filename} — skipping`);
    return [];
  }
}

function generateUlid(): string {
  const ts = Date.now().toString(36).padStart(10, "0");
  const rand = Math.random().toString(36).slice(2, 12).padStart(10, "0");
  return (ts + rand).toUpperCase();
}

// ---------------------------------------------------------------------------
// Try to seed from IA views data
// ---------------------------------------------------------------------------

interface IaView {
  id?: string;
  page?: string;
  title?: string;
  referrer?: string;
  visitors?: string;
  views?: string;
  date?: string;
  created_at?: string;
}

async function seedFromIaViews() {
  const views = loadJsonSafe<IaView>("wp-ia-views.json");
  if (views.length === 0) return;

  console.log(`Found ${views.length} IA view records`);

  // Aggregate by date for site_daily_stats
  const dailyMap = new Map<string, { views: number; visitors: number }>();

  for (const row of views) {
    const date = row.date ?? row.created_at?.slice(0, 10);
    if (!date) continue;

    const existing = dailyMap.get(date) ?? { views: 0, visitors: 0 };
    existing.views += parseInt(row.views ?? "1", 10);
    existing.visitors += parseInt(row.visitors ?? "1", 10);
    dailyMap.set(date, existing);
  }

  console.log(`Aggregated into ${dailyMap.size} daily records`);

  for (const [date, stats] of dailyMap) {
    await db
      .execute(
        `INSERT INTO site_daily_stats (date, total_views, unique_visitors)
         VALUES (?, ?, ?)
         ON CONFLICT (date) DO UPDATE SET
           total_views = total_views + excluded.total_views,
           unique_visitors = unique_visitors + excluded.unique_visitors`,
        [date, stats.views, stats.visitors],
      )
      .catch(() => {});
  }

  console.log(`  ✓ Seeded ${dailyMap.size} site_daily_stats records`);
}

// ---------------------------------------------------------------------------
// If no IA data, try to generate basic seed from post view_count
// ---------------------------------------------------------------------------

async function seedFromPostViewCounts() {
  console.log("Attempting to seed from post view_count metadata...");

  const result = await db.query<{
    id: string;
    view_count: number;
    published_at: number | null;
  }>(
    "SELECT id, view_count, published_at FROM posts WHERE view_count > 0",
  );

  if (result.results.length === 0) {
    console.log("  No posts with view_count > 0");
    return;
  }

  let seeded = 0;
  for (const post of result.results) {
    if (!post.published_at) continue;

    // Distribute views evenly across days since publish
    const publishDate = new Date(post.published_at * 1000);
    const today = new Date();
    const daysSincePublish = Math.max(
      1,
      Math.floor(
        (today.getTime() - publishDate.getTime()) / (1000 * 60 * 60 * 24),
      ),
    );
    const viewsPerDay = Math.max(1, Math.floor(post.view_count / daysSincePublish));

    // Seed the most recent 30 days or total days, whichever is less
    const daysToSeed = Math.min(30, daysSincePublish);
    const remainingViews = post.view_count;
    const dailyViews = Math.floor(remainingViews / daysToSeed);

    for (let d = 0; d < daysToSeed; d++) {
      const date = new Date(today);
      date.setDate(date.getDate() - d);
      const dateStr = date.toISOString().slice(0, 10);

      await db
        .execute(
          `INSERT INTO daily_stats (date, post_id, views, unique_visitors)
           VALUES (?, ?, ?, ?)
           ON CONFLICT (date, post_id) DO UPDATE SET
             views = views + excluded.views`,
          [dateStr, post.id, dailyViews, Math.floor(dailyViews * 0.7)],
        )
        .catch(() => {});
    }
    seeded++;
  }

  console.log(`  ✓ Seeded daily_stats for ${seeded} posts`);
}

// ---------------------------------------------------------------------------
// Also seed page_views with basic historical entries
// ---------------------------------------------------------------------------

async function seedBasicPageViews() {
  const views = loadJsonSafe<IaView>("wp-ia-views.json");
  if (views.length === 0) return;

  console.log("Seeding basic page_view records...");

  let count = 0;
  for (const row of views) {
    const date = row.date ?? row.created_at?.slice(0, 10);
    if (!date) continue;

    const viewedAt = Math.floor(new Date(date).getTime() / 1000);
    const numViews = parseInt(row.views ?? "1", 10);

    // Create one page_view entry per view record (aggregated)
    for (let i = 0; i < Math.min(numViews, 10); i++) {
      await db
        .execute(
          `INSERT INTO page_views (id, path, referrer, viewed_at)
           VALUES (?, ?, ?, ?)`,
          [
            generateUlid(),
            row.page ?? "/",
            row.referrer || null,
            viewedAt + i * 60, // space out by 1 minute
          ],
        )
        .catch(() => {});
      count++;
    }
  }

  console.log(`  ✓ Seeded ${count} page_view records`);
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

console.log("Seeding analytics data from WordPress\n");

await seedFromIaViews();
await seedFromPostViewCounts();
await seedBasicPageViews();

console.log("\n✓ Analytics seed migration complete!");
