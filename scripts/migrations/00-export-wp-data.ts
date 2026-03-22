#!/usr/bin/env bun
/**
 * 00-export-wp-data.ts — Parse WordPress MySQL dump and export to JSON.
 *
 * Reads: scripts/migrations/data/host_lizheng_dump.sql.gz
 * Writes: scripts/migrations/data/wp-*.json
 *
 * Usage: bun scripts/migrations/00-export-wp-data.ts
 */

import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { resolve, dirname } from "node:path";

const DATA_DIR = resolve(dirname(new URL(import.meta.url).pathname), "data");
const DUMP_FILE = resolve(DATA_DIR, "host_lizheng_dump.sql.gz");

console.log("Reading SQL dump...");
const compressed = readFileSync(DUMP_FILE);
const sql = gunzipSync(compressed).toString("utf-8");
console.log(`Dump size: ${(sql.length / 1024 / 1024).toFixed(1)} MB`);

// ---------------------------------------------------------------------------
// Parser: extract INSERT rows from SQL dump
// ---------------------------------------------------------------------------

interface InsertData {
  table: string;
  columns: string[];
  rows: Record<string, string | null>[];
}

function parseInserts(content: string, tableName: string): InsertData {
  const pattern = new RegExp(
    `INSERT INTO \`${tableName}\`\\s*\\(([^)]+)\\)\\s*VALUES\\s*`,
    "gi",
  );

  const columns: string[] = [];
  const rows: Record<string, string | null>[] = [];

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(content)) !== null) {
    if (columns.length === 0) {
      columns.push(
        ...match[1].split(",").map((c) => c.trim().replace(/`/g, "")),
      );
    }

    // Find the VALUES portion - everything from match end to the semicolon
    const startIdx = match.index + match[0].length;
    let depth = 0;
    let inString = false;
    let escape = false;
    let endIdx = startIdx;

    for (let i = startIdx; i < content.length; i++) {
      const ch = content[i];

      if (escape) {
        escape = false;
        continue;
      }

      if (ch === "\\") {
        escape = true;
        continue;
      }

      if (ch === "'" && !escape) {
        inString = !inString;
        continue;
      }

      if (inString) continue;

      if (ch === "(") depth++;
      if (ch === ")") depth--;
      if (ch === ";" && depth === 0) {
        endIdx = i;
        break;
      }
    }

    const valuesStr = content.slice(startIdx, endIdx);
    const rowStrings = extractRows(valuesStr);

    for (const rowStr of rowStrings) {
      const values = parseRowValues(rowStr);
      if (values.length === columns.length) {
        const row: Record<string, string | null> = {};
        for (let i = 0; i < columns.length; i++) {
          row[columns[i]] = values[i];
        }
        rows.push(row);
      }
    }
  }

  return { table: tableName, columns, rows };
}

function extractRows(valuesStr: string): string[] {
  const rows: string[] = [];
  let depth = 0;
  let inString = false;
  let escape = false;
  let start = -1;

  for (let i = 0; i < valuesStr.length; i++) {
    const ch = valuesStr[i];

    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\") {
      escape = true;
      continue;
    }
    if (ch === "'" && !escape) {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (ch === "(") {
      if (depth === 0) start = i + 1;
      depth++;
    }
    if (ch === ")") {
      depth--;
      if (depth === 0 && start >= 0) {
        rows.push(valuesStr.slice(start, i));
        start = -1;
      }
    }
  }

  return rows;
}

function parseRowValues(rowStr: string): (string | null)[] {
  const values: (string | null)[] = [];
  let current = "";
  let inString = false;
  let escape = false;

  for (let i = 0; i < rowStr.length; i++) {
    const ch = rowStr[i];

    if (escape) {
      current += ch;
      escape = false;
      continue;
    }

    if (ch === "\\") {
      escape = true;
      current += ch;
      continue;
    }

    if (ch === "'") {
      if (!inString) {
        inString = true;
      } else {
        inString = false;
      }
      continue;
    }

    if (ch === "," && !inString) {
      values.push(processValue(current.trim()));
      current = "";
      continue;
    }

    current += ch;
  }

  values.push(processValue(current.trim()));
  return values;
}

function processValue(val: string): string | null {
  if (val === "NULL") return null;
  // Unescape MySQL string escapes
  return val
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\'/g, "'")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\");
}

// ---------------------------------------------------------------------------
// Extract tables
// ---------------------------------------------------------------------------

const tables = [
  "lizheng_users",
  "lizheng_posts",
  "lizheng_postmeta",
  "lizheng_terms",
  "lizheng_term_taxonomy",
  "lizheng_term_relationships",
  "lizheng_comments",
  "lizheng_commentmeta",
];

for (const table of tables) {
  console.log(`Parsing ${table}...`);
  const data = parseInserts(sql, table);
  const outFile = resolve(DATA_DIR, `wp-${table.replace("lizheng_", "")}.json`);
  writeFileSync(outFile, JSON.stringify(data.rows, null, 2));
  console.log(`  → ${data.rows.length} rows → ${outFile}`);
}

// Also try to parse Independent Analytics tables
const analyticsTables = [
  "lizheng_independent_analytics_views",
  "lizheng_independent_analytics_sessions",
  "lizheng_independent_analytics_referrers",
];

for (const table of analyticsTables) {
  console.log(`Parsing ${table}...`);
  const data = parseInserts(sql, table);
  if (data.rows.length > 0) {
    const shortName = table.replace("lizheng_independent_analytics_", "ia-");
    const outFile = resolve(DATA_DIR, `wp-${shortName}.json`);
    writeFileSync(outFile, JSON.stringify(data.rows, null, 2));
    console.log(`  → ${data.rows.length} rows → ${outFile}`);
  } else {
    console.log(`  → 0 rows (table may not exist in dump)`);
  }
}

console.log("\nDone! Exported JSON files to scripts/migrations/data/");
