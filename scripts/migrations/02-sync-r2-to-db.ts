#!/usr/bin/env bun
/**
 * 02-sync-r2-to-db.ts — Scan R2 bucket and insert missing objects into
 * the attachments table.
 *
 * Usage:
 *   bun scripts/migrations/02-sync-r2-to-db.ts          # production
 *   bun scripts/migrations/02-sync-r2-to-db.ts --test    # test environment
 *
 * Requires env:
 *   CF_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY
 *   WORKER_URL, WORKER_SECRET (or overrides from .env.test)
 *   R2_BUCKET_NAME (optional, defaults to "lizhengblog")
 */

import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { createDb, type Db } from "../../src/lib/db.ts";
import { ulid } from "ulid";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const isTest = process.argv.includes("--test");

// Load .env.test overrides if in test mode
if (isTest) {
  const { readFileSync, existsSync } = await import("node:fs");
  const { resolve } = await import("node:path");
  const envTestPath = resolve(import.meta.dir, "../../.env.test");
  if (existsSync(envTestPath)) {
    const lines = readFileSync(envTestPath, "utf-8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx === -1) continue;
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim();
      process.env[key] = val;
    }
    console.log("Loaded .env.test overrides");
  }
}

const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID!;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!;
const BUCKET_NAME = process.env.R2_BUCKET_NAME ?? "firefly";
const WORKER_URL = process.env.WORKER_URL!;
const WORKER_SECRET = process.env.WORKER_SECRET!;

if (!CF_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
  console.error("Missing env: CF_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY");
  process.exit(1);
}
if (!WORKER_URL || !WORKER_SECRET) {
  console.error("Missing env: WORKER_URL, WORKER_SECRET");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// R2 client
// ---------------------------------------------------------------------------

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${CF_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

// ---------------------------------------------------------------------------
// MIME detection from extension
// ---------------------------------------------------------------------------

const MIME_MAP: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function detectMimeType(key: string): string {
  const dot = key.lastIndexOf(".");
  if (dot === -1) return "application/octet-stream";
  const ext = key.slice(dot).toLowerCase();
  return MIME_MAP[ext] ?? "application/octet-stream";
}

function extractFilename(key: string): string {
  const parts = key.split("/");
  return parts[parts.length - 1] ?? key;
}

// ---------------------------------------------------------------------------
// List all R2 objects
// ---------------------------------------------------------------------------

interface R2ObjectInfo {
  key: string;
  size: number;
  lastModified: Date;
}

async function listAllObjects(): Promise<R2ObjectInfo[]> {
  const objects: R2ObjectInfo[] = [];
  let continuationToken: string | undefined;

  do {
    const response = await s3.send(
      new ListObjectsV2Command({
        Bucket: BUCKET_NAME,
        MaxKeys: 1000,
        ContinuationToken: continuationToken,
      }),
    );

    for (const obj of response.Contents ?? []) {
      objects.push({
        key: obj.Key!,
        size: obj.Size ?? 0,
        lastModified: obj.LastModified ?? new Date(),
      });
    }

    continuationToken = response.IsTruncated
      ? response.NextContinuationToken
      : undefined;

    console.log(`  Listed ${objects.length} objects so far...`);
  } while (continuationToken);

  return objects;
}

// ---------------------------------------------------------------------------
// Sync to DB
// ---------------------------------------------------------------------------

const BATCH_SIZE = 50;

async function syncToDb(db: Db, objects: R2ObjectInfo[]): Promise<{
  inserted: number;
  skipped: number;
  errors: number;
}> {
  // Get existing r2_keys in one query
  const existing = await db.query<{ r2_key: string }>(
    "SELECT r2_key FROM attachments",
  );
  const existingKeys = new Set(existing.results.map((r) => r.r2_key));

  const toInsert = objects.filter((obj) => !existingKeys.has(obj.key));
  console.log(`\n${toInsert.length} new objects to insert (${existingKeys.size} already in DB)`);

  let inserted = 0;
  let errors = 0;

  for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
    const chunk = toInsert.slice(i, i + BATCH_SIZE);

    const statements = chunk.map((obj) => ({
      sql: `INSERT OR IGNORE INTO attachments (id, filename, r2_key, mime_type, size, created_at)
            VALUES (?, ?, ?, ?, ?, ?)`,
      params: [
        ulid(),
        extractFilename(obj.key),
        obj.key,
        detectMimeType(obj.key),
        obj.size,
        Math.floor(obj.lastModified.getTime() / 1000),
      ],
    }));

    try {
      const results = await db.batch(statements);
      const batchInserted = results.reduce(
        (sum, r) => sum + (r.meta?.changes ?? 0),
        0,
      );
      inserted += batchInserted;
      console.log(
        `  Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batchInserted}/${chunk.length} inserted`,
      );
    } catch (err) {
      errors += chunk.length;
      console.error(
        `  Batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  return { inserted, skipped: existingKeys.size, errors };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

console.log(`R2 → DB sync | bucket: ${BUCKET_NAME} | worker: ${WORKER_URL}`);
console.log(isTest ? "(TEST mode)" : "(PRODUCTION mode)");

const objects = await listAllObjects();
console.log(`\nTotal R2 objects: ${objects.length}`);

const db = createDb(WORKER_URL, WORKER_SECRET);
const result = await syncToDb(db, objects);

console.log("\n=== Summary ===");
console.log(`  Scanned:  ${objects.length}`);
console.log(`  Inserted: ${result.inserted}`);
console.log(`  Skipped:  ${result.skipped} (already in DB)`);
console.log(`  Errors:   ${result.errors}`);
