import { defineConfig } from "@playwright/test";

export default defineConfig({
  // Stage 1 of the L3 → BDD migration (see docs/25-l3-bdd-refactor.md §6.2):
  // collect specs from both the legacy `browser/` directory and the new
  // `bdd/` directory while migration is in progress. Stage 2 will collapse
  // testDir to `./bdd` once `browser/` is empty.
  testDir: "./",
  testMatch: ["browser/**/*.spec.ts", "bdd/**/*.spec.ts"],
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
