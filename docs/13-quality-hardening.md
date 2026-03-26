# 13 — Quality Hardening: S-Tier Gaps Closure

> Harden the existing S-tier quality system by closing identified gaps in CI, lint-staged,
> security config, R2 test isolation, and pre-commit performance.
>
> Date: 2026-03-24
> Prerequisite: [07-quality-system-upgrade.md](./07-quality-system-upgrade.md) (completed)
> Current Tier: **S**
> Target: **S (hardened)** — close all audit-identified gaps
> **Status: ✅ Implemented in [17-quality-upgrade-l1l2l3g1g2.md](./17-quality-upgrade-l1l2l3g1g2.md) (2026-03-27)**

---

## Current State (Post-07 Upgrade)

All six dimensions are green. The system was rated S-tier in the 2026-03-24 global audit.

| Dimension | Status | Key Metric |
|-----------|--------|------------|
| L1 Unit | ✅ S | 32 test files, ~590 cases, ≥90% coverage gate, pre-commit |
| L2 API E2E | ✅ S | 7 test files, ~49 cases, 13/14 endpoints, pre-push |
| L3 Browser E2E | ✅ A | 4 spec files, ~20 tests, Playwright, manual trigger |
| G1 Static | ✅ S | `tseslint.configs.strict`, `--max-warnings=0`, `tsc --noEmit` |
| G2 Security | ✅ A | osv-scanner + gitleaks, pre-push, no custom config |
| D1 Isolation | ✅ S | `lizhengme-db-test`, `[env.test]`, auto-migration |

---

## Identified Gaps

| # | Gap | Risk | Impact |
|---|-----|------|--------|
| GAP-1 | **No lint-staged** — pre-commit runs typecheck + lint + test:coverage on entire project | Performance degrades as project grows; currently ~25s acceptable but will worsen | pre-commit slowdown |
| GAP-2 | **No `.gitleaks.toml`** — gitleaks uses default rules, no project-specific allowlist | False positives on test fixtures or known non-secret patterns cannot be suppressed | Developer friction |
| GAP-3 | **No CI pipeline** — all quality gates rely solely on local git hooks | `--no-verify` bypasses everything; no PR-level enforcement; no status checks | Single point of failure |
| GAP-4 | **No R2 test bucket** — `/api/upload` excluded from L2 scope | Upload flow only tested manually; regression risk on image pipeline | Incomplete L2 coverage |
| GAP-5 | **pre-commit runs `test:coverage`** instead of `test` — coverage enforcement on every commit is slow | ~15s overhead per commit for coverage instrumentation vs plain test run | Developer velocity |

---

## Step 1: Add lint-staged for Incremental Pre-commit

**Goal**: Pre-commit only lints/typechecks staged files instead of the entire project.

### 1.1 Install lint-staged

```bash
bun add -d lint-staged
```

### 1.2 Add lint-staged Config to `package.json`

```json
{
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --max-warnings=0"
    ]
  }
}
```

> **Note**: `tsc --noEmit` cannot run on individual files (it needs the full project context).
> Keep `tsc --noEmit` as a separate full-project step in pre-commit.
> lint-staged only optimizes the ESLint pass.

### 1.3 Update `.husky/pre-commit`

**File**: `.husky/pre-commit`

```bash
# === Quality Gate: pre-commit ===
# L1 Unit/Component + G1 Static Analysis
echo "▸ G1: typecheck"
bun run typecheck
echo "▸ G1: lint (staged)"
bunx lint-staged
echo "▸ L1: unit tests (coverage ≥90%)"
bun run test:coverage
```

### Files Modified

| File | Change |
|------|--------|
| `package.json` | Add `lint-staged` devDependency + `lint-staged` config |
| `.husky/pre-commit` | Replace `bun run lint` with `bunx lint-staged` |

### Atomic Commits

| # | Message |
|---|---------|
| 1 | `chore: add lint-staged for incremental pre-commit linting` |

---

## Step 2: Add `.gitleaks.toml` Project Config

**Goal**: Suppress known false positives and document allowlist rules.

### 2.1 Create `.gitleaks.toml`

**File**: `.gitleaks.toml` (project root)

```toml
title = "Firefly gitleaks config"

[allowlist]
  description = "Known non-secret patterns"

  # Test fixtures with fake API keys / tokens
  paths = [
    '''e2e/.*\.test\.ts$''',
    '''e2e/.*\.spec\.ts$''',
    '''\.env\.test$''',
    '''\.env\.example$''',
  ]

  # Specific commit SHAs that contain known-safe patterns
  # commits = []
```

### Files Modified

| File | Change |
|------|--------|
| `.gitleaks.toml` | New — project-level gitleaks config |

### Atomic Commits

| # | Message |
|---|---------|
| 2 | `chore: add .gitleaks.toml with project-specific allowlist` |

---

## Step 3: Add GitHub Actions CI Pipeline

**Goal**: Enforce quality gates on every PR and push to main. Local hooks remain the primary gate; CI is the safety net.

### 3.1 Create CI Workflow

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
      - name: Install security tools
        run: |
          # osv-scanner
          curl -fsSL https://github.com/google/osv-scanner/releases/latest/download/osv-scanner_linux_amd64 -o /usr/local/bin/osv-scanner
          chmod +x /usr/local/bin/osv-scanner
          # gitleaks
          curl -fsSL https://github.com/gitleaks/gitleaks/releases/latest/download/gitleaks_8.30.1_linux_x64.tar.gz | tar xz -C /usr/local/bin gitleaks

      - name: "G2: security scan"
        run: bun run security
```

> **Scope decision**: L2 (API E2E) and L3 (browser E2E) are excluded from CI.
> They require wrangler + local D1 + Cloudflare account credentials, which adds
> significant complexity for a personal project. Local pre-push hooks remain the L2 gate.
> L3 remains manual/on-demand.
>
> If L2 in CI becomes needed later, add a `wrangler` step with `CLOUDFLARE_API_TOKEN` secret.

### Files Modified

| File | Change |
|------|--------|
| `.github/workflows/quality.yml` | New — CI pipeline for G1 + L1 + G2 |

### Atomic Commits

| # | Message |
|---|---------|
| 3 | `feat: add GitHub Actions CI for G1+L1+G2 quality gates` |

---

## Step 4: Add R2 Test Bucket for Upload Isolation

**Goal**: Create `lizhengme-test` R2 bucket so `/api/upload` can be included in L2 coverage.

### 4.1 Create Test R2 Bucket

```bash
npx wrangler r2 bucket create lizhengme-test
```

### 4.2 Add R2 Test Binding to `worker/wrangler.toml`

```toml
[env.test]
name = "lizhengme-test"

[[env.test.d1_databases]]
binding = "DB"
database_name = "lizhengme-db-test"
database_id = "ae2356d2-bb21-45aa-9fb2-55184fcc7826"

[[env.test.r2_buckets]]
binding = "BUCKET"
bucket_name = "lizhengme-test"
```

### 4.3 Add Upload E2E Test

**File**: `e2e/api/upload.test.ts` (new)

Test the upload endpoint with a minimal test image (1x1 PNG). Verify:
- POST `/api/upload` with multipart form data → 200 + URL in response
- Uploaded file is accessible via returned URL
- Error cases: no file, invalid type, oversized

### 4.4 Update L2 Scope

With test R2 bucket, update coverage target from 13/14 to **14/14** endpoints.

### Files Modified

| File | Change |
|------|--------|
| `worker/wrangler.toml` | Add `[[env.test.r2_buckets]]` binding |
| `e2e/api/upload.test.ts` | New — upload endpoint L2 test |
| `docs/07-quality-system-upgrade.md` | Update scope from 13/14 to 14/14 |

### Atomic Commits

| # | Message |
|---|---------|
| 4 | `feat: add R2 test bucket binding for upload isolation` |
| 5 | `feat: add L2 E2E test for upload endpoint` |

---

## Step 5: Optimize Pre-commit Performance

**Goal**: Move coverage enforcement to pre-push; pre-commit runs plain `test` for speed.

### 5.1 Update `.husky/pre-commit`

```bash
# === Quality Gate: pre-commit ===
# L1 Unit/Component + G1 Static Analysis
echo "▸ G1: typecheck"
bun run typecheck
echo "▸ G1: lint (staged)"
bunx lint-staged
echo "▸ L1: unit tests"
bun run test
```

### 5.2 Update `.husky/pre-push`

```bash
# === Quality Gate: pre-push ===
# L1 Coverage + L2 Integration/API + G2 Security
echo "▸ L1: unit tests (coverage ≥90%)"
bun run test:coverage
echo "▸ G1: lint"
bun run lint
echo "▸ L2: API E2E"
bun run test:e2e:api
echo "▸ G2: security"
bun run security
```

> **Rationale**: `test:coverage` adds ~15s of V8 coverage instrumentation overhead.
> Running plain `test` on pre-commit keeps commits fast (<15s).
> Coverage enforcement moves to pre-push where the budget is <3min.

### Files Modified

| File | Change |
|------|--------|
| `.husky/pre-commit` | `test:coverage` → `test` |
| `.husky/pre-push` | `test` → `test:coverage` |

### Atomic Commits

| # | Message |
|---|---------|
| 6 | `chore: move coverage enforcement from pre-commit to pre-push` |

---

## Step 6: Update Documentation

**Goal**: Update doc 07 and this doc with final verification results.

### 6.1 Update `docs/07-quality-system-upgrade.md`

- Update L2 scope from "13/14 (upload excluded)" to "14/14 (all endpoints)"
- Add reference to this doc for hardening pass

### 6.2 Update `docs/README.md`

- Add entry for doc 13

### 6.3 Verification Checklist

| Dimension | Command | Pass Criteria |
|-----------|---------|---------------|
| L1 | `bun run test:coverage` | ≥90% all metrics, 0 failures |
| G1 | `bun run typecheck && bun run lint` | 0 errors, 0 warnings |
| L2 | `bun run test:e2e:api` | **14/14** endpoints, 0 failures |
| G2 | `bun run security` | 0 vulns, 0 leaks |
| L3 | `bun run test:e2e:browser` | Core journeys pass |
| D1 | wrangler.toml `[env.test]` | D1-test + R2-test both bound |
| CI | Push to main / open PR | GitHub Actions green |

### Files Modified

| File | Change |
|------|--------|
| `docs/07-quality-system-upgrade.md` | Update L2 scope, add hardening reference |
| `docs/13-quality-hardening.md` | Mark verification results |
| `docs/README.md` | Add doc 13 entry |

### Atomic Commits

| # | Message |
|---|---------|
| 7 | `docs: update quality docs with hardening results` |

---

## Complete Atomic Commit Sequence

| # | Type | Message | Gap |
|---|------|---------|-----|
| 1 | chore | `chore: add lint-staged for incremental pre-commit linting` | GAP-1 |
| 2 | chore | `chore: add .gitleaks.toml with project-specific allowlist` | GAP-2 |
| 3 | feat | `feat: add GitHub Actions CI for G1+L1+G2 quality gates` | GAP-3 |
| 4 | feat | `feat: add R2 test bucket binding for upload isolation` | GAP-4 |
| 5 | feat | `feat: add L2 E2E test for upload endpoint` | GAP-4 |
| 6 | chore | `chore: move coverage enforcement from pre-commit to pre-push` | GAP-5 |
| 7 | docs | `docs: update quality docs with hardening results` | All |

---

## Execution Order Rationale

1. **lint-staged first** — Immediate developer velocity win, low risk.
2. **gitleaks config** — Quick setup, removes future false-positive friction.
3. **CI pipeline** — Safety net must exist before relaxing local gates.
4. **R2 test bucket** — Enables full L2 coverage; depends on Cloudflare account.
5. **Pre-commit optimization** — Only safe to relax after CI is in place as backup.
6. **Documentation** — Capture final state after all changes.

---

## Risk Notes

- **lint-staged + tsc**: `tsc --noEmit` still runs on the full project (cannot scope to staged files). If typecheck becomes slow (>10s), consider moving it to pre-push alongside coverage.
- **CI runner cost**: GitHub Actions free tier provides 2,000 min/month. With ~2min per run, this supports ~1,000 pushes/month — more than sufficient for a personal project.
- **R2 test bucket cleanup**: E2E uploads accumulate in `lizhengme-test` bucket. Add periodic cleanup (e.g., `wrangler r2 object list lizhengme-test | ...`) or lifecycle rule if needed.
- **osv-scanner in CI**: The binary download URL in Step 3 may need version pinning for reproducibility. Consider using the official GitHub Action (`google/osv-scanner-action`) if available.
