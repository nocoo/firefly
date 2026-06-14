import { defineConfig } from "@playwright/test";

export default defineConfig({
  // Stage 2 (final) of the L3 → BDD migration (see docs/25-l3-bdd-refactor.md
  // §6.2): the legacy `e2e/browser/` directory has been emptied and removed;
  // the runner now collects only `e2e/bdd/*.spec.ts` (12 specs / 162 tests).
  testDir: "./bdd",
  timeout: 30_000,
  retries: 1,
  fullyParallel: true,
  // Browser tests are short (most under 1s) and IO-bound. Use more workers
  // than the playwright default (1 in CI, 50% cores otherwise).
  workers: 10,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:27028",
    headless: true,
    screenshot: "only-on-failure",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
