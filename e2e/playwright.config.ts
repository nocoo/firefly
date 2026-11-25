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
// availableParallelism() is Node 20+ and respects cgroup / container CPU
// limits, whereas cpus() returns the host cores even inside a container.
// The project's toolchain pins Node 26+; availableParallelism() needs Node 20+,
// so no fallback is provided;
// running on older Node throws at import time, which is preferable to
// silently over-scheduling.
function computeWorkers(): number {
  return Math.max(2, Math.min(10, Math.ceil(availableParallelism() / 2)));
}

export default defineConfig({
  // L4 core smoke suite (`e2e/bdd/*.spec.ts`): 6 specs on Desktop Chromium.
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
