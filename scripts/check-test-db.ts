#!/usr/bin/env bun
/**
 * Pre-push check: verify test D1 database has all required tables.
 *
 * This catches the case where new migrations haven't been applied to the
 * test environment before pushing, which would cause CI E2E to fail.
 */

import { $ } from "bun";

// Tables that must exist in the test database
const REQUIRED_TABLES = [
  "posts",
  "categories",
  "tags",
  "comments",
  "attachments",
  "ai_agents",  // Added in migration 014
];

async function main() {
  console.log("Checking test D1 database schema...");

  try {
    // Query sqlite_master for table names
    const result = await $`cd worker && npx wrangler d1 execute lizhengme-db-test --env test --remote --json --command "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name NOT LIKE 'd1_%'"`.quiet();

    const output = JSON.parse(result.stdout.toString());
    const tables = output[0]?.results?.map((r: { name: string }) => r.name) ?? [];

    const missing = REQUIRED_TABLES.filter((t) => !tables.includes(t));

    if (missing.length > 0) {
      console.error(`\n❌ Test D1 is missing tables: ${missing.join(", ")}`);
      console.error("\nRun migrations on test D1 before pushing:");
      console.error("  cd worker");
      console.error("  npx wrangler d1 execute lizhengme-db-test --env test --remote --file ../scripts/migrations/<migration>.sql");
      console.error("  npx wrangler deploy --env test");
      process.exit(1);
    }

    console.log(`✓ All ${REQUIRED_TABLES.length} required tables exist in test D1`);
  } catch (err) {
    console.error("Failed to check test D1:", err);
    console.error("\nMake sure you're authenticated with Cloudflare (npx wrangler login)");
    process.exit(1);
  }
}

main();
