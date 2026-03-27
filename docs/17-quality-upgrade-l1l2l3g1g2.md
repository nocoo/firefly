# 17 — Quality System Upgrade: S-Tier Hardening (L1+L2+L3+G1+G2)

> Close all remaining gaps from doc 13 (S-Tier Gaps Closure) and further harden
> the 6-dimensional quality system for long-term maintainability.
>
> Date: 2026-03-27
> Prerequisite: [07-quality-system-upgrade.md](./07-quality-system-upgrade.md) (completed),
>              [13-quality-hardening.md](./13-quality-hardening.md) (design only, not implemented)
> Current Tier: **S** (six dimensions green, but 5 known gaps open) → **S (hardened)** ✅
> Target: **S (hardened)** — all gaps closed, CI safety net in place

---

## Current State Assessment

Post doc-07 upgrade, firefly is S-tier with all 6 dimensions green. However, doc-13 identified
5 gaps that remain **unimplemented** as of 2026-03-27:

| Dimension | Status | Key Metric |
|-----------|--------|------------|
| L1 Unit | ✅ S | 42+ test files, ≥90% coverage gate, pre-commit |
| L2 API E2E | ✅ S | 11 API test files, 13/14 endpoints (upload excluded) |
| L3 Browser E2E | ✅ A | 4 Playwright specs, manual trigger |
| G1 Static | ✅ S | `tseslint.configs.strict`, `--max-warnings=0`, `tsc --noEmit` |
| G2 Security | ✅ A | osv-scanner + gitleaks, pre-push, no project-specific config |
| D1 Isolation | ✅ S | `firefly-db-test`, `[env.test]`, auto-migration |

### Open Gaps (from doc 13, unimplemented)

| # | Gap | Risk | Priority |
|---|-----|------|----------|
| GAP-1 | No lint-staged — pre-commit runs full-project lint | Performance degrades as codebase grows | P2 |
| GAP-2 | No `.gitleaks.toml` — default rules, no project allowlist | False positives cause friction | P3 |
| GAP-3 | No CI pipeline — all gates rely on local hooks only | `--no-verify` bypasses everything | P1 |
| GAP-4 | No R2 test bucket — `/api/upload` excluded from L2 | Upload regression risk | P3 |
| GAP-5 | pre-commit runs `test:coverage` — 15s overhead per commit | Developer velocity hit | P2 |

### Pre-commit Performance Baseline

Current pre-commit hook runs:
```
typecheck → lint (full project) → test:coverage (with V8 instrumentation)
```
Estimated: ~25-30s per commit. Target after optimization: <15s.

---

## Implementation Plan

### Execution order rationale:
1. **GAP-5 first** — Immediate velocity win, zero risk, no new dependencies
2. **GAP-1 next** — Builds on GAP-5 to further optimize pre-commit
3. **GAP-2** — Quick config file, removes future false-positive friction
4. **GAP-3** — CI pipeline as safety net (must exist before we can rely less on local hooks)
5. **GAP-4 last** — R2 bucket requires Cloudflare account action, lowest priority

---

## Step 1: GAP-5 — Optimize Pre-commit Performance ✅

**Goal**: Move `test:coverage` to pre-push; pre-commit runs plain `test` for speed.

### 1.1 Update `.husky/pre-commit`

**File**: `.husky/pre-commit`

```bash
# === Quality Gate: pre-commit ===
# G1 Static Analysis + L1 Unit Tests
echo "▸ G1: typecheck"
bun run typecheck
echo "▸ G1: lint"
bun run lint
echo "▸ L1: unit tests"
bun run test
```

### 1.2 Update `.husky/pre-push`

**File**: `.husky/pre-push`

```bash
# === Quality Gate: pre-push ===
# L1 Coverage + G1 Lint + L2 Integration + G2 Security
echo "▸ L1: unit tests (coverage ≥90%)"
bun run test:coverage
echo "▸ G1: lint"
bun run lint
echo "▸ L2: API E2E"
bun run test:e2e:api
echo "▸ G2: security"
bun run security
```

> **Rationale**: `test:coverage` adds ~15s of V8 instrumentation overhead.
> Plain `test` in pre-commit keeps commits fast (<15s). Coverage enforcement
> moves to pre-push where the budget is <3min. CI (Step 4) provides the
> ultimate safety net for coverage.

### Files Modified

| File | Change |
|------|--------|
| `.husky/pre-commit` | `test:coverage` → `test` |
| `.husky/pre-push` | `test` → `test:coverage` (first step) |

### Atomic Commit

| # | Message |
|---|---------|
| 1 | `perf: move coverage enforcement from pre-commit to pre-push` |

---

## Step 2: GAP-1 — Add lint-staged for Incremental Pre-commit Linting ✅

**Goal**: Pre-commit only lints staged files instead of the entire project.

### 2.1 Install lint-staged

```bash
bun add -d lint-staged
```

### 2.2 Add lint-staged Config to `package.json`

```json
{
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --max-warnings=0"
    ]
  }
}
```

> **Note**: `tsc --noEmit` cannot run on individual files (needs full project context).
> Keep `tsc --noEmit` as a separate full-project step in pre-commit.
> lint-staged only optimizes the ESLint pass.

### 2.3 Update `.husky/pre-commit`

**File**: `.husky/pre-commit`

```bash
# === Quality Gate: pre-commit ===
# G1 Static Analysis + L1 Unit Tests
echo "▸ G1: typecheck"
bun run typecheck
echo "▸ G1: lint (staged files)"
bunx lint-staged
echo "▸ L1: unit tests"
bun run test
```

### Files Modified

| File | Change |
|------|--------|
| `package.json` | Add `lint-staged` devDependency + config |
| `.husky/pre-commit` | `bun run lint` → `bunx lint-staged` |

### Atomic Commit

| # | Message |
|---|---------|
| 2 | `perf: add lint-staged for incremental pre-commit linting` |

---

## Step 3: GAP-2 — Add `.gitleaks.toml` Project Config ✅

**Goal**: Suppress known false positives with project-specific allowlist.

### 3.1 Create `.gitleaks.toml`

**File**: `.gitleaks.toml` (project root)

```toml
title = "Firefly gitleaks config"

[allowlist]
  description = "Known non-secret patterns in test fixtures"

  # Test fixtures with fake API keys / tokens
  paths = [
    '''e2e/.*\.test\.ts$''',
    '''e2e/.*\.spec\.ts$''',
    '''\.env\.test$''',
    '''\.env\.example$''',
  ]
```

### 3.2 Verify Security Script Uses Config

**File**: `scripts/run-security.ts` — verify gitleaks invocation picks up `.gitleaks.toml`
automatically (gitleaks auto-detects config file in project root, no flag needed).

### Files Modified

| File | Change |
|------|--------|
| `.gitleaks.toml` | New — project-level gitleaks config |

### Atomic Commit

| # | Message |
|---|---------|
| 3 | `chore: add .gitleaks.toml with project-specific allowlist` |

---

## Step 4: GAP-3 — Add GitHub Actions CI Pipeline ✅

**Goal**: Enforce G1 + L1 + G2 on every push/PR to main. Local hooks remain
primary; CI is the safety net against `--no-verify`.

### 4.1 Create CI Workflow

**File**: `.github/workflows/quality.yml`

```yaml
name: Quality Gate
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

concurrency:
  group: quality-${{ github.ref }}
  cancel-in-progress: true

jobs:
  quality:
    runs-on: ubuntu-latest
    timeout-minutes: 10

    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - name: Install dependencies
        run: bun install --frozen-lockfile

      # G1: Static Analysis
      - name: "G1: typecheck"
        run: bun run typecheck

      - name: "G1: lint"
        run: bun run lint

      # L1: Unit Tests with coverage
      - name: "L1: unit tests (coverage ≥90%)"
        run: bun run test:coverage

      # G2: Security
      - name: Install osv-scanner
        uses: google/osv-scanner-action/osv-scanner-action@v2
        continue-on-error: true
        id: osv-install

      - name: Install gitleaks
        run: |
          curl -fsSL https://github.com/gitleaks/gitleaks/releases/download/v8.24.3/gitleaks_8.24.3_linux_x64.tar.gz \
            | tar xz -C /usr/local/bin gitleaks
          chmod +x /usr/local/bin/gitleaks

      - name: "G2: security scan"
        run: bun run security
```

> **Scope decision**: L2 (API E2E) and L3 (browser E2E) are excluded from CI.
> They require wrangler + local D1 + Cloudflare account credentials.
> Local pre-push hooks remain the L2 gate. L3 remains manual/on-demand.

### 4.2 Create `.github/` Directory

```bash
mkdir -p .github/workflows
```

### Files Modified

| File | Change |
|------|--------|
| `.github/workflows/quality.yml` | New — CI pipeline for G1 + L1 + G2 |

### Atomic Commit

| # | Message |
|---|---------|
| 4 | `feat: add GitHub Actions CI for G1+L1+G2 quality gates` |

---

## Step 5: GAP-4 — Add R2 Test Bucket for Upload Isolation ✅

**Goal**: Create `firefly-test` R2 bucket binding so `/api/upload` can be
included in L2 coverage (14/14 endpoints).

### 5.1 Create Test R2 Bucket (manual Cloudflare action)

```bash
npx wrangler r2 bucket create firefly-test
```

### 5.2 Add R2 Test Binding to `worker/wrangler.toml`

Add to existing `[env.test]` section:

```toml
[[env.test.r2_buckets]]
binding = "BUCKET"
bucket_name = "firefly-test"
```

### 5.3 Add Upload E2E Test

**File**: `e2e/api/upload.test.ts` (new)

Test cases:
- POST `/api/upload` with multipart form data (1x1 PNG) → 200 + URL
- Error: no file → 400
- Error: invalid MIME type → 400
- Verify uploaded file accessible via returned URL

### 5.4 Update L2 Scope Documentation

Update `docs/07-quality-system-upgrade.md` scope from 13/14 to **14/14 endpoints**.

### Files Modified

| File | Change |
|------|--------|
| `worker/wrangler.toml` | Add `[[env.test.r2_buckets]]` |
| `e2e/api/upload.test.ts` | New — upload endpoint L2 test |
| `docs/07-quality-system-upgrade.md` | Update L2 scope to 14/14 |

### Atomic Commits

| # | Message |
|---|---------|
| 5 | `feat: add R2 test bucket binding for upload isolation` |
| 6 | `feat: add L2 E2E test for upload endpoint` |

---

## Step 6: Finalize — Documentation & Verification ✅

**Goal**: Verify all 6 dimensions, update documentation, mark doc 13 complete.

### 6.1 Verification Checklist

| Dimension | Command | Pass Criteria |
|-----------|---------|---------------|
| L1 | `bun run test:coverage` | ≥90% all metrics, 0 failures |
| G1 | `bun run typecheck && bun run lint` | 0 errors, 0 warnings |
| L2 | `bun run test:e2e:api` | **14/14** endpoints, 0 failures |
| G2 | `bun run security` | osv-scanner 0 vulns, gitleaks 0 leaks |
| L3 | `bun run test:e2e:browser` | Core journeys pass |
| D1 | wrangler.toml `[env.test]` | D1-test + R2-test both bound |
| CI | Push to main / open PR | GitHub Actions green |

### 6.2 Final Hook Layout

**`.husky/pre-commit`** (target: <15s):
```
G1: typecheck → G1: lint (staged) → L1: unit tests (no coverage)
```

**`.husky/pre-push`** (target: <3min):
```
L1: coverage ≥90% → G1: lint → L2: API E2E → G2: security
```

**Manual/CI**: L3 Playwright
```
bun run test:e2e:browser
```

### 6.3 Update Documentation

| File | Change |
|------|--------|
| `docs/13-quality-hardening.md` | Mark all steps as implemented, update status header |
| `docs/07-quality-system-upgrade.md` | Update L2 scope, add references to doc 13 & 17 |
| `docs/README.md` | Add entry for doc 17 |

### Atomic Commits

| # | Message |
|---|---------|
| 7 | `docs: finalize quality hardening with verification results` |

---

## Complete Atomic Commit Sequence

| # | Type | Message | Gap | Est. Time |
|---|------|---------|-----|-----------|
| 1 | perf | `perf: move coverage enforcement from pre-commit to pre-push` | GAP-5 | 5 min |
| 2 | perf | `perf: add lint-staged for incremental pre-commit linting` | GAP-1 | 10 min |
| 3 | chore | `chore: add .gitleaks.toml with project-specific allowlist` | GAP-2 | 5 min |
| 4 | feat | `feat: add GitHub Actions CI for G1+L1+G2 quality gates` | GAP-3 | 15 min |
| 5 | feat | `feat: add R2 test bucket binding for upload isolation` | GAP-4 | 10 min |
| 6 | feat | `feat: add L2 E2E test for upload endpoint` | GAP-4 | 20 min |
| 7 | docs | `docs: finalize quality hardening with verification results` | All | 10 min |

**Total estimated time: ~75 min**

---

## Execution Order Rationale

1. **GAP-5 first** — Zero-risk performance fix; immediate benefit on every commit.
2. **GAP-1 next** — Compounds with GAP-5 to cut pre-commit from ~30s to <15s.
3. **GAP-2** — Quick config file (5 min), prevents future gitleaks friction.
4. **GAP-3** — CI must be in place as safety net before further relaxations.
5. **GAP-4 last** — Requires Cloudflare account action (R2 bucket creation),
   lowest risk since upload is already covered by L3 admin flow.
6. **Finalize** — Document everything after all changes land.

---

## Risk Notes

- **lint-staged + tsc**: `tsc --noEmit` still runs on full project (cannot scope to staged files).
  If typecheck exceeds 10s in the future, consider moving to pre-push alongside coverage.
- **CI runner cost**: GitHub Actions free tier = 2,000 min/month. At ~2min per run,
  supports ~1,000 pushes/month — more than sufficient for a personal project.
- **R2 test bucket cleanup**: Uploads accumulate in `firefly-test` bucket over time.
  Add lifecycle rule or periodic cleanup if storage grows.
- **osv-scanner-action**: Using official Google action in CI instead of manual binary download
  for better version management and reproducibility.
- **lint-staged with Bun**: `bunx lint-staged` should work. If issues arise, fall back
  to `npx lint-staged` or add as a `package.json` script.

---

## Dependency Graph

```
GAP-5 (pre-commit perf)
  └─→ GAP-1 (lint-staged)    ← builds on simplified pre-commit
        └─→ GAP-3 (CI)       ← safety net must exist before relaxing local gates

GAP-2 (.gitleaks.toml)       ← independent, can run in parallel with GAP-5/1

GAP-4 (R2 test bucket)       ← independent, requires Cloudflare account action
  └─→ Step 6 (docs)          ← capture final state after all changes
```
