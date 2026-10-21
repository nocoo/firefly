import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (file: string) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const dockerfile = source("Dockerfile");
const dockerignore = source(".dockerignore");
const config = source("next.config.ts");

const requestTimeEntries = [
  ["src/app/layout.tsx", 2],
  ["src/app/(blog)/layout.tsx", 1],
  ["src/app/(blog)/page.tsx", 2],
  ["src/app/(blog)/archive/page.tsx", 2],
  ["src/app/not-found.tsx", 1],
  ["src/app/sitemap.xml/route.ts", 1],
] as const;

describe("production container", () => {
  it("pins a shared Node 22 Debian base and the project's frozen Bun installer", () => {
    expect(dockerfile).toMatch(
      /FROM node:22\.\d+\.\d+-bookworm-slim@sha256:[a-f0-9]{64} AS base/,
    );
    expect(dockerfile).toMatch(/FROM oven\/bun:1\.2\.15@sha256:[a-f0-9]{64} AS bun/);
    expect(dockerfile).toContain("FROM base AS dependencies");
    expect(dockerfile).toContain("FROM base AS builder");
    expect(dockerfile).toContain("FROM base AS runner");
    expect(dockerfile).toContain("COPY package.json bun.lock ./");
    expect(dockerfile).toContain("RUN bun install --frozen-lockfile");
    expect(dockerfile).not.toMatch(/--(?:production|omit|ignore-scripts)|bun update|npm install/);
  });

  it("uses the native stable typecheck and webpack build without canary workarounds", () => {
    const pkg = JSON.parse(source("package.json"));
    expect(pkg.dependencies.next).toBe("16.4.2");
    expect(pkg.scripts.build).toBe("next typegen && tsc --noEmit && next build --webpack");
    expect(dockerfile).toContain("npm run build");
    expect(dockerfile).not.toMatch(/bun (?:--bun|run build)|ignoreBuildErrors|canary|NEXT_PRIVATE_/);
    expect(config).toMatch(/output:\s*"standalone"/);
  });

  it("requires only explicit public build configuration, never secrets or test switches", () => {
    expect([...dockerfile.matchAll(/^ARG (\w+)/gm)].map((match) => match[1])).toEqual([
      "AUTH_URL",
      "R2_PUBLIC_URL",
    ]);
    expect(dockerfile).toContain('test -n "$AUTH_URL" && test -n "$R2_PUBLIC_URL"');
    expect(dockerfile).not.toMatch(/SECRET|PASSWORD|TOKEN|WORKER_URL|AUTH_GOOGLE|AUTH_ALLOWED|E2E_|VITEST|CI=true/);
    expect(dockerfile).not.toMatch(/--mount=type=secret|COPY .*\.env|ARG \w+=/);
  });

  it("packages standalone, static and public assets for a non-root Node server", () => {
    expect(dockerfile).toContain("COPY --from=builder --chown=node:node /app/.next/standalone ./");
    expect(dockerfile).toContain("COPY --from=builder --chown=node:node /app/.next/static ./.next/static");
    expect(dockerfile).toContain("COPY --from=builder --chown=node:node /app/public ./public");
    expect(dockerfile).toContain("USER node");
    expect(dockerfile).toContain("PORT=7028");
    expect(dockerfile).toContain("HOSTNAME=0.0.0.0");
    expect(dockerfile).toContain('CMD ["node", "server.js"]');
    expect(dockerfile).toMatch(/USER node\s+RUN node -e "require\('sharp'\).*\.png\(\)\.toBuffer\(\)/);
  });

  it("allowlists build source without local environments, dependencies or deployment state", () => {
    const rules = dockerignore.trim().split("\n");
    expect(rules[0]).toBe("**");
    expect(rules.filter((rule) => rule.startsWith("!"))).toEqual([
      "!package.json",
      "!bun.lock",
      "!next.config.ts",
      "!tsconfig.json",
      "!postcss.config.mjs",
      "!src/",
      "!src/**",
      "!public/",
      "!public/**",
      "!scripts/",
      "!scripts/wechat-draft.ts",
      "!scripts/wechat-draft.test.ts",
    ]);
    expect(rules).toEqual(expect.arrayContaining([
      "**/.env*", "**/.dev.vars*", "**/*.pem", "**/*.key", "**/node_modules", "**/.wrangler",
    ]));
  });
});

describe("database-independent prerendering", () => {
  it.each(requestTimeEntries)("defers %s database access until a request", (file, count) => {
    const entry = source(file);
    expect(entry).toMatch(/import \{ connection \} from "next\/server"/);
    expect(entry.match(/await connection\(\);\s+const db = getDb\(\);/g)).toHaveLength(count);
    expect(entry.match(/getDb\(\)/g)).toHaveLength(count);
    expect(entry).not.toMatch(/force-dynamic|force-no-store|unstable_noStore|E2E_|WORKER_SECRET|\btry\s*\{/);
  });

  it("retains the explicit public cache, without route-wide cache overrides", () => {
    const entries = requestTimeEntries.map(([file]) => source(file)).join("\n");
    expect(entries + config).not.toMatch(/fetchCache\s*[:=]|revalidate\s*[:=]\s*0|cacheMaxMemorySize|cacheHandler/);
    const cache = source("src/data/core/public-cache.ts");
    expect(cache).toContain("unstable_cache(async () =>");
    expect(cache).toContain("revalidate: REVALIDATE_SECONDS");
    expect(cache).toContain('revalidateTag(TAG, { expire: 0 })');
    expect(source("src/app/sitemap.xml/route.ts")).toContain('"public, max-age=0, must-revalidate"');
  });

  it("leaves other database-backed GET exports request-time by native Next defaults", () => {
    for (const file of ["src/app/feed.xml/route.ts", "src/app/llms.txt/route.ts", "src/app/sitemap.xsl/route.ts"]) {
      const entry = source(file);
      expect(entry).not.toMatch(/export const (?:dynamic|revalidate)|generateStaticParams/);
    }
  });
});
