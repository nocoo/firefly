import { defineConfig } from "vitest/config";

const stubServerOnly = new URL("./test/server-only-stub.ts", import.meta.url).pathname;
const srcAlias = new URL("./src", import.meta.url).pathname;

export default defineConfig({
  test: {
    pool: "threads",
    isolate: false,
    maxConcurrency: 20,
    maxWorkers: 12,
    include: ["src/**/*.test.ts", "worker/test/**/*.test.ts", "scripts/**/*.test.ts"],
    exclude: ["e2e/**", "**/node_modules/**", ".claude/**"],
    env: { R2_PUBLIC_URL: "https://assets.example.com" },
    coverage: {
      provider: "v8",
      // AST-aware remapping is the default in vitest v4+; no opt-in needed.
      reporter: ["text-summary"],
      include: ["src/**/*.ts", "worker/src/**/*.ts"],
      exclude: [
        // Test files and type declarations — not production code
        "src/**/*.test.ts",
        "src/**/*.d.ts",
        "worker/src/**/*.d.ts",
        // View / Next.js integration layers — exercised via E2E
        "src/app/**",
        "src/proxy.ts",
        "src/components/**",
        "src/hooks/**",
        // Integration glue — thin wrappers over external services / frameworks
        "src/lib/auth.ts",
        "src/lib/utils.ts",
        "src/lib/r2-client.ts",
        "src/lib/mcp/server.ts",
        "src/models/types.ts",
      ],
      thresholds: {
        lines: 95,
        functions: 95,
        branches: 95,
        statements: 95,
      },
    },
  },
  resolve: {
    alias: {
      "@": srcAlias,
      "server-only": stubServerOnly,
    },
  },
});
