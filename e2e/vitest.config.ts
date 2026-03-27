import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["e2e/api/**/*.test.ts"],
    globals: true,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // E2E tests share a single backend (D1 database + R2 bucket).
    // Parallel file execution causes state races (e.g. backup.test.ts
    // and backup-pull.test.ts both mutate site_settings).
    fileParallelism: false,
  },
});
