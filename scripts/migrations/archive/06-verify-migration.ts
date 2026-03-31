#!/usr/bin/env bun
/**
 * 06-verify-migration.ts — Verify migration integrity.
 *
 * Runs count checks and spot-checks against D1 to verify all data
 * was migrated correctly.
 *
 * Usage: bun scripts/migrations/06-verify-migration.ts [--test]
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

interface CheckResult {
  name: string;
  passed: boolean;
  detail: string;
}

const results: CheckResult[] = [];

function check(name: string, passed: boolean, detail: string) {
  results.push({ name, passed, detail });
  const icon = passed ? "✓" : "✗";
  console.log(`  ${icon} ${name}: ${detail}`);
}

// ---------------------------------------------------------------------------
// Count checks
// ---------------------------------------------------------------------------

async function countChecks() {
  console.log("\n--- Count Checks ---");

  // Users
  const users = await db.firstOrNull<{ count: number }>(
    "SELECT COUNT(*) as count FROM users",
  );
  check("Users", (users?.count ?? 0) >= 1, `${users?.count ?? 0} users`);

  // Categories (expect 2 active)
  const categories = await db.firstOrNull<{ count: number }>(
    "SELECT COUNT(*) as count FROM categories",
  );
  check(
    "Categories",
    (categories?.count ?? 0) >= 2,
    `${categories?.count ?? 0} categories (expected ≥2)`,
  );

  // Tags (expect ~36 with posts)
  const tags = await db.firstOrNull<{ count: number }>(
    "SELECT COUNT(*) as count FROM tags",
  );
  check(
    "Tags",
    (tags?.count ?? 0) >= 30,
    `${tags?.count ?? 0} tags (expected ≥30)`,
  );

  // Published posts (expect ~72)
  const published = await db.firstOrNull<{ count: number }>(
    "SELECT COUNT(*) as count FROM posts WHERE status = 'published'",
  );
  check(
    "Published posts",
    (published?.count ?? 0) >= 70,
    `${published?.count ?? 0} published (expected ≥70)`,
  );

  // Draft posts (expect ~674)
  const drafts = await db.firstOrNull<{ count: number }>(
    "SELECT COUNT(*) as count FROM posts WHERE status = 'draft'",
  );
  check(
    "Draft posts",
    (drafts?.count ?? 0) >= 600,
    `${drafts?.count ?? 0} drafts (expected ≥600)`,
  );

  // Total posts
  const totalPosts = await db.firstOrNull<{ count: number }>(
    "SELECT COUNT(*) as count FROM posts",
  );
  check(
    "Total posts",
    (totalPosts?.count ?? 0) >= 700,
    `${totalPosts?.count ?? 0} total (expected ≥700)`,
  );

  // Comments (expect ~595 approved)
  const comments = await db.firstOrNull<{ count: number }>(
    "SELECT COUNT(*) as count FROM comments",
  );
  check(
    "Comments",
    (comments?.count ?? 0) >= 500,
    `${comments?.count ?? 0} comments (expected ≥500)`,
  );

  // Post-tag relationships
  const postTags = await db.firstOrNull<{ count: number }>(
    "SELECT COUNT(*) as count FROM post_tags",
  );
  check(
    "Post-tag relations",
    (postTags?.count ?? 0) > 0,
    `${postTags?.count ?? 0} post-tag relations`,
  );

  // Redirects
  const redirects = await db.firstOrNull<{ count: number }>(
    "SELECT COUNT(*) as count FROM redirects",
  );
  check(
    "Redirects",
    (redirects?.count ?? 0) >= 70,
    `${redirects?.count ?? 0} redirects (expected ≥70)`,
  );
}

// ---------------------------------------------------------------------------
// Data integrity checks
// ---------------------------------------------------------------------------

async function integrityChecks() {
  console.log("\n--- Integrity Checks ---");

  // Category slug typo fix
  const writting = await db.firstOrNull<{ count: number }>(
    "SELECT COUNT(*) as count FROM categories WHERE slug = 'writting'",
  );
  check(
    "Category slug fix",
    (writting?.count ?? 0) === 0,
    `'writting' slug ${writting?.count === 0 ? "correctly renamed" : "still exists!"}`,
  );

  const writing = await db.firstOrNull<{ count: number }>(
    "SELECT COUNT(*) as count FROM categories WHERE slug = 'writing'",
  );
  check(
    "Writing category exists",
    (writing?.count ?? 0) === 1,
    `'writing' category ${writing?.count === 1 ? "found" : "missing!"}`,
  );

  // Image URLs transformed
  const OLD_DOMAIN = process.env.MIGRATION_OLD_DOMAIN ?? "your-old-domain.com";
  const NEW_DOMAIN = process.env.MIGRATION_NEW_DOMAIN ?? "assets.your-new-domain.com";
  const oldUrls = await db.firstOrNull<{ count: number }>(
    `SELECT COUNT(*) as count FROM posts
     WHERE content LIKE '%${OLD_DOMAIN}/wp-content/uploads/%'
       AND content NOT LIKE '%${NEW_DOMAIN}/wp-content/uploads/%'`,
  );
  check(
    "Image URL rewrite",
    (oldUrls?.count ?? 0) === 0,
    `${oldUrls?.count ?? 0} posts with old image URLs (expected 0)`,
  );

  // All published posts have published_at
  const noPublishDate = await db.firstOrNull<{ count: number }>(
    "SELECT COUNT(*) as count FROM posts WHERE status = 'published' AND published_at IS NULL",
  );
  check(
    "Published dates",
    (noPublishDate?.count ?? 0) === 0,
    `${noPublishDate?.count ?? 0} published posts without date (expected 0)`,
  );

  // Threaded comments have valid parents
  const orphanComments = await db.firstOrNull<{ count: number }>(
    `SELECT COUNT(*) as count FROM comments c
     WHERE c.parent_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM comments p WHERE p.id = c.parent_id)`,
  );
  check(
    "Comment threading",
    (orphanComments?.count ?? 0) === 0,
    `${orphanComments?.count ?? 0} orphaned child comments (expected 0)`,
  );

  // Redirect format check (no double slashes, etc.)
  const badRedirects = await db.firstOrNull<{ count: number }>(
    "SELECT COUNT(*) as count FROM redirects WHERE source_path = target_path",
  );
  check(
    "Redirect sanity",
    (badRedirects?.count ?? 0) === 0,
    `${badRedirects?.count ?? 0} self-referencing redirects (expected 0)`,
  );
}

// ---------------------------------------------------------------------------
// Spot checks
// ---------------------------------------------------------------------------

async function spotChecks() {
  console.log("\n--- Spot Checks ---");

  // Check a known post exists
  const firstPost = await db.firstOrNull<{
    title: string;
    slug: string;
    status: string;
  }>("SELECT title, slug, status FROM posts ORDER BY published_at ASC LIMIT 1");
  check(
    "Oldest post",
    !!firstPost,
    firstPost
      ? `"${firstPost.title}" (${firstPost.slug}) — ${firstPost.status}`
      : "No posts found!",
  );

  // Check a post with comments
  const commentedPost = await db.firstOrNull<{
    title: string;
    comment_count: number;
  }>(
    "SELECT title, comment_count FROM posts WHERE comment_count > 0 ORDER BY comment_count DESC LIMIT 1",
  );
  check(
    "Most commented post",
    !!commentedPost && commentedPost.comment_count > 0,
    commentedPost
      ? `"${commentedPost.title}" — ${commentedPost.comment_count} comments`
      : "No commented posts!",
  );

  // Check redirect works for a known pattern
  const redirect = await db.firstOrNull<{
    source_path: string;
    target_path: string;
  }>("SELECT source_path, target_path FROM redirects LIMIT 1");
  check(
    "Sample redirect",
    !!redirect,
    redirect
      ? `${redirect.source_path} → ${redirect.target_path}`
      : "No redirects found!",
  );
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

console.log("=== Migration Verification ===");

await countChecks();
await integrityChecks();
await spotChecks();

// Summary
console.log("\n=== Summary ===");
const passed = results.filter((r) => r.passed).length;
const failed = results.filter((r) => !r.passed).length;
console.log(`  Passed: ${passed}`);
console.log(`  Failed: ${failed}`);
console.log(`  Total:  ${results.length}`);

if (failed > 0) {
  console.log("\n⚠ Some checks failed! Review the output above.");
  process.exit(1);
} else {
  console.log("\n✓ All checks passed!");
}
