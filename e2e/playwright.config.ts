import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./browser",
  baseURL: process.env.E2E_BASE_URL ?? "http://localhost:27043",
  timeout: 30_000,
  retries: 0,
  use: {
    headless: true,
    screenshot: "only-on-failure",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
