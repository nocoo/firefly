#!/usr/bin/env bun
/**
 * 08-backfill-attachments.ts — Backfill and fix attachment records.
 *
 * Two problems this script fixes:
 * 1. Missing records: R2 has N objects but DB may be missing some
 * 2. Wrong created_at: Historical WP records may have migration time as created_at
 *    instead of the actual file date from YYYY/MM path
 *
 * Uses wp-posts.json (attachment posts) for accurate post_date and mime_type when available.
 * Falls back to date derived from R2 key path (YYYY/MM) for unmatched files.
 *
 * Usage:
 *   bun scripts/migrations/08-backfill-attachments.ts --report-only
 *   bun scripts/migrations/08-backfill-attachments.ts --dry-run
 *   bun scripts/migrations/08-backfill-attachments.ts
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

// biome-ignore lint: allow require for dotenv
require("dotenv").config();
import { createDb } from "../../src/lib/db";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, "data");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MIME_MAP: Record<string, string> = {
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
  ".gif": "image/gif", ".webp": "image/webp", ".avif": "image/avif",
  ".svg": "image/svg+xml", ".ico": "image/x-icon", ".bmp": "image/bmp",
  ".tiff": "image/tiff", ".tif": "image/tiff",
  ".pdf": "application/pdf", ".zip": "application/zip",
  ".mp3": "audio/mpeg", ".wav": "audio/wav",
  ".mp4": "video/mp4", ".mov": "video/quicktime", ".avi": "video/x-msvideo",
};

function mimeFromFilename(filename: string): string {
  const dot = filename.lastIndexOf(".");
  if (dot === -1) return "application/octet-stream";
  return MIME_MAP[filename.slice(dot).toLowerCase()] ?? "application/octet-stream";
}

function generateId(): string {
  const chars = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  const now = Date.now();
  let id = "";
  for (let i = 0; i < 10; i++) { id = chars[now % 32] + id; }
  id += randomUUID().replace(/-/g, "").toUpperCase().slice(0, 16);
  return id;
}

/** Convert YYYY/MM from R2 key path to Unix timestamp (seconds). */
function dateFromKey(key: string): number {
  const match = key.match(/wp-content\/uploads\/(\d{4})\/(\d{2})\//);
  if (!match) return Math.floor(Date.now() / 1000);
  return Math.floor(new Date(`${match[1]}-${match[2]}-01T00:00:00Z`).getTime() / 1000);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const reportOnly = args.includes("--report-only");

  if (reportOnly) {
    console.log("[REPORT ONLY] Analyzing attachment records...");
  } else if (dryRun) {
    console.log("[DRY RUN] Running attachment backfill...");
  } else {
    console.log("Running attachment backfill...");
  }

  const db = createDb(process.env.WORKER_URL!, process.env.WORKER_SECRET!);

  // Load R2 objects
  const r2Data = JSON.parse(readFileSync(resolve(DATA_DIR, "r2-objects.json"), "utf-8")) as {
    key: string; size: number; lastModified: string; etag: string;
  }[];
  const r2Map = new Map(r2Data.map((o) => [o.key, o]));
  console.log(`Loaded ${r2Data.length} R2 objects`);

  // Load WP attachment posts
  const wpPostsRaw = JSON.parse(readFileSync(resolve(DATA_DIR, "wp-posts.json"), "utf-8")) as {
    ID: number; post_date: string; post_title: string; guid: string;
    post_mime_type: string; post_type: string;
  }[];

  type WpAtt = { wpId: number; postDate: string; postTitle: string; mimeType: string };
  const wpByPath = new Map<string, WpAtt>();
  for (const p of wpPostsRaw) {
    if (p.post_type !== "attachment") continue;
    const att: WpAtt = {
      wpId: p.ID,
      postDate: p.post_date,
      postTitle: p.post_title,
      mimeType: p.post_mime_type,
    };
    let path = p.guid.replace(/^https?:\/\/[^/]+\//, "").replace(/^https?:\/\/[^/]+\/\?attachment_id=\d+$/, "");
    path = decodeURIComponent(path);
    if (path && !path.startsWith("?")) {
      wpByPath.set(path.replace(/^lizhengblog\//, ""), att);
    }
  }
  console.log(`Loaded ${wpByPath.size} WP attachment path lookups`);

  // Load existing DB records
  const existing = await db.query<{ id: string; r2_key: string; filename: string; created_at: number }>(
    "SELECT id, r2_key, filename, created_at FROM attachments",
  );
  const existingMap = new Map(existing.results.map((r) => [r.r2_key, r]));
  console.log(`${existingMap.size} attachment records in DB`);

  // Analyze
  let needUpdate = 0;
  let needInsert = 0;
  const wrongDates: { key: string; current: number; correct: number; id: string }[] = [];

  for (const key of r2Data.map((o) => o.key)) {
    const rec = existingMap.get(key);
    const correctDate = (() => {
      const wp = wpByPath.get(key);
      if (wp?.postDate) {
        const ts = Math.floor(new Date(wp.postDate).getTime() / 1000);
        if (ts > 0 && ts < 2000000000) return ts;
      }
      return dateFromKey(key);
    })();

    if (!rec) {
      needInsert++;
    } else {
      const currentYear = new Date(rec.created_at * 1000).getFullYear();
      const correctYear = new Date(correctDate * 1000).getFullYear();
      if (currentYear !== correctYear) {
        needUpdate++;
        wrongDates.push({ key, current: rec.created_at, correct: correctDate, id: rec.id });
      }
    }
  }

  console.log(`\nSummary:`);
  console.log(`  Records needing date correction: ${needUpdate}`);
  console.log(`  Records missing from DB: ${needInsert}`);
  console.log(`  Total to process: ${needUpdate + needInsert}`);

  if (reportOnly) {
    if (wrongDates.length > 0) {
      console.log(`\nSample wrong dates (first 10):`);
      for (const d of wrongDates.slice(0, 10)) {
        const current = new Date(d.current * 1000).getFullYear();
        const correct = new Date(d.correct * 1000).getFullYear();
        console.log(`  ${d.key}: ${current} -> ${correct}`);
      }
    }
    return;
  }

  if (needUpdate === 0 && needInsert === 0) {
    console.log("\nNothing to do.");
    return;
  }

  if (dryRun) {
    console.log("\n[DRY RUN] No changes made.");
    return;
  }

  // Apply fixes
  let updated = 0;
  let inserted = 0;
  const errors: string[] = [];

  if (needUpdate > 0) {
    console.log(`\nUpdating ${needUpdate} records with correct dates...`);
    for (const d of wrongDates) {
      try {
        await db.execute("UPDATE attachments SET created_at = ? WHERE id = ?", [d.correct, d.id]);
        updated++;
      } catch (err: unknown) {
        errors.push(`UPDATE ${d.key}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  if (needInsert > 0) {
    console.log(`\nInserting ${needInsert} missing records...`);
    const missingKeys = r2Data.map((o) => o.key).filter((key) => !existingMap.has(key));
    for (const key of missingKeys) {
      const r2Obj = r2Map.get(key)!;
      const filename = key.split("/").pop() ?? key;
      let mimeType = mimeFromFilename(filename);
      let createdAt = dateFromKey(key);
      let altText: string | null = null;

      const wp = wpByPath.get(key);
      if (wp) {
        if (wp.mimeType) mimeType = wp.mimeType;
        const ts = Math.floor(new Date(wp.postDate).getTime() / 1000);
        if (ts > 0 && ts < 2000000000) createdAt = ts;
        if (wp.postTitle) altText = wp.postTitle;
      }

      try {
        await db.execute(
          `INSERT INTO attachments (id, filename, r2_key, mime_type, size, alt_text, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [generateId(), filename, key, mimeType, r2Obj.size, altText, createdAt],
        );
        inserted++;
      } catch (err: unknown) {
        errors.push(`INSERT ${key}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  console.log(`\nDone. Updated: ${updated}, Inserted: ${inserted}`);
  if (errors.length > 0) {
    console.log(`\nErrors (${errors.length}):`);
    for (const e of errors.slice(0, 10)) console.log(`  ${e}`);
    if (errors.length > 10) console.log(`  ... and ${errors.length - 10} more`);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
