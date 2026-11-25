import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    allowOnly: false,
    passWithNoTests: false,
    globals: true,
    environment: "node",
    include: ["test/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.d.ts", "**/index.ts", "**/types.ts"],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
