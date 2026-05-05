import { defineConfig } from "vitest/config";

// Files that mutate global backend state (site_settings, backup config) must
// run serially to avoid races. Everything else is safe to parallelize since
// each test creates uniquely-named entities (slugs include random suffixes).
const SERIAL_FILES = [
  "e2e/api/backup.test.ts",
  "e2e/api/backup-pull.test.ts",
  "e2e/api/settings.test.ts",
  "e2e/api/settings-ai.test.ts",
  "e2e/api/auth.test.ts",
  "e2e/api/unfurl-enhance.test.ts",
];

export default defineConfig({
  test: {
    globals: true,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    projects: [
      {
        test: {
          name: "e2e-parallel",
          include: ["e2e/api/**/*.test.ts"],
          exclude: SERIAL_FILES,
          globals: true,
          testTimeout: 30_000,
          hookTimeout: 30_000,
          fileParallelism: true,
          maxWorkers: 8,
          minWorkers: 2,
        },
      },
      {
        test: {
          name: "e2e-serial",
          include: SERIAL_FILES,
          globals: true,
          testTimeout: 30_000,
          hookTimeout: 30_000,
          fileParallelism: false,
        },
      },
    ],
  },
});
