/**
 * Migration runner — discovers SQL files, diffs against applied, applies pending.
 *
 * Core logic is adapter-agnostic: works with any DbAdapter implementation.
 */
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, basename } from "node:path";
import { createAdapter, type DbAdapter } from "./db-adapter.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MigrationFile {
  name: string; // "001-init"
  filename: string; // "001-init.sql"
  path: string;
  seq: number; // 1
  checksum: string; // sha256 hex
}

interface AppliedMigration {
  name: string;
  applied_at: number;
  checksum: string;
}

export interface ApplyResult {
  applied: string[];
  skipped: string[];
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MIGRATIONS_DIR = resolve(import.meta.dir);
const SQL_FILE_RE = /^(\d{3})-.+\.sql$/;

const CREATE_MIGRATIONS_TABLE = `
CREATE TABLE IF NOT EXISTS _migrations (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL UNIQUE,
  applied_at INTEGER NOT NULL DEFAULT (unixepoch()),
  checksum   TEXT NOT NULL
)`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sha256(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function discoverMigrations(): MigrationFile[] {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => SQL_FILE_RE.test(f))
    .sort();

  return files.map((filename) => {
    const match = filename.match(SQL_FILE_RE)!;
    const path = resolve(MIGRATIONS_DIR, filename);
    const content = readFileSync(path, "utf-8");
    return {
      name: filename.replace(/\.sql$/, ""),
      filename,
      path,
      seq: parseInt(match[1], 10),
      checksum: sha256(content),
    };
  });
}

/**
 * Parse migration SQL into pre-batch statements and batch section.
 *
 * Migration files can have two sections:
 * 1. Statements before `-- @batch` marker: executed one-by-one (can skip on error)
 * 2. Statements after `-- @batch` marker: executed as a single batch request
 *    (preserves connection-level state like PRAGMA foreign_keys)
 *
 * If no `-- @batch` marker, all statements run in normal mode (one-by-one).
 */
interface ParsedMigration {
  preBatchStatements: string[];
  batchSql: string | null;
}

function parseMigration(sql: string): ParsedMigration {
  const batchMarker = "-- @batch";
  const markerIndex = sql.indexOf(batchMarker);

  if (markerIndex === -1) {
    // No batch section, all statements are pre-batch
    return {
      preBatchStatements: splitStatements(sql),
      batchSql: null,
    };
  }

  const preBatchSql = sql.slice(0, markerIndex);
  const batchSql = sql.slice(markerIndex + batchMarker.length);

  return {
    preBatchStatements: splitStatements(preBatchSql),
    batchSql: stripComments(batchSql),
  };
}

/**
 * Strip comments from SQL, keeping only executable statements.
 */
function stripComments(sql: string): string {
  return sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .trim();
}

function splitStatements(sql: string): string[] {
  return sql
    .split(";")
    .map((s) =>
      s
        .split("\n")
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n")
        .trim(),
    )
    .filter((s) => s.length > 0);
}

// ---------------------------------------------------------------------------
// Core operations
// ---------------------------------------------------------------------------

async function ensureMigrationsTable(adapter: DbAdapter): Promise<void> {
  await adapter.execute(CREATE_MIGRATIONS_TABLE);
}

async function getApplied(adapter: DbAdapter): Promise<AppliedMigration[]> {
  return adapter.query<AppliedMigration>(
    "SELECT name, applied_at, checksum FROM _migrations ORDER BY id",
  );
}

async function applyOne(
  adapter: DbAdapter,
  migration: MigrationFile,
): Promise<void> {
  const sql = readFileSync(migration.path, "utf-8");
  const { preBatchStatements, batchSql } = parseMigration(sql);

  const totalParts =
    preBatchStatements.length + (batchSql ? 1 : 0);
  const modeDesc = batchSql
    ? `${preBatchStatements.length} pre-batch + batch`
    : `${preBatchStatements.length} statements`;
  console.log(`▸ Applying ${migration.name} (${modeDesc})...`);

  // Execute pre-batch statements one by one (can skip on error)
  for (const stmt of preBatchStatements) {
    const preview = stmt.substring(0, 70).replace(/\n/g, " ");
    try {
      await adapter.execute(stmt);
      console.log(`  ✓ ${preview}...`);
    } catch (err) {
      const msg = String(err);
      // Handle "duplicate column name" gracefully — common when bootstrapping
      // an existing database that already had the ALTER applied manually.
      if (/duplicate column name/i.test(msg)) {
        console.log(`  ⊘ ${preview} (column already exists, skipping)`);
        continue;
      }
      // Handle "table already exists" without IF NOT EXISTS
      if (/table .* already exists/i.test(msg)) {
        console.log(`  ⊘ ${preview} (table already exists, skipping)`);
        continue;
      }
      // Handle "index already exists" without IF NOT EXISTS
      if (/index .* already exists/i.test(msg)) {
        console.log(`  ⊘ ${preview} (index already exists, skipping)`);
        continue;
      }
      throw err;
    }
  }

  // Execute batch section (all statements in single request)
  if (batchSql) {
    console.log(`  ▸ Executing batch section...`);
    try {
      await adapter.execute(batchSql);
      console.log(`  ✓ Batch executed successfully`);
    } catch (err) {
      const msg = String(err);
      console.log(`  ✗ Batch failed: ${msg}`);
      throw err;
    }
  }

  // Record successful application
  await adapter.execute(
    `INSERT INTO _migrations (name, checksum) VALUES ('${migration.name}', '${migration.checksum}')`,
  );
  console.log(`  ✓ Recorded ${migration.name}`);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function applyAll(
  target: "prod" | "local",
): Promise<ApplyResult> {
  const adapter = createAdapter(target);
  console.log(`▸ Target: ${adapter.label}`);

  await ensureMigrationsTable(adapter);

  const discovered = discoverMigrations();
  const applied = await getApplied(adapter);
  const appliedNames = new Set(applied.map((a) => a.name));
  const appliedMap = new Map(applied.map((a) => [a.name, a]));

  // Check for checksum mismatches
  const warnings: string[] = [];
  for (const m of discovered) {
    const prev = appliedMap.get(m.name);
    if (prev && prev.checksum !== m.checksum) {
      warnings.push(
        `Checksum mismatch for ${m.name}: recorded=${prev.checksum.slice(0, 12)}… current=${m.checksum.slice(0, 12)}…`,
      );
    }
  }

  // Check for missing files
  for (const a of applied) {
    if (!discovered.some((d) => d.name === a.name)) {
      throw new Error(
        `Migration "${a.name}" is recorded as applied but the .sql file is missing`,
      );
    }
  }

  const pending = discovered.filter((d) => !appliedNames.has(d.name));
  const skipped = discovered
    .filter((d) => appliedNames.has(d.name))
    .map((d) => d.name);

  console.log(
    `▸ Found ${discovered.length} migration files, ${applied.length} already applied`,
  );

  if (pending.length === 0) {
    console.log("▸ All up-to-date");
    return { applied: [], skipped, warnings };
  }

  const appliedNames2: string[] = [];
  for (const m of pending) {
    await applyOne(adapter, m);
    appliedNames2.push(m.name);
  }

  return { applied: appliedNames2, skipped, warnings };
}

export async function status(
  target: "prod" | "local",
): Promise<void> {
  const adapter = createAdapter(target);
  console.log(`▸ Target: ${adapter.label}\n`);

  await ensureMigrationsTable(adapter);

  const discovered = discoverMigrations();
  const applied = await getApplied(adapter);
  const appliedMap = new Map(applied.map((a) => [a.name, a]));

  console.log("  Migration              Status      Applied At            Checksum");
  console.log("  ─────────────────────  ──────────  ────────────────────  ────────────");

  for (const m of discovered) {
    const prev = appliedMap.get(m.name);
    if (prev) {
      const date = new Date(prev.applied_at * 1000)
        .toISOString()
        .replace("T", " ")
        .slice(0, 19);
      const match = prev.checksum === m.checksum ? "✓" : "⚠ changed";
      console.log(
        `  ${m.name.padEnd(23)} applied     ${date}  ${match}`,
      );
    } else {
      console.log(
        `  ${m.name.padEnd(23)} pending     ${"—".padEnd(19)}  —`,
      );
    }
  }

  // Check for applied but missing files
  for (const a of applied) {
    if (!discovered.some((d) => d.name === a.name)) {
      console.log(
        `  ${a.name.padEnd(23)} ⚠ MISSING   —                     —`,
      );
    }
  }

  const pendingCount = discovered.filter(
    (d) => !appliedMap.has(d.name),
  ).length;
  console.log(`\n  ${applied.length} applied, ${pendingCount} pending`);
}
