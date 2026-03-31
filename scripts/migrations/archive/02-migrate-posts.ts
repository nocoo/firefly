#!/usr/bin/env bun
/**
 * 02-migrate-posts.ts — Migrate WordPress posts to Firefly D1.
 *
 * Reads: scripts/migrations/data/wp-posts.json, wp-postmeta.json,
 *        wp-terms.json, wp-term_taxonomy.json, wp-term_relationships.json
 * Target: D1 via Worker proxy (posts, categories, tags, post_tags tables)
 *
 * Usage: bun scripts/migrations/02-migrate-posts.ts [--test]
 *
 * Steps:
 * 1. Migrate user
 * 2. Migrate categories (fix writting → writing slug)
 * 3. Migrate tags (only those with posts)
 * 4. Migrate posts (content transform, image URL rewrite)
 * 5. Assign categories and tags to posts
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { createDb } from "../../src/lib/db";

// biome-ignore lint: allow require for dotenv
require("dotenv").config();

const DATA_DIR = resolve(dirname(new URL(import.meta.url).pathname), "data");

const args = process.argv.slice(2);
const useTest = args.includes("--test");

const WORKER_URL = process.env.WORKER_URL!;
const WORKER_SECRET = process.env.WORKER_SECRET!;

if (!WORKER_URL || !WORKER_SECRET) {
  console.error("Missing WORKER_URL or WORKER_SECRET");
  process.exit(1);
}

const db = createDb(WORKER_URL, WORKER_SECRET);

// ---------------------------------------------------------------------------
// Load exported JSON data
// ---------------------------------------------------------------------------

function loadJson<T>(filename: string): T[] {
  const path = resolve(DATA_DIR, filename);
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    console.warn(`Warning: Could not load ${filename}`);
    return [];
  }
}

const wpPosts = loadJson<Record<string, string | null>>("wp-posts.json");
const wpPostmeta = loadJson<Record<string, string | null>>("wp-postmeta.json");
const wpTerms = loadJson<Record<string, string | null>>("wp-terms.json");
const wpTermTaxonomy = loadJson<Record<string, string | null>>(
  "wp-term_taxonomy.json",
);
const wpTermRelationships = loadJson<Record<string, string | null>>(
  "wp-term_relationships.json",
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateUlid(): string {
  // Simple ULID-like ID for migration (monotonic, sortable)
  const ts = Date.now().toString(36).padStart(10, "0");
  const rand = Math.random().toString(36).slice(2, 12).padStart(10, "0");
  return (ts + rand).toUpperCase();
}

function wpDateToUnix(dateStr: string | null): number | null {
  if (!dateStr || dateStr === "0000-00-00 00:00:00") return null;
  return Math.floor(new Date(dateStr + "Z").getTime() / 1000);
}

function statusMap(wpStatus: string | null): string {
  switch (wpStatus) {
    case "publish":
      return "published";
    case "draft":
      return "draft";
    case "private":
      return "private";
    case "pending":
      return "draft";
    default:
      return "draft";
  }
}

function transformContent(content: string | null): string {
  if (!content) return "";

  let result = content;

  // Replace WordPress image URLs with R2 custom domain
  result = result.replace(
    /https?:\/\/lizheng\.me\/wp-content\/uploads\//g,
    "https://b.no.mt/wp-content/uploads/",
  );

  // Strip WordPress shortcodes [shortcode attr="val"]...[/shortcode]
  result = result.replace(/\[\/?\w+[^\]]*\]/g, "");

  // Convert WordPress caption blocks to plain images
  result = result.replace(
    /\[caption[^\]]*\](.*?)\[\/caption\]/gs,
    "$1",
  );

  return result.trim();
}

function calculateReadingTime(content: string): number {
  const words = content.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

function generateExcerpt(content: string, maxLength = 160): string {
  // Strip HTML tags
  const text = content.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).replace(/\s\S*$/, "") + "...";
}

// ---------------------------------------------------------------------------
// Step 1: Migrate user
// ---------------------------------------------------------------------------

async function migrateUser() {
  console.log("\n--- Step 1: Migrate user ---");
  const wpUser = wpPosts.length > 0 ? "nocoo" : "nocoo";
  const id = generateUlid();

  try {
    await db.execute(
      `INSERT INTO users (id, email, name, role) VALUES (?, ?, ?, ?)
       ON CONFLICT (email) DO NOTHING`,
      [id, "lizheng@lizheng.me", wpUser, "admin"],
    );
    console.log("  ✓ User migrated: lizheng@lizheng.me");
  } catch (err) {
    console.log(`  ⚠ User may already exist: ${err}`);
  }
}

// ---------------------------------------------------------------------------
// Step 2: Migrate categories
// ---------------------------------------------------------------------------

const categoryIdMap = new Map<string, string>(); // wp_term_id → new_id

async function migrateCategories() {
  console.log("\n--- Step 2: Migrate categories ---");

  // Build taxonomy lookup: term_id → { taxonomy, count }
  const taxMap = new Map<
    string,
    { taxonomy: string; count: number; description: string | null }
  >();
  for (const row of wpTermTaxonomy) {
    taxMap.set(row.term_id!, {
      taxonomy: row.taxonomy!,
      count: parseInt(row.count ?? "0", 10),
      description: row.description,
    });
  }

  let count = 0;
  for (const term of wpTerms) {
    const tax = taxMap.get(term.term_id!);
    if (!tax || tax.taxonomy !== "category" || tax.count === 0) continue;

    const id = generateUlid();
    let slug = term.slug!;

    // Fix known typo
    if (slug === "writting") slug = "writing";

    categoryIdMap.set(term.term_id!, id);

    await db.execute(
      `INSERT INTO categories (id, name, slug, description, post_count)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (slug) DO UPDATE SET name = excluded.name`,
      [id, term.name!, slug, tax.description, tax.count],
    );
    count++;
    console.log(`  ✓ Category: ${term.name} (${slug})`);
  }
  console.log(`  Total: ${count} categories`);
}

// ---------------------------------------------------------------------------
// Step 3: Migrate tags
// ---------------------------------------------------------------------------

const tagIdMap = new Map<string, string>(); // wp_term_id → new_id

async function migrateTags() {
  console.log("\n--- Step 3: Migrate tags ---");

  const taxMap = new Map<string, { taxonomy: string; count: number }>();
  for (const row of wpTermTaxonomy) {
    taxMap.set(row.term_id!, {
      taxonomy: row.taxonomy!,
      count: parseInt(row.count ?? "0", 10),
    });
  }

  let count = 0;
  for (const term of wpTerms) {
    const tax = taxMap.get(term.term_id!);
    if (!tax || tax.taxonomy !== "post_tag" || tax.count === 0) continue;

    const id = generateUlid();
    tagIdMap.set(term.term_id!, id);

    await db.execute(
      `INSERT INTO tags (id, name, slug, post_count)
       VALUES (?, ?, ?, ?)
       ON CONFLICT (slug) DO UPDATE SET name = excluded.name`,
      [id, term.name!, term.slug!, tax.count],
    );
    count++;
  }
  console.log(`  Total: ${count} tags`);
}

// ---------------------------------------------------------------------------
// Step 4: Migrate posts
// ---------------------------------------------------------------------------

const postIdMap = new Map<string, string>(); // wp_post_id → new_id

async function migratePosts() {
  console.log("\n--- Step 4: Migrate posts ---");

  // Build postmeta lookup
  const metaMap = new Map<string, Map<string, string>>();
  for (const row of wpPostmeta) {
    if (!metaMap.has(row.post_id!)) metaMap.set(row.post_id!, new Map());
    metaMap.get(row.post_id!)!.set(row.meta_key!, row.meta_value ?? "");
  }

  // Build category and tag relationships
  const postCategories = new Map<string, string[]>(); // wp_post_id → [wp_term_id]
  const postTags = new Map<string, string[]>();

  // Get term_taxonomy_id → term_id mapping
  const ttIdToTermId = new Map<string, string>();
  const ttIdToTaxonomy = new Map<string, string>();
  for (const row of wpTermTaxonomy) {
    ttIdToTermId.set(row.term_taxonomy_id!, row.term_id!);
    ttIdToTaxonomy.set(row.term_taxonomy_id!, row.taxonomy!);
  }

  for (const rel of wpTermRelationships) {
    const termId = ttIdToTermId.get(rel.term_taxonomy_id!);
    const taxonomy = ttIdToTaxonomy.get(rel.term_taxonomy_id!);
    if (!termId || !taxonomy) continue;

    if (taxonomy === "category") {
      if (!postCategories.has(rel.object_id!))
        postCategories.set(rel.object_id!, []);
      postCategories.get(rel.object_id!)!.push(termId);
    } else if (taxonomy === "post_tag") {
      if (!postTags.has(rel.object_id!)) postTags.set(rel.object_id!, []);
      postTags.get(rel.object_id!)!.push(termId);
    }
  }

  // Build attachment lookup for featured images
  const attachmentMap = new Map<string, string>(); // wp_attachment_id → R2 URL
  for (const p of wpPosts) {
    if (p.post_type !== "attachment") continue;
    const meta = metaMap.get(p.ID!);
    const attachedFile = meta?.get("_wp_attached_file");
    if (attachedFile) {
      attachmentMap.set(
        p.ID!,
        `https://b.no.mt/wp-content/uploads/${attachedFile}`,
      );
    }
  }

  // Filter posts
  const posts = wpPosts.filter(
    (p) =>
      p.post_type === "post" &&
      ["publish", "draft", "private", "pending"].includes(p.post_status!),
  );

  console.log(`  Found ${posts.length} posts to migrate`);

  let migrated = 0;
  for (const post of posts) {
    const id = generateUlid();
    postIdMap.set(post.ID!, id);

    const content = transformContent(post.post_content);
    const status = statusMap(post.post_status);
    const publishedAt = wpDateToUnix(post.post_date);
    const createdAt = wpDateToUnix(post.post_date) ?? Math.floor(Date.now() / 1000);
    const readingTime = calculateReadingTime(content);
    const excerpt = post.post_excerpt?.trim() || generateExcerpt(content);

    // Category (first one if multiple)
    const catTermIds = postCategories.get(post.ID!) ?? [];
    let categoryId: string | null = null;
    for (const termId of catTermIds) {
      if (categoryIdMap.has(termId)) {
        categoryId = categoryIdMap.get(termId)!;
        break;
      }
    }

    // Featured image
    const meta = metaMap.get(post.ID!);
    const thumbnailWpId = meta?.get("_thumbnail_id");
    const featuredImage = thumbnailWpId
      ? attachmentMap.get(thumbnailWpId) ?? null
      : null;

    // WordPress permalink for redirects
    const wpPermalink = publishedAt
      ? `/index.php/${new Date(publishedAt * 1000).getFullYear()}/${String(new Date(publishedAt * 1000).getMonth() + 1).padStart(2, "0")}/${post.post_name}/`
      : null;

    await db.execute(
      `INSERT INTO posts (id, title, slug, content, excerpt, status, category_id, featured_image, reading_time, wp_id, wp_permalink, published_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (slug) DO NOTHING`,
      [
        id,
        post.post_title!,
        post.post_name!,
        content,
        excerpt,
        status,
        categoryId,
        featuredImage,
        readingTime,
        parseInt(post.ID!, 10),
        wpPermalink,
        publishedAt,
        createdAt,
        createdAt,
      ],
    );

    // Assign tags
    const tagTermIds = postTags.get(post.ID!) ?? [];
    for (const termId of tagTermIds) {
      const tagId = tagIdMap.get(termId);
      if (tagId) {
        await db
          .execute(
            `INSERT INTO post_tags (post_id, tag_id) VALUES (?, ?)
             ON CONFLICT DO NOTHING`,
            [id, tagId],
          )
          .catch(() => {
            // Ignore duplicate
          });
      }
    }

    migrated++;
    if (migrated % 50 === 0) {
      console.log(`  Migrated ${migrated}/${posts.length}...`);
    }
  }

  console.log(`  Total: ${migrated} posts migrated`);
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

console.log(`Migrating to ${useTest ? "TEST" : "PROD"} database`);
console.log(
  `Data files: ${DATA_DIR}\n`,
);

await migrateUser();
await migrateCategories();
await migrateTags();
await migratePosts();

console.log("\n✓ Migration complete!");
console.log(`  Categories: ${categoryIdMap.size}`);
console.log(`  Tags: ${tagIdMap.size}`);
console.log(`  Posts: ${postIdMap.size}`);
