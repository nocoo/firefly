#!/usr/bin/env bun
/**
 * 04-generate-redirects.ts — Generate 301 redirect entries from WordPress URLs.
 *
 * Creates redirects for:
 * - Posts: /index.php/YYYY/MM/slug/ → /YYYY/MM/slug
 * - Categories: /index.php/category/slug/ → /category/slug
 * - Tags: /index.php/tag/slug/ → /tag/slug
 *
 * Requires: Posts, categories, and tags must already be migrated.
 *
 * Usage: bun scripts/migrations/04-generate-redirects.ts [--test]
 */

import { createDb } from "../../src/lib/db";

// biome-ignore lint: allow require for dotenv
require("dotenv").config();

const WORKER_URL = process.env.WORKER_URL!;
const WORKER_SECRET = process.env.WORKER_SECRET!;

if (!WORKER_URL || !WORKER_SECRET) {
  console.error("Missing WORKER_URL or WORKER_SECRET");
  process.exit(1);
}

const db = createDb(WORKER_URL, WORKER_SECRET);

function generateUlid(): string {
  const ts = Date.now().toString(36).padStart(10, "0");
  const rand = Math.random().toString(36).slice(2, 12).padStart(10, "0");
  return (ts + rand).toUpperCase();
}

// ---------------------------------------------------------------------------
// Post redirects
// ---------------------------------------------------------------------------

async function generatePostRedirects(): Promise<number> {
  console.log("Generating post redirects...");

  const result = await db.query<{
    slug: string;
    published_at: number;
    wp_permalink: string | null;
  }>(
    `SELECT slug, published_at, wp_permalink FROM posts
     WHERE wp_permalink IS NOT NULL AND published_at IS NOT NULL`,
  );

  let count = 0;
  for (const post of result.results) {
    if (!post.published_at) continue;

    const date = new Date(post.published_at * 1000);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const targetPath = `/${year}/${month}/${post.slug}`;

    // Main redirect: /index.php/YYYY/MM/slug/ → /YYYY/MM/slug
    const sourcePath = `/index.php/${year}/${month}/${post.slug}/`;

    await db
      .execute(
        `INSERT INTO redirects (id, source_path, target_path, status_code)
         VALUES (?, ?, ?, 301)
         ON CONFLICT (source_path) DO NOTHING`,
        [generateUlid(), sourcePath, targetPath],
      )
      .catch(() => {});

    // Also redirect without trailing slash
    await db
      .execute(
        `INSERT INTO redirects (id, source_path, target_path, status_code)
         VALUES (?, ?, ?, 301)
         ON CONFLICT (source_path) DO NOTHING`,
        [generateUlid(), `/index.php/${year}/${month}/${post.slug}`, targetPath],
      )
      .catch(() => {});

    count++;
  }

  console.log(`  ✓ ${count} post redirects`);
  return count;
}

// ---------------------------------------------------------------------------
// Category redirects
// ---------------------------------------------------------------------------

async function generateCategoryRedirects(): Promise<number> {
  console.log("Generating category redirects...");

  const result = await db.query<{ slug: string }>(
    "SELECT slug FROM categories",
  );

  let count = 0;
  for (const cat of result.results) {
    const targetPath = `/category/${cat.slug}`;

    // /index.php/category/slug/ → /category/slug
    await db
      .execute(
        `INSERT INTO redirects (id, source_path, target_path, status_code)
         VALUES (?, ?, ?, 301)
         ON CONFLICT (source_path) DO NOTHING`,
        [generateUlid(), `/index.php/category/${cat.slug}/`, targetPath],
      )
      .catch(() => {});

    // Handle writting → writing redirect specifically
    if (cat.slug === "writing") {
      await db
        .execute(
          `INSERT INTO redirects (id, source_path, target_path, status_code)
           VALUES (?, ?, ?, 301)
           ON CONFLICT (source_path) DO NOTHING`,
          [generateUlid(), `/index.php/category/writting/`, targetPath],
        )
        .catch(() => {});

      await db
        .execute(
          `INSERT INTO redirects (id, source_path, target_path, status_code)
           VALUES (?, ?, ?, 301)
           ON CONFLICT (source_path) DO NOTHING`,
          [generateUlid(), `/category/writting`, targetPath],
        )
        .catch(() => {});
    }

    count++;
  }

  console.log(`  ✓ ${count} category redirects`);
  return count;
}

// ---------------------------------------------------------------------------
// Tag redirects
// ---------------------------------------------------------------------------

async function generateTagRedirects(): Promise<number> {
  console.log("Generating tag redirects...");

  const result = await db.query<{ slug: string }>("SELECT slug FROM tags");

  let count = 0;
  for (const tag of result.results) {
    const targetPath = `/tag/${tag.slug}`;

    // /index.php/tag/slug/ → /tag/slug
    await db
      .execute(
        `INSERT INTO redirects (id, source_path, target_path, status_code)
         VALUES (?, ?, ?, 301)
         ON CONFLICT (source_path) DO NOTHING`,
        [generateUlid(), `/index.php/tag/${tag.slug}/`, targetPath],
      )
      .catch(() => {});

    count++;
  }

  console.log(`  ✓ ${count} tag redirects`);
  return count;
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

console.log("Generating WordPress URL redirects\n");

const postCount = await generatePostRedirects();
const catCount = await generateCategoryRedirects();
const tagCount = await generateTagRedirects();

console.log(`\n✓ Total redirects generated: ${postCount + catCount + tagCount}`);
