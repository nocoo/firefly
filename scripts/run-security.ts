#!/usr/bin/env bun
/**
 * G2: Dependencies — OSV Scanner over every lockfile this repository ships.
 *
 * A missing or too-old scanner, a scanner error and actual findings are three
 * different failures and are reported as such. Secrets are G1
 * (`scripts/quality/secrets.ts`), not here.
 *
 * Usage: bun scripts/run-security.ts
 */
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { checkTool } from "./quality/tools";

const root = resolve(import.meta.dir, "..");
const LOCKFILES = ["bun.lock", "worker/bun.lock"];
const config = join(root, "osv-scanner.toml");

console.log("=== G2: Dependencies ===\n");

const tool = await checkTool("osv");
if (!tool.ok) {
  console.error(`G2: scanner unavailable — ${tool.detail}`);
  process.exit(2);
}
console.log(`[G2] ${tool.detail}`);

const missing = LOCKFILES.filter((lockfile) => !existsSync(join(root, lockfile)));
if (missing.length > 0) {
  console.error(`G2: lockfiles missing: ${missing.join(", ")}`);
  process.exit(2);
}

const configArgs = existsSync(config) ? [`--config=${config}`] : [];
let findings = false;
let scannerError = false;

for (const lockfile of LOCKFILES) {
  console.log(`[G2] scanning ${lockfile}`);
  const proc = Bun.spawn(
    ["osv-scanner", "scan", "--lockfile", join(root, lockfile), ...configArgs],
    { cwd: root, stdout: "inherit", stderr: "inherit" },
  );
  await proc.exited;
  const code = proc.exitCode ?? 1;
  if (code === 0) {
    console.log(`[G2] ${lockfile}: no vulnerabilities`);
  } else if (code === 1) {
    findings = true;
  } else {
    scannerError = true;
  }
}

if (scannerError) {
  console.error("=== G2: FAILED — scanner error (not a finding) ===");
  process.exit(1);
}
if (findings) {
  console.error(`=== G2: FAILED — vulnerabilities found in ${LOCKFILES.length} lockfiles ===`);
  process.exit(1);
}

console.log(`\n[G2] lockfiles scanned: ${LOCKFILES.length} (${LOCKFILES.join(", ")}), 0 vulnerabilities`);
