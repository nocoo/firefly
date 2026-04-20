import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./browser",
  timeout: 30_000,
  retries: 0,
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
