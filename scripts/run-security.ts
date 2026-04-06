#!/usr/bin/env bun
/**
 * G2 Security Gate — osv-scanner (dependency CVEs) + gitleaks (secrets detection).
 *
 * Usage: bun scripts/run-security.ts
 */
import { $ } from "bun";

async function main() {
  console.log("=== G2: Security Gate ===\n");
  let failed = false;

  // 1. osv-scanner — check bun.lock for known CVEs
  console.log("[G2] osv-scanner: checking dependencies...");
  try {
    await $`osv-scanner scan --config=osv-scanner.toml --lockfile=bun.lock`.quiet();
    console.log("[G2] osv-scanner: ✅ no vulnerabilities\n");
  } catch {
    console.error("[G2] osv-scanner: ❌ vulnerabilities found\n");
    failed = true;
  }

  // 2. gitleaks — check for secrets in commits since upstream
  console.log("[G2] gitleaks: checking for secrets...");
  try {
    let range: string;
    try {
      const upstream = await $`git rev-parse --abbrev-ref @{upstream}`.quiet().text();
      range = `${upstream.trim()}..HEAD`;
    } catch {
      // No upstream branch — scan entire history
      range = "";
    }

    if (range) {
      await $`gitleaks git --log-opts=${range} --no-banner`.quiet();
    } else {
      await $`gitleaks git --no-banner`.quiet();
    }
    console.log("[G2] gitleaks: ✅ no leaks\n");
  } catch {
    console.error("[G2] gitleaks: ❌ secrets detected\n");
    failed = true;
  }

  if (failed) {
    console.error("=== G2: FAILED ===");
    process.exit(1);
  }

  console.log("=== G2: All checks passed ===");
}

main();
