#!/usr/bin/env bun
/**
 * 05-migrate-analytics.ts — Seed analytics data from WordPress Independent Analytics.
 *
 * Reads: scripts/migrations/data/wp-ia-views.json
 *        scripts/migrations/data/wp-ia-sessions.json
 *        scripts/migrations/data/wp-ia-referrers.json
 *
 * IA schema (actual):
 *   views:    { id, resource_id, viewed_at, page, session_id, ... }
 *   sessions: { session_id, visitor_id, referrer_id, created_at, total_views, ... }
 *   referrers: { id, domain, referrer, referrer_type_id }
 *
 * Seeds site_daily_stats with historical view/visitor counts per day.
 * Best-effort — IA resource_id does not map 1:1 to WP post_id.
 *
 * Usage: bun scripts/migrations/05-migrate-analytics.ts
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

// ---------------------------------------------------------------------------
// IA data types (actual schema)
// ---------------------------------------------------------------------------

interface IaView {
  id: string;
  resource_id: string;
  viewed_at: string; // "YYYY-MM-DD HH:MM:SS"
  page: string;
  session_id: string;
  next_view_id: string | null;
  next_viewed_at: string | null;
}

interface IaSession {
  session_id: string;
  visitor_id: string;
  referrer_id: string | null;
  created_at: string;
  total_views: string;
  is_first_session: string;
}

interface IaReferrer {
  id: string;
  domain: string;
  referrer: string;
  referrer_type_id: string;
}

// ---------------------------------------------------------------------------
// Seed site_daily_stats from IA views + sessions
// ---------------------------------------------------------------------------

async function seedSiteDailyStats() {
  const views = loadJsonSafe<IaView>("wp-ia-views.json");
  const sessions = loadJsonSafe<IaSession>("wp-ia-sessions.json");
  const referrers = loadJsonSafe<IaReferrer>("wp-ia-referrers.json");

  if (views.length === 0) {
    console.log("  No IA views data found, skipping site_daily_stats");
    return;
  }

  console.log(`Loaded: ${views.length} views, ${sessions.length} sessions, ${referrers.length} referrers`);

  // Build referrer lookup
  const referrerMap = new Map<string, string>();
  for (const ref of referrers) {
    referrerMap.set(ref.id, ref.referrer || ref.domain);
  }

  // Aggregate views by date
  const dailyViews = new Map<string, number>();
  for (const v of views) {
    const date = v.viewed_at.slice(0, 10); // "YYYY-MM-DD"
    dailyViews.set(date, (dailyViews.get(date) ?? 0) + 1);
  }

  // Aggregate unique visitors by date (via sessions → unique visitor_id per day)
  const dailyVisitors = new Map<string, Set<string>>();
  for (const s of sessions) {
    const date = s.created_at.slice(0, 10);
    if (!dailyVisitors.has(date)) dailyVisitors.set(date, new Set());
    dailyVisitors.get(date)!.add(s.visitor_id);
  }

  // Aggregate top referrers by date
  const dailyReferrers = new Map<string, Map<string, number>>();
  for (const s of sessions) {
    if (!s.referrer_id) continue;
    const date = s.created_at.slice(0, 10);
    const refName = referrerMap.get(s.referrer_id) ?? "Unknown";
    if (!dailyReferrers.has(date)) dailyReferrers.set(date, new Map());
    const refs = dailyReferrers.get(date)!;
    refs.set(refName, (refs.get(refName) ?? 0) + 1);
  }

  // Get all unique dates
  const allDates = new Set([...dailyViews.keys(), ...dailyVisitors.keys()]);
  console.log(`Aggregated into ${allDates.size} daily records`);

  let count = 0;
  for (const date of allDates) {
    const totalViews = dailyViews.get(date) ?? 0;
    const uniqueVisitors = dailyVisitors.get(date)?.size ?? 0;

    // Top referrers as JSON
    const refs = dailyReferrers.get(date);
    let topReferrersJson: string | null = null;
    if (refs && refs.size > 0) {
      const sorted = [...refs.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
      topReferrersJson = JSON.stringify(
        sorted.map(([name, count]) => ({ name, count })),
      );
    }

    await db
      .execute(
        `INSERT INTO site_daily_stats (date, total_views, unique_visitors, top_referrers)
         VALUES (?, ?, ?, ?)
         ON CONFLICT (date) DO UPDATE SET
           total_views = excluded.total_views,
           unique_visitors = excluded.unique_visitors,
           top_referrers = excluded.top_referrers`,
        [date, totalViews, uniqueVisitors, topReferrersJson],
      )
      .catch((err: unknown) => {
        console.warn(`  ⚠ Failed to insert ${date}: ${err}`);
      });

    count++;
    if (count % 50 === 0) {
      console.log(`  Inserted ${count}/${allDates.size}...`);
    }
  }

  console.log(`  ✓ Seeded ${count} site_daily_stats records`);
  console.log(`    Date range: ${[...allDates].sort()[0]} → ${[...allDates].sort().pop()}`);
  console.log(`    Total views: ${[...dailyViews.values()].reduce((a, b) => a + b, 0)}`);
  console.log(`    Total sessions: ${sessions.length}`);
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

console.log("Seeding analytics data from WordPress IA\n");

await seedSiteDailyStats();

console.log("\n✓ Analytics seed migration complete!");
