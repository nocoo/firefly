#!/usr/bin/env bun
/**
 * 01-audit-r2-images.ts — List all objects in R2 bucket and compare with
 * WordPress attachment metadata.
 *
 * Writes: scripts/migrations/data/r2-objects.json
 *
 * Usage: bun scripts/migrations/01-audit-r2-images.ts
 *
 * Requires env: CF_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY
 * Optional env: R2_BUCKET_NAME (default: lizhengblog)
 */

import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";

const DATA_DIR = resolve(dirname(new URL(import.meta.url).pathname), "data");

const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID!;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!;
const BUCKET_NAME = process.env.R2_BUCKET_NAME ?? "firefly";

if (!CF_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
  console.error(
    "Missing env: CF_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY",
  );
  process.exit(1);
}

const client = new S3Client({
  region: "auto",
  endpoint: `https://${CF_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

interface R2Object {
  key: string;
  size: number;
  lastModified: string;
  etag: string;
}

async function listAllObjects(): Promise<R2Object[]> {
  const objects: R2Object[] = [];
  let continuationToken: string | undefined;

  do {
    const command = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      MaxKeys: 1000,
      ContinuationToken: continuationToken,
    });

    const response = await client.send(command);

    for (const obj of response.Contents ?? []) {
      objects.push({
        key: obj.Key!,
        size: obj.Size!,
        lastModified: obj.LastModified!.toISOString(),
        etag: obj.ETag?.replace(/"/g, "") ?? "",
      });
    }

    continuationToken = response.IsTruncated
      ? response.NextContinuationToken
      : undefined;

    console.log(`  Listed ${objects.length} objects so far...`);
  } while (continuationToken);

  return objects;
}

console.log(`Listing all objects in R2 bucket: ${BUCKET_NAME}`);
const objects = await listAllObjects();

const totalSize = objects.reduce((sum, obj) => sum + obj.size, 0);
console.log(`\nTotal: ${objects.length} objects, ${(totalSize / 1024 / 1024).toFixed(1)} MB`);

// Write JSON
const outFile = resolve(DATA_DIR, "r2-objects.json");
writeFileSync(outFile, JSON.stringify(objects, null, 2));
console.log(`Written to: ${outFile}`);

// Summary by directory
const dirs = new Map<string, { count: number; size: number }>();
for (const obj of objects) {
  const parts = obj.key.split("/");
  const dir = parts.length > 1 ? parts.slice(0, -1).join("/") : "(root)";
  const existing = dirs.get(dir) ?? { count: 0, size: 0 };
  existing.count++;
  existing.size += obj.size;
  dirs.set(dir, existing);
}

console.log("\nBy directory:");
const sorted = [...dirs.entries()].sort((a, b) => b[1].count - a[1].count);
for (const [dir, { count, size }] of sorted.slice(0, 20)) {
  console.log(`  ${dir}: ${count} files, ${(size / 1024 / 1024).toFixed(1)} MB`);
}
