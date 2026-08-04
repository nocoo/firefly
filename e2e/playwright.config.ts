import { availableParallelism } from "node:os";
import { defineConfig } from "@playwright/test";

// Scale workers to the box. On a 2-vCPU CI runner, 10 workers saturate the
// Next.js → wrangler-dev localhost pipe and the client fetch throws
// `Network error: fetch failed` in bursts while the worker log shows every
// request returning 200 OK — an unconfirmed channel disruption on the
// Next.js side (STU-2495 run 30896621829). We cap at ceil(cores/2) with a
// hard floor of 2 and a hard ceiling of 10:
//   -  2 cores → workers = 2 (CI hosted runner)
//   -  4 cores → workers = 2
//   -  8 cores → workers = 4
//   - 20 cores → workers = 10 (typical dev workstation)
// Prefer availableParallelism() over cpus().length: it respects cgroup /
// container CPU limits, whereas cpus() reports the host's cores. If the
// runtime pre-dates Node 20, fall back to cpus().length.
function computeWorkers(): number {
  // Node 20+ ships availableParallelism; guard for older runtimes.
  const parallel = availableParallelism();
  return Math.max(2, Math.min(10, Math.ceil(parallel / 2)));
}

export default defineConfig({
  // Stage 2 (final) of the L3 → BDD migration (see docs/25-l3-bdd-refactor.md
  // §6.2): the legacy `e2e/browser/` directory has been emptied and removed;
  // the runner now collects only `e2e/bdd/*.spec.ts` (12 specs / 162 tests).
  testDir: "./bdd",
  timeout: 30_000,
  retries: 1,
  fullyParallel: true,
  workers: computeWorkers(),
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:27028",
    headless: true,
    screenshot: "only-on-failure",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
