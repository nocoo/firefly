# 07 — Quality System Upgrade (L1+L2+L3+G1+G2)

> Upgrade firefly from Tier B to Tier S using the 6-dimensional quality system.
>
> Date: 2026-03-24
> Current Tier: ~~B~~ → **S** ✅ (upgraded 2026-03-24)
> Target Tier: **S** (L1+L2+L3+G1+G2+D1 all green)

---

## Current State Assessment

| Dimension | Status | Details |
|-----------|--------|---------|
| L1 Unit | ✅ | 241 tests, 97%+ coverage, vitest, pre-commit |
| G1 Static | ✅ | ESLint `strict`, `--max-warnings=0`, `tsc --noEmit` in pre-commit |
| L2 Integration | ✅ | 27 API E2E tests, 13/14 endpoints (upload excluded), 6 test files |
| G2 Security | ✅ | osv-scanner 0 vulns, gitleaks 0 leaks, pre-push |
| L3 System | ✅ | 15 Playwright specs (blog nav, SEO, admin, RSS), manual/CI |
| D1 Isolation | ✅ | `firefly-db-test` via worker `[env.test]`, `E2E_SKIP_AUTH` in proxy |

### API Endpoints to Cover (L2)

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/api/posts` | No | List published posts (public) |
| GET | `/api/posts/[slug]` | No | Get single post |
| POST | `/api/posts` | Yes | Create post |
| PUT | `/api/posts/[slug]` | Yes | Update post |
| DELETE | `/api/posts/[slug]` | Yes | Delete post |
| GET | `/api/categories` | No | List categories |
| GET | `/api/categories/[slug]` | No | Get category |
| GET | `/api/tags` | No | List tags |
| GET | `/api/tags/[slug]` | No | Get tag |
| GET | `/api/analytics` | Yes | Get analytics data |
| POST | `/api/analytics` | No | Track pageview |
| GET | `/api/settings` | Yes | Get site settings |
| PUT | `/api/settings` | Yes | Update settings |

> **Scope decision**: `/api/upload` (POST) is excluded from L2. It requires R2 and has no test
> bucket. Upload is covered by L3 admin flow (Playwright) or marked N/A if no test R2 exists.
> L2 coverage target: **13/14 endpoints** (all except upload). This is the binding pass criteria.

### Key Files to Modify

```
eslint.config.mjs              ← G1: upgrade to strict + max-warnings=0
package.json                   ← G1/G2/L2/L3: add scripts + devDependencies
.husky/pre-commit              ← G1: add tsc --noEmit + eslint
.husky/pre-push                ← G2: add security scan; L2: add e2e
src/proxy.ts                   ← D1: add E2E_SKIP_AUTH bypass for test env
vitest.config.ts               ← (no change, L1 already solid)
scripts/run-e2e.ts             ← L2: new — auto start/stop dev server + test D1
scripts/run-security.ts        ← G2: new — osv-scanner + gitleaks wrapper
e2e/playwright.config.ts       ← L3: new — Playwright config
e2e/*.spec.ts                  ← L3: new — browser E2E tests
worker/wrangler.toml           ← D1: add [env.test] with test database binding
```

---

## Step 1: G1 — Upgrade ESLint to Strict + Add tsc Gate

**Goal**: ESLint `tseslint.configs.strict` + `--max-warnings=0` + `tsc --noEmit` in pre-commit.

### 1.1 Upgrade ESLint Config

**File**: `eslint.config.mjs`

```diff
- ...tseslint.configs.recommended,
+ ...tseslint.configs.strict,
```

Add `no-restricted-syntax` to ban `.skip` / `.only` in all test files (both `*.test.ts` and `*.spec.ts`):

```javascript
{
  files: ["**/*.test.ts", "**/*.spec.ts"],
  rules: {
    "no-restricted-syntax": [
      "error",
      {
        selector: "CallExpression[callee.property.name='skip']",
        message: "Do not commit .skip tests",
      },
      {
        selector: "CallExpression[callee.property.name='only']",
        message: "Do not commit .only tests",
      },
    ],
  },
},
```

### 1.2 Add tsc + lint Scripts

**File**: `package.json` scripts

```json
{
  "typecheck": "tsc --noEmit",
  "lint": "eslint . --max-warnings=0",
  "lint:fix": "eslint . --fix --max-warnings=0"
}
```

### 1.3 Update pre-commit Hook

**File**: `.husky/pre-commit`

```bash
bun run typecheck
bun run lint
bun run test
```

### Atomic Commits

| # | Commit | Description |
|---|--------|-------------|
| 1 | `refactor: upgrade eslint to strict config` | Change `recommended` → `strict`, add `.skip/.only` ban, fix any new lint errors |
| 2 | `chore: add typecheck script and --max-warnings=0` | Add `typecheck` script, update `lint` script with `--max-warnings=0` |
| 3 | `chore: update pre-commit hook for G1 gate` | pre-commit = `typecheck` + `lint` + `test` |

---

## Step 2: G2 — Install Security Gate (osv-scanner + gitleaks)

**Goal**: pre-push runs `osv-scanner` (dependency CVEs) + `gitleaks` (secrets detection).

### 2.1 Create Security Script

**File**: `scripts/run-security.ts` (new)

```typescript
import { $ } from "bun";

async function main() {
  console.log("=== G2: Security Gate ===\n");

  // 1. osv-scanner — check bun.lock for known CVEs
  console.log("[G2] osv-scanner: checking dependencies...");
  try {
    await $`osv-scanner --lockfile=bun.lock`;
    console.log("[G2] osv-scanner: ✅ no vulnerabilities\n");
  } catch (e) {
    console.error("[G2] osv-scanner: ❌ vulnerabilities found\n");
    process.exit(1);
  }

  // 2. gitleaks — check for secrets in commits since upstream
  console.log("[G2] gitleaks: checking for secrets...");
  try {
    const upstream = await $`git rev-parse --abbrev-ref @{upstream}`.text();
    const range = `${upstream.trim()}..HEAD`;
    await $`gitleaks git --log-opts=${range} --no-banner`;
    console.log("[G2] gitleaks: ✅ no leaks\n");
  } catch (e) {
    // If no upstream, scan all staged
    try {
      await $`gitleaks git --no-banner`;
      console.log("[G2] gitleaks: ✅ no leaks\n");
    } catch {
      console.error("[G2] gitleaks: ❌ secrets detected\n");
      process.exit(1);
    }
  }

  console.log("=== G2: All checks passed ===");
}

main();
```

### 2.2 Add Script to package.json

```json
{
  "security": "bun scripts/run-security.ts"
}
```

### 2.3 Update pre-push Hook

**File**: `.husky/pre-push`

```bash
bun run test
bun run lint
bun run security
```

### Prerequisites (installed globally)

```bash
# osv-scanner v2+ (supports bun.lock)
brew install osv-scanner

# gitleaks
brew install gitleaks
```

### Atomic Commits

| # | Commit | Description |
|---|--------|-------------|
| 4 | `feat: add G2 security gate script` | Create `scripts/run-security.ts` with osv-scanner + gitleaks |
| 5 | `chore: update pre-push hook for G2 gate` | pre-push = `test` + `lint` + `security` |

---

## Step 3: D1 — Test Resource Isolation

**Goal**: Worker has `[env.test]` binding to `firefly-db-test`. E2E scripts connect to test DB only.

### 3.1 Add Test Environment to Worker

**File**: `worker/wrangler.toml`

```toml
[env.test]
name = "firefly-test"

[[env.test.d1_databases]]
binding = "DB"
database_name = "firefly-db-test"
database_id = "ae2356d2-xxxx"  # from CF_D1_TEST_DATABASE_ID in .env
```

### 3.2 Implement E2E_SKIP_AUTH Bypass in Proxy

**File**: `src/proxy.ts`

The current proxy has no auth bypass mechanism. L2/L3 tests cannot reach auth-gated endpoints
(POST/PUT/DELETE, GET `/api/analytics`, GET/PUT `/api/settings`) without this.

Add at the top of the auth guard block in `proxy()`:

```typescript
// E2E auth bypass — only active when E2E_SKIP_AUTH is explicitly set
if (process.env.E2E_SKIP_AUTH === "true") {
  return NextResponse.next();
}
```

This goes inside the `if (isProtectedRoute || isProtectedApiRoute)` branch, **before** `auth()` is called.

**Safety constraints**:
- Only reads `process.env.E2E_SKIP_AUTH` — never set in production `.env`
- `.env.test` sets it; production Railway deployment has no such var
- The bypass skips auth entirely — acceptable for single-user personal blog

### 3.3 Create Test Environment File

**File**: `.env.test` (new, gitignored)

```bash
# Test environment — points to firefly-db-test via test worker
WORKER_URL=http://localhost:8787  # local wrangler dev --env test
WORKER_SECRET=test-secret
E2E_SKIP_AUTH=true
```

### 3.4 Apply Schema to Test DB Using Existing Migration Script

The project already has `scripts/migrations/apply-migration.ts` which supports `--test` flag
to target `firefly-db-test` via `CF_D1_TEST_DATABASE_ID`. No new script needed.

**Workflow**: before first L2 run, apply all migrations to test DB:

```bash
# Apply schema to test database (uses CF_D1_TEST_DATABASE_ID from .env)
bun scripts/migrations/apply-migration.ts scripts/migrations/schema.sql --test
```

The `run-e2e.ts` script (Step 4) will document this as a prerequisite and verify test DB
connectivity before running tests.

### Atomic Commits

| # | Commit | Description |
|---|--------|-------------|
| 6 | `feat: add D1 test environment to worker config` | `[env.test]` binding in `worker/wrangler.toml` |
| 7 | `feat: add E2E_SKIP_AUTH bypass to proxy` | Auth bypass in `src/proxy.ts`, `.env.test` with test worker config |

---

## Step 4: L2 — Integration/API E2E Tests

**Goal**: 13/14 API endpoints covered with real HTTP calls against `firefly-db-test` (upload excluded, see scope decision above).

### 4.1 Create E2E Runner

**File**: `scripts/run-e2e.ts` (new)

```typescript
// 1. Start local worker with --env test on port 18787
// 2. Start Next.js dev server on port 17028 (E2E port = 10000 + 7028)
//    with WORKER_URL=http://localhost:18787
// 3. Run vitest on e2e/api/ directory
// 4. Tear down both servers
```

Port convention:
- Dev server: `7028`
- API E2E: `17028` (10000 + dev)
- BDD E2E: `27028` (20000 + dev)

### 4.2 Create API E2E Tests

**Directory**: `e2e/api/` (new)

| Test File | Endpoints | Tests |
|-----------|-----------|-------|
| `posts.test.ts` | GET/POST/PUT/DELETE `/api/posts`, GET `/api/posts/[slug]` | List, get, create, update, delete, 404 |
| `categories.test.ts` | GET `/api/categories`, GET `/api/categories/[slug]` | List, get, 404 |
| `tags.test.ts` | GET `/api/tags`, GET `/api/tags/[slug]` | List, get, 404 |
| `analytics.test.ts` | GET/POST `/api/analytics` | Track pageview, get stats |
| `settings.test.ts` | GET/PUT `/api/settings` | Get, update |
| `auth.test.ts` | Auth-gated endpoints | Auth bypass verification, read-only public access |

### 4.3 E2E Vitest Config

**File**: `e2e/vitest.config.ts` (new)

Separate vitest config for E2E tests — no coverage thresholds, longer timeouts. Loads `.env.test` via `dotenv` (which sets `E2E_SKIP_AUTH=true` + test worker URL).

### 4.4 Add Script

```json
{
  "test:e2e": "bun scripts/run-e2e.ts",
  "test:e2e:api": "bun scripts/run-e2e.ts --api-only"
}
```

### 4.5 Update pre-push Hook

**File**: `.husky/pre-push`

```bash
bun run test
bun run lint
bun run test:e2e:api
bun run security
```

### Atomic Commits

| # | Commit | Description |
|---|--------|-------------|
| 8 | `feat: add E2E runner script with auto server lifecycle` | `scripts/run-e2e.ts` — start worker + Next.js, run tests, tear down |
| 9 | `feat: add L2 API E2E tests for posts endpoints` | `e2e/api/posts.test.ts` — CRUD + 404 |
| 10 | `feat: add L2 API E2E tests for categories and tags` | `e2e/api/categories.test.ts` + `e2e/api/tags.test.ts` |
| 11 | `feat: add L2 API E2E tests for analytics, settings, auth` | `e2e/api/analytics.test.ts` + `settings.test.ts` + `auth.test.ts` |
| 12 | `chore: update pre-push hook to include L2 gate` | pre-push = `test` + `lint` + `test:e2e:api` + `security` |

---

## Step 5: L3 — System/E2E with Playwright

**Goal**: Browser-based E2E for core user journeys.

### 5.1 Install Playwright

```bash
bun add -d @playwright/test
bunx playwright install chromium
```

### 5.2 Playwright Config

**File**: `e2e/playwright.config.ts` (new)

```typescript
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./browser",
  baseURL: process.env.E2E_BASE_URL ?? "http://localhost:27028",
  use: {
    headless: true,
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
```

### 5.3 Create Browser E2E Tests

**Directory**: `e2e/browser/` (new)

| Test File | Journey | Tests |
|-----------|---------|-------|
| `blog-navigation.spec.ts` | Public blog browsing | Home → post → category → tag → pagination |
| `admin-posts.spec.ts` | Admin post management | Login → list → create → edit → delete |
| `seo-meta.spec.ts` | SEO verification | Check meta tags, JSON-LD, OG tags, sitemap |
| `rss-feed.spec.ts` | RSS feed validation | `/feed.xml` returns valid RSS |

### 5.4 Add Script

```json
{
  "test:e2e:browser": "bun scripts/run-e2e.ts --browser-only"
}
```

### Atomic Commits

| # | Commit | Description |
|---|--------|-------------|
| 13 | `feat: add Playwright config and browser E2E infrastructure` | `e2e/playwright.config.ts` + install |
| 14 | `feat: add L3 blog navigation and SEO E2E tests` | `e2e/browser/blog-navigation.spec.ts` + `seo-meta.spec.ts` |
| 15 | `feat: add L3 admin post management E2E tests` | `e2e/browser/admin-posts.spec.ts` |
| 16 | `feat: add L3 RSS feed E2E test` | `e2e/browser/rss-feed.spec.ts` |

---

## Step 6: Finalize — Hook Labels + Verification

**Goal**: Update hook comments, verify all 6 dimensions, document results.

### 6.1 Final Hook Layout

**`.husky/pre-commit`** (<30s):
```bash
# === Quality Gate: pre-commit ===
# L1 Unit/Component + G1 Static Analysis
echo "▸ G1: typecheck"
bun run typecheck
echo "▸ G1: lint"
bun run lint
echo "▸ L1: unit tests"
bun run test
```

**`.husky/pre-push`** (<3min):
```bash
# === Quality Gate: pre-push ===
# L2 Integration/API + G2 Security
echo "▸ L1: unit tests"
bun run test
echo "▸ G1: lint"
bun run lint
echo "▸ L2: API E2E"
bun run test:e2e:api
echo "▸ G2: security"
bun run security
```

**Manual/CI**: L3 Playwright
```bash
bun run test:e2e:browser
```

### 6.2 Verification Checklist

| Dimension | Command | Pass Criteria |
|-----------|---------|---------------|
| L1 | `bun run test:coverage` | ≥90% all metrics, 0 failures |
| G1 | `bun run typecheck && bun run lint` | 0 errors, 0 warnings |
| L2 | `bun run test:e2e:api` | 13/14 endpoints covered (upload excluded), 0 failures |
| G2 | `bun run security` | osv-scanner 0 vulns, gitleaks no leaks |
| L3 | `bun run test:e2e:browser` | Core journeys pass |
| D1 | Worker `[env.test]` + `.env.test` | E2E uses `firefly-db-test` only |

### Atomic Commits

| # | Commit | Description |
|---|--------|-------------|
| 17 | `chore: finalize hook labels and comments` | Update `.husky/pre-commit` + `.husky/pre-push` with dimension labels |
| 18 | `docs: update architecture doc with quality verification results` | Update `docs/03-architecture.md` Quality section with actual results |

---

## Complete Atomic Commit Sequence

| # | Type | Message | Dimension |
|---|------|---------|-----------|
| 1 | refactor | `refactor: upgrade eslint to strict config` | G1 |
| 2 | chore | `chore: add typecheck script and --max-warnings=0` | G1 |
| 3 | chore | `chore: update pre-commit hook for G1 gate` | G1 |
| 4 | feat | `feat: add G2 security gate script` | G2 |
| 5 | chore | `chore: update pre-push hook for G2 gate` | G2 |
| 6 | feat | `feat: add D1 test environment to worker config` | D1 |
| 7 | feat | `feat: add E2E_SKIP_AUTH bypass to proxy` | D1 |
| 8 | feat | `feat: add E2E runner script with auto server lifecycle` | L2 |
| 9 | feat | `feat: add L2 API E2E tests for posts endpoints` | L2 |
| 10 | feat | `feat: add L2 API E2E tests for categories and tags` | L2 |
| 11 | feat | `feat: add L2 API E2E tests for analytics, settings, auth` | L2 |
| 12 | chore | `chore: update pre-push hook to include L2 gate` | L2 |
| 13 | feat | `feat: add Playwright config and browser E2E infrastructure` | L3 |
| 14 | feat | `feat: add L3 blog navigation and SEO E2E tests` | L3 |
| 15 | feat | `feat: add L3 admin post management E2E tests` | L3 |
| 16 | feat | `feat: add L3 RSS feed E2E test` | L3 |
| 17 | chore | `chore: finalize hook labels and comments` | All |
| 18 | docs | `docs: update architecture doc with quality verification results` | All |

---

## Execution Order Rationale

1. **G1 first** — Static analysis catches type errors and lint issues immediately. Enables subsequent development to be lint-clean from the start.
2. **G2 next** — Security gate is fast to install (15min) and provides immediate protection.
3. **D1 before L2** — Test isolation must be in place before writing integration tests that hit the database.
4. **L2 before L3** — API tests are the backbone of integration testing; browser tests build on top.
5. **L3 last** — Playwright requires the most setup and benefits from all prior infrastructure.
6. **Finalize** — Clean up hooks, verify all dimensions, update documentation.

---

## Risk Notes

- **osv-scanner v2+ required** — v1 does not support `bun.lock`. Verify with `osv-scanner --version`.
- **Worker test deployment** — `wrangler dev --env test` binds to local D1 test instance. Run `bun scripts/migrations/apply-migration.ts scripts/migrations/schema.sql --test` before first L2 run.
- **R2 test bucket** — No separate R2 test bucket exists. Upload endpoint is excluded from L2 scope (tested only through L3 admin flow if Playwright is configured with a mock upload, or marked N/A).
- **CI pipeline** — No GitHub Actions yet. L3 is manual/CI trigger. Consider adding `.github/workflows/quality.yml` in a future pass.
