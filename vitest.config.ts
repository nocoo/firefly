import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    exclude: ["e2e/**", "node_modules/**", "worker/**", ".claude/**"],
    env: {
      R2_PUBLIC_URL: "https://assets.example.com",
    },
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.test.ts",
        "src/**/*.d.ts",
        // Next.js integration layers — tested via E2E, not unit tests
        "src/app/**",        // pages, layouts, API routes
        "src/proxy.ts",      // Next.js proxy (middleware)
        "src/components/**", // React components
        "src/hooks/**",      // React hooks
        "src/viewmodels/**", // React viewmodels
        // Config/integration glue — thin wrappers over external services
        "src/lib/auth.ts",   // Auth.js config (NextAuth integration)
        "src/lib/api.ts",    // 2 helper functions for NextResponse
        "src/lib/seo.ts",    // Constant exports (env-dependent)
        "src/lib/jsonld.ts", // JSON-LD builders (SSR-only)
        "src/lib/utils.ts",  // Single re-export (cn)
        "src/lib/r2-client.ts", // AWS SDK integration glue (tested via E2E)
        "src/lib/mcp/server.ts", // Tool registration glue — handlers tested directly
        "src/lib/cache-handler.ts", // Next.js cache handler — runtime monitoring
        "src/models/types.ts", // Type-only file (no runtime)
        "src/i18n/**",         // i18n runtime — cookie/context glue (tested via E2E)
        "src/instrumentation.ts", // Node.js instrumentation — process-level monitoring
      ],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 90,
        statements: 90,
      },
    },
  },
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
      // Stub server-only to noop in test environment
      "server-only": new URL("./test/server-only-stub.ts", import.meta.url).pathname,
    },
  },
});
