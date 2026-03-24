#!/usr/bin/env bun
/**
 * Apply SQL migration to a Cloudflare D1 database via REST API.
 *
 * @deprecated Use `bun scripts/migrations/migrate.ts up` instead.
 *
 * Usage: bun scripts/migrations/apply-migration.ts <sql-file> [--test]
 *   --test: apply to test database instead of prod
 */
console.warn(
  "⚠️  Deprecated: use `bun scripts/migrations/migrate.ts up` instead\n",
);
import { readFileSync } from "node:fs";

const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID!;
const CF_API_TOKEN = process.env.CF_API_TOKEN!;
const CF_D1_DATABASE_ID = process.env.CF_D1_DATABASE_ID!;
const CF_D1_TEST_DATABASE_ID = process.env.CF_D1_TEST_DATABASE_ID!;

const args = process.argv.slice(2);
const sqlFile = args.find((a) => !a.startsWith("--"));
const useTest = args.includes("--test");

if (!sqlFile) {
  console.error("Usage: bun apply-migration.ts <sql-file> [--test]");
  process.exit(1);
}

if (!CF_ACCOUNT_ID || !CF_API_TOKEN) {
  console.error("Missing CF_ACCOUNT_ID or CF_API_TOKEN in environment");
  process.exit(1);
}

const dbId = useTest ? CF_D1_TEST_DATABASE_ID : CF_D1_DATABASE_ID;
const dbName = useTest ? "lizhengme-db-test" : "lizhengme-db";

console.log(`Applying ${sqlFile} to ${dbName} (${dbId})`);

const sql = readFileSync(sqlFile, "utf-8");

// Split SQL into individual statements, filtering out comments and empty lines
const statements = sql
  .split(";")
  .map((s) =>
    s
      .split("\n")
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n")
      .trim(),
  )
  .filter((s) => s.length > 0);

console.log(`Found ${statements.length} statements to execute`);

const apiUrl = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/d1/database/${dbId}/query`;

let success = 0;
let failed = 0;

for (const stmt of statements) {
  const preview = stmt.substring(0, 60).replace(/\n/g, " ");
  try {
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CF_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sql: stmt + ";" }),
    });

    const data = (await res.json()) as {
      success: boolean;
      errors?: Array<{ message: string }>;
    };

    if (!data.success) {
      const errMsg =
        data.errors?.map((e) => e.message).join(", ") ?? "Unknown error";
      console.error(`  ✗ ${preview}... → ${errMsg}`);
      failed++;
    } else {
      console.log(`  ✓ ${preview}...`);
      success++;
    }
  } catch (err) {
    console.error(`  ✗ ${preview}... → ${err}`);
    failed++;
  }
}

console.log(`\nDone: ${success} succeeded, ${failed} failed`);
if (failed > 0) process.exit(1);
