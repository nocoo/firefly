import { cpus } from "node:os";
import { defineConfig } from "@playwright/test";

// Scale workers to the box. On a 2-vCPU CI runner, 10 workers saturate the
// Next.js → wrangler-dev channel: undici's socket pool hands out stale
// connections and Next.js SSR fetches throw `fetch failed` in bursts
// (STU-2495 — CI worker log shows every request returning 200 while the
// client throws). Cap workers to ceil(cpus/2), min 2, max 10. Dev boxes
// (10+ cores) still get the full 10, CI (2 cores) gets 2–3.
const workerCount = Math.max(2, Math.min(10, Math.ceil(cpus().length / 2)));

export default defineConfig({
  // Stage 2 (final) of the L3 → BDD migration (see docs/25-l3-bdd-refactor.md
  // §6.2): the legacy `e2e/browser/` directory has been emptied and removed;
  // the runner now collects only `e2e/bdd/*.spec.ts` (12 specs / 162 tests).
  testDir: "./bdd",
  timeout: 30_000,
  retries: 1,
  fullyParallel: true,
  workers: workerCount,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:27028",
    headless: true,
    screenshot: "only-on-failure",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
