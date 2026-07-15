#!/usr/bin/env bun
/**
 * E2E Runner — starts local wrangler worker + Next.js, runs E2E tests, tears down.
 *
 * All test infrastructure is local — no remote Cloudflare resources required:
 *   - D1: wrangler dev --local --persist-to .wrangler/e2e-d1 (Miniflare SQLite)
 *   - R2: filesystem adapter via E2E_R2_LOCAL_DIR (see src/lib/r2-client.ts)
 *   - Auth: bypassed via E2E_SKIP_AUTH=true
 *
 * Usage:
 *   bun scripts/run-e2e.ts              # Run all E2E (API + browser)
 *   bun scripts/run-e2e.ts --api-only   # Run API E2E only (L2)
 *   bun scripts/run-e2e.ts --browser-only # Run browser E2E only (L3)
 *
 * Port convention:
 *   Dev:     7028
 *   API E2E: 17028 (10000 + dev)
 *   BDD E2E: 27028 (20000 + dev)
 *   Worker:  8787  (wrangler default, local only)
 */
import { spawn, type Subprocess } from "bun";
import { readFileSync, existsSync, statSync, readdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";

// Use the current bun binary path for spawning subprocesses
const BUN = process.execPath;

// Resolve wrangler binary from the worker's node_modules
const WRANGLER = `${process.cwd()}/worker/node_modules/.bin/wrangler`;

const DEV_PORT = 7028;
const API_E2E_PORT = DEV_PORT + 10000; // 17028
const BROWSER_E2E_PORT = DEV_PORT + 20000; // 27028
const WORKER_PORT = 8787;

const args = process.argv.slice(2);
const apiOnly = args.includes("--api-only");
const browserOnly = args.includes("--browser-only");

// ---------------------------------------------------------------------------
// Persist directories — cleaned before each run
// ---------------------------------------------------------------------------

const PERSIST_D1 = resolve("worker/.wrangler/e2e-d1");
const PERSIST_R2 = resolve(".wrangler/e2e-r2");

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

async function waitForServer(
  url: string,
  timeoutMs = 30_000,
  /** When true, only res.ok (2xx) counts as ready. Use for health endpoints. */
  strictOk = false,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(2000),
        // Skip HTTPS redirect in production mode by pretending we're already on HTTPS
        headers: { "x-forwarded-proto": "https" },
      });
      if (strictOk ? res.ok : res.ok || res.status < 500) return;
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

function startWorker(): Subprocess {
  console.log(`▸ Starting local worker on port ${WORKER_PORT}...`);
  const proc = spawn(
    [
      WRANGLER,
      "dev",
      "--local",
      `--persist-to=${PERSIST_D1}`,
      "--port",
      String(WORKER_PORT),
      "--var",
      "WORKER_SECRET:test-secret",
    ],
    {
      cwd: `${process.cwd()}/worker`,
      env: { ...process.env, WRANGLER_LOG: "error" },
      stdout: "ignore",
      stderr: "ignore",
    },
  );
  procs.push(proc);
  return proc;
}

let didBuild = false;

/** Newest mtime in src/, public/, app/, plus key config files. */
function sourcesNewestMtime(): number {
  let newest = 0;
  function walk(dir: string) {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name.startsWith("."))
          continue;
        walk(p);
      } else if (entry.isFile()) {
        try {
          const m = statSync(p).mtimeMs;
          if (m > newest) newest = m;
        } catch { /* ignore missing path */ }
      }
    }
  }
  for (const d of ["src", "public"]) walk(d);
  for (const f of [
    "next.config.ts",
    "package.json",
    "bun.lock",
    "tsconfig.json",
    "postcss.config.mjs",
  ]) {
    if (existsSync(f)) {
      try {
        const m = statSync(f).mtimeMs;
        if (m > newest) newest = m;
      } catch { /* ignore missing path */ }
    }
  }
  return newest;
}

function nextBuildIsFresh(): boolean {
  const buildId = ".next/BUILD_ID";
  if (!existsSync(buildId)) return false;
  const buildMtime = statSync(buildId).mtimeMs;
  return buildMtime >= sourcesNewestMtime();
}

function buildNextOnce(env: Record<string, string | undefined>): void {
  if (didBuild) return;
  if (nextBuildIsFresh()) {
    console.log("▸ Reusing existing .next build (sources unchanged)");
    didBuild = true;
    return;
  }
  // Build first, then start in production mode.
  // Next.js 16 refuses to run two `next dev` instances in the same directory,
  // so we use `bun run build` + `next start` which has no such restriction and
  // better matches production behavior.
  console.log(`▸ Building Next.js for E2E (turbopack)...`);
  const build = Bun.spawnSync([BUN, "x", "next", "build", "--turbo"], {
    cwd: process.cwd(),
    env,
    stdout: "ignore",
    stderr: "pipe",
  });
  if (build.exitCode !== 0) {
    console.error(
      `❌ Next.js build failed:\n${build.stderr.toString().slice(-500)}`,
    );
    cleanup();
    process.exit(1);
  }
  didBuild = true;
}

function startNextServer(
  env: Record<string, string | undefined>,
  port: number,
): Subprocess {
  buildNextOnce(env);
  console.log(`▸ Starting Next.js (production) on port ${port}...`);
  const proc = spawn(
    [BUN, "run", "next", "start", "-p", String(port)],
    {
      cwd: process.cwd(),
      env: { ...env, PORT: String(port) },
      stdout: "ignore",
      stderr: "ignore",
    },
  );
  procs.push(proc);
  return proc;
}

async function main() {
  // --- Clean persist directories for a fresh run ---
  for (const dir of [PERSIST_D1, PERSIST_R2]) {
    rmSync(dir, { recursive: true, force: true });
  }
  console.log("▸ Cleaned persist directories (D1 + R2)");

  // --- Build env: load .env as base, then inject E2E overrides ---
  const prodEnv = loadEnvFile(".env");

  // R2_PUBLIC_URL must point to a Next.js server that will actually be running.
  // --api-only  → only 17028 is started
  // --browser-only → only 27028 is started
  // default       → both started; 17028 serves R2 reads for both L2 and L3
  const r2Port = browserOnly ? BROWSER_E2E_PORT : API_E2E_PORT;

  const env: Record<string, string | undefined> = {
    ...prodEnv,
    ...process.env,
    // Worker — always local
    WORKER_URL: `http://localhost:${WORKER_PORT}`,
    WORKER_SECRET: "test-secret",
    // Auth — bypassed
    E2E_SKIP_AUTH: "true",
    CI: "true",
    // E2E gate — activates local R2 adapter and /__e2e-r2 read route
    E2E_TEST_RUNNER: "true",
    // R2 — local filesystem adapter (see src/lib/r2-client.ts)
    R2_BUCKET_NAME: "local-e2e",
    R2_PUBLIC_URL: `http://localhost:${r2Port}/__e2e-r2`,
    R2_KEY_PREFIX: "e2e/",
    E2E_R2_LOCAL_DIR: PERSIST_R2,
  };

  // --- Start local worker ---
  startWorker();
  await waitForWorkerReady();

  // --- Apply DB migrations to local D1 ---
  console.log("▸ Applying DB migrations to local D1...");
  try {
    const { applyAll } = await import("./migrations/runner.ts");
    const result = await applyAll("local");
    console.log(
      `▸ Migrations: ${result.applied.length} applied, ${result.skipped.length} already up-to-date`,
    );
  } catch (err) {
    console.error("❌ Migration failed:", err);
    cleanup();
    process.exit(1);
  }

  // --- Start Next.js server(s) ---
  // In default (all) mode, start two servers: API on 17028, browser on 27028.
  // In --api-only or --browser-only mode, start one server on the appropriate port.
  const apiPort = API_E2E_PORT;
  const browserPort = BROWSER_E2E_PORT;

  if (apiOnly) {
    startNextServer(env, apiPort);
    await waitForReady(apiPort);
  } else if (browserOnly) {
    startNextServer(env, browserPort);
    await waitForReady(browserPort);
  } else {
    // Default: start both servers for API + browser E2E
    startNextServer(env, apiPort);
    startNextServer(env, browserPort);
    await Promise.all([waitForReady(apiPort), waitForReady(browserPort)]);
  }

  // --- Run tests ---
  let exitCode = 0;

  // L2 and L3 share a local D1. Running them concurrently can produce flaky
  // tests because L2 deletes posts that L3 is about to read. Keep sequential.
  if (!browserOnly) {
    console.log("\n▸ Running API E2E tests (L2)...\n");
    const apiTest = spawn(
      [BUN, "run", "vitest", "run", "--config", "e2e/vitest.config.ts"],
      {
        cwd: process.cwd(),
        env: { ...env, E2E_BASE_URL: `http://localhost:${apiPort}` },
        stdout: "inherit",
        stderr: "inherit",
      },
    );
    const apiResult = await apiTest.exited;
    if (apiResult !== 0) exitCode = 1;
  }

  if (!apiOnly) {
    console.log("\n▸ Running browser E2E tests (L3)...\n");
    const browserTest = spawn(
      [BUN, "x", "playwright", "test", "--config", "e2e/playwright.config.ts"],
      {
        cwd: process.cwd(),
        env: { ...env, E2E_BASE_URL: `http://localhost:${browserPort}` },
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

async function waitForWorkerReady(): Promise<void> {
  try {
    await waitForServer(
      `http://localhost:${WORKER_PORT}/api/v1/health`,
      30_000,
      true, // strictOk: health must return 2xx
    );
    console.log(`▸ Test worker ready on port ${WORKER_PORT}`);
  } catch {
    console.error(`❌ Test worker failed to start on port ${WORKER_PORT}`);
    cleanup();
    process.exit(1);
  }
}

async function waitForReady(port: number): Promise<void> {
  try {
    await waitForServer(`http://localhost:${port}/api/posts`, 60_000);
    console.log(`▸ Next.js ready on port ${port}`);
  } catch {
    console.error(`❌ Next.js failed to start on port ${port}`);
    cleanup();
    process.exit(1);
  }
}

main();
