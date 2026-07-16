#!/usr/bin/env bun
/**
 * Static guard against unconditional test.skip / describe.skip / it.skip.
 *
 * Biome's noSkippedTests cannot distinguish conditional L3 gates
 *   test.skip(condition, reason)
 * from committed permanent skips
 *   test.skip("name", fn) / test.skip(true, "reason") / test.skip().
 *
 * e2e/** keeps noSkippedTests off for the conditional form; this gate
 * restores the old ESLint no-restricted-syntax protection for permanent
 * skips (and still bans .only via biome noFocusedTests).
 *
 * Uses oxc-parser so the gate stays independent of the TypeScript version.
 */

import { readFileSync } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import { parseSync } from "oxc-parser";

const REPO_ROOT = process.env.FIREFLY_GATE_ROOT ?? join(import.meta.dir, "..");
const ROOTS = [REPO_ROOT];
const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  ".next",
  ".next-e2e",
  ".next-e2e-ui",
  "coverage",
  "__golden__",
  ".git",
  ".husky",
  ".claude",
  ".wrangler",
  "scripts/migrations/archive",
]);

interface Violation {
  path: string;
  line: number;
  col: number;
  snippet: string;
  kind: "skip" | "only";
}

interface Loc {
  line: number;
  column: number;
}

interface OxcNode {
  type: string;
  start?: number;
  end?: number;
  loc?: { start: Loc; end: Loc };
  callee?: OxcNode;
  object?: OxcNode;
  property?: OxcNode;
  arguments?: OxcNode[];
  name?: string;
  value?: unknown;
  expression?: OxcNode;
  [key: string]: unknown;
}

function posToLine(src: string, pos: number): number {
  let line = 1;
  for (let i = 0; i < pos && i < src.length; i++) {
    if (src.charCodeAt(i) === 10) line++;
  }
  return line;
}

function posToCol(src: string, pos: number): number {
  let col = 0;
  for (let i = pos - 1; i >= 0; i--) {
    if (src.charCodeAt(i) === 10) break;
    col++;
  }
  return col;
}

/** test / it / describe / suite (optionally chained, e.g. test.concurrent) */
function isTestNamespace(node: OxcNode | undefined): boolean {
  if (!node) return false;
  if (node.type === "Identifier") {
    const n = node.name ?? "";
    return (
      n === "test" ||
      n === "it" ||
      n === "describe" ||
      n === "suite" ||
      n === "xdescribe" ||
      n === "xit" ||
      n === "xtest"
    );
  }
  if (node.type === "MemberExpression") {
    return isTestNamespace(node.object);
  }
  return false;
}

function isSkipCallee(node: OxcNode): boolean {
  if (node.type !== "MemberExpression" || !node.property) return false;
  if (!(node.property.type === "Identifier" && node.property.name === "skip")) {
    return false;
  }
  // Only test.skip / describe.skip — not ctx.skip() (Vitest runtime gate).
  return isTestNamespace(node.object);
}

function isOnlyCallee(node: OxcNode): boolean {
  if (node.type !== "MemberExpression" || !node.property) return false;
  if (!(node.property.type === "Identifier" && node.property.name === "only")) {
    return false;
  }
  return isTestNamespace(node.object);
}

/**
 * Permanent skip:
 *  - test.skip() / test.skip(fn)           (args < 2)
 *  - test.skip("name", fn)                 (first arg string/number/bool literal)
 *  - test.skip(true, "reason")             (first arg boolean true)
 * Conditional L3 form allowed:
 *  - test.skip(condition, reason)          (first arg is expression, not Literal)
 */
function isPermanentSkip(args: OxcNode[] | undefined): boolean {
  if (!args || args.length < 2) return true;
  const first = args[0];
  if (!first) return true;
  if (first.type === "Literal") return true;
  // template without expressions is effectively a fixed string
  if (first.type === "TemplateLiteral") {
    const exprs = (first as { expressions?: unknown[] }).expressions;
    if (!Array.isArray(exprs) || exprs.length === 0) return true;
  }
  return false;
}

function collect(
  node: OxcNode | null | undefined,
  path: string,
  src: string,
  out: Violation[],
): void {
  if (!node || typeof node !== "object") return;

  if (node.type === "CallExpression" && node.callee) {
    const startPos = node.start ?? 0;
    const line = node.loc?.start.line ?? posToLine(src, startPos);
    const col = node.loc?.start.column ?? posToCol(src, startPos);
    const endPos = node.end ?? startPos;
    const snippet = (src.slice(startPos, endPos).split("\n")[0] ?? "").trim();

    if (isOnlyCallee(node.callee)) {
      out.push({ path, line, col: col + 1, snippet, kind: "only" });
    } else if (isSkipCallee(node.callee) && isPermanentSkip(node.arguments)) {
      out.push({ path, line, col: col + 1, snippet, kind: "skip" });
    }
  }

  for (const key in node) {
    if (key === "loc" || key === "start" || key === "end" || key === "type") continue;
    const value = (node as Record<string, unknown>)[key];
    if (Array.isArray(value)) {
      for (const item of value) collect(item as OxcNode, path, src, out);
    } else if (value && typeof value === "object" && "type" in (value as object)) {
      collect(value as OxcNode, path, src, out);
    }
  }
}

async function main(): Promise<void> {
  const violations: Violation[] = [];
  let scannedCount = 0;

  async function walk(dir: string): Promise<void> {
    let entries: string[];
    try {
      entries = await readdir(dir);
    } catch {
      return;
    }
    for (const name of entries) {
      const full = join(dir, name);
      const s = await stat(full);
      if (s.isDirectory()) {
        if (SKIP_DIRS.has(name)) continue;
        await walk(full);
      } else if (/\.(test|spec)\.(tsx?|jsx?)$/.test(name) || /\/e2e\//.test(full)) {
        if (!/\.(tsx?|jsx?|mts|cts)$/.test(name)) continue;
        scannedCount++;
        const src = readFileSync(full, "utf-8");
        const repoRel = relative(REPO_ROOT, full);
        const r = parseSync(full, src);
        if (r.errors.length > 0) {
          for (const err of r.errors) {
            console.error(`✗ parse error ${repoRel}: ${err.message}`);
          }
          process.exit(1);
        }
        collect(r.program as unknown as OxcNode, repoRel, src, violations);
      }
    }
  }

  for (const root of ROOTS) await walk(root);

  if (scannedCount === 0) {
    console.error(
      `FATAL: scanned 0 test files under ${ROOTS.join(", ")} — misconfigured?`,
    );
    process.exit(1);
  }

  if (violations.length === 0) {
    console.log(
      `✓ no permanent .skip / .only in tests (${scannedCount} files scanned)`,
    );
    process.exit(0);
  }

  console.error(
    `✗ permanent test modifiers forbidden (${violations.length}):\n`,
  );
  for (const v of violations) {
    console.error(`  ${v.path}:${v.line}:${v.col}  [${v.kind}]`);
    console.error(`    ${v.snippet}`);
  }
  console.error(
    "\n  Use conditional test.skip(condition, reason) for empty-data L3 gates.",
  );
  console.error("  Do not commit test.skip(\"name\", fn) / test.only / bare .skip().");
  process.exit(1);
}

void main();
