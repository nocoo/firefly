#!/usr/bin/env bun
/**
 * E2E Runner — starts test worker + Next.js dev server, runs E2E tests, tears down.
 *
 * Usage:
 *   bun scripts/run-e2e.ts              # Run all E2E (API + browser)
 *   bun scripts/run-e2e.ts --api-only   # Run API E2E only (L2)
 *   bun scripts/run-e2e.ts --browser-only # Run browser E2E only (L3)
 *
 * Port convention:
 *   Dev:     7043
 *   API E2E: 17043 (10000 + dev)
 *   BDD E2E: 27043 (20000 + dev)
 */
import { spawn, type Subprocess } from "bun";
import { readFileSync, existsSync } from "node:fs";

const DEV_PORT = 7043;
const API_E2E_PORT = DEV_PORT + 10000; // 17043
const BROWSER_E2E_PORT = DEV_PORT + 20000; // 27043

const args = process.argv.slice(2);
const apiOnly = args.includes("--api-only");
const browserOnly = args.includes("--browser-only");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) return {};
  const env: Record<string, string> = {};
  for (const line of readFileSync(path, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    env[trimmed.slice(0, eqIdx)] = trimmed.slice(eqIdx + 1);
  }
  return env;
}

async function waitForServer(url: string, timeoutMs = 30_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (res.ok || res.status < 500) return;
    } catch {
      // not ready yet
    }
    await Bun.sleep(500);
  }
  throw new Error(`Server at ${url} did not start within ${timeoutMs}ms`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const procs: Subprocess[] = [];

function cleanup() {
  for (const p of procs) {
    try {
      p.kill();
    } catch {
      // already exited
    }
  }
}

process.on("SIGINT", () => {
  cleanup();
  process.exit(130);
});

async function main() {
  const testEnv = loadEnvFile(".env.test");
  const prodEnv = loadEnvFile(".env");

  // Merge: prod env as base, test env overrides
  const env = { ...process.env, ...prodEnv, ...testEnv };

  const port = apiOnly ? API_E2E_PORT : browserOnly ? BROWSER_E2E_PORT : API_E2E_PORT;

  // --- Start Next.js dev server ---
  console.log(`▸ Starting Next.js on port ${port}...`);
  const nextProc = spawn(["bun", "run", "next", "dev", "--turbopack", "-p", String(port)], {
    cwd: process.cwd(),
    env: { ...env, PORT: String(port) },
    stdout: "ignore",
    stderr: "ignore",
  });
  procs.push(nextProc);

  try {
    await waitForServer(`http://localhost:${port}/api/posts`, 60_000);
    console.log(`▸ Next.js ready on port ${port}`);
  } catch (e) {
    console.error("❌ Next.js failed to start");
    cleanup();
    process.exit(1);
  }

  // --- Run tests ---
  let exitCode = 0;

  if (!browserOnly) {
    console.log("\n▸ Running API E2E tests (L2)...\n");
    const apiTest = spawn(
      ["bun", "run", "vitest", "run", "--config", "e2e/vitest.config.ts"],
      {
        cwd: process.cwd(),
        env: { ...env, E2E_BASE_URL: `http://localhost:${API_E2E_PORT}` },
        stdout: "inherit",
        stderr: "inherit",
      },
    );
    const apiResult = await apiTest.exited;
    if (apiResult !== 0) exitCode = 1;
  }

  if (!apiOnly) {
    const bPort = browserOnly ? BROWSER_E2E_PORT : BROWSER_E2E_PORT;
    console.log("\n▸ Running browser E2E tests (L3)...\n");
    const browserTest = spawn(
      ["bunx", "playwright", "test", "--config", "e2e/playwright.config.ts"],
      {
        cwd: process.cwd(),
        env: { ...env, E2E_BASE_URL: `http://localhost:${bPort}` },
        stdout: "inherit",
        stderr: "inherit",
      },
    );
    const browserResult = await browserTest.exited;
    if (browserResult !== 0) exitCode = 1;
  }

  // --- Cleanup ---
  cleanup();
  process.exit(exitCode);
}

main();
