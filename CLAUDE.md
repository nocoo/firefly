# Firefly

Personal blog and administration platform with Next.js, a Cloudflare D1 Worker and R2 media.
Profile: ts-worker-web.
Direction: [development guide](docs/31-development.md), [architecture](docs/03-architecture.md).

## Sources of Truth

This handbook is the contract; hooks, CI and config are enforcement. Raise weaker enforcement to the contract rather than lowering requirements. Frameworks must not replace this file.

| Fact | Where |
| --- | --- |
| Human docs | [README.md](README.md), [docs/README.md](docs/README.md) |
| Version | Root `package.json`, release script |
| Enforcement | `.husky/`, `.github/workflows/ci.yml`, root/Worker Vitest configs |
| Environment | Ignored `.env`; tracked `.env.example` |
| Accidents | [Retrospective.md](Retrospective.md) |

## Project Invariants

- Deploy the Next.js application on Railway; the D1 Worker and migrations are separate operations. Preserve Google login and the administrator email allowlist.
- `src/data/core/` owns SQL/cache/timestamp primitives; entities are pure CRUD, services orchestrate side effects. A primary failure throws; secondary/post-write hooks log failures without rollback (D6).
- Entity inputs are camelCase; database columns and external MCP/REST fields are snake_case. Map only at boundaries through entity/route hooks.
- MCP framework/entity configs retain `afterGet`, best-effort `afterCreate`/`afterUpdate`, `mapCreateInput` and `mapUpdateInput`. Reuse `createMockDb()` from `@/data/core/test-utils`.
- Preserve original upload filenames for display/search; UUIDs belong in R2 keys. Preserve FTS query syntax and validate pagination before SQL.
- Worker migrations involving connection-scoped PRAGMAs use the existing `-- @batch` handling. Never revive retired remote test D1 procedures.
- Keep admin/full and restricted-author MCP scopes separate; author-created posts remain private until an administrator publishes them.

## Stack / Layout

| Component | Choice |
| --- | --- |
| Web | Next.js/React, TypeScript 7.0.2; `src/app/`, `src/components/` |
| Data | `src/data/`, `src/services/`, `worker/src/`, D1 and R2 |
| Tooling | Bun, Biome 2.5, oxc custom gates, Vitest/Playwright |
| Migrations | `scripts/migrations/`; historical WordPress work in `archive/` |

MVVM: keep ViewModels independent of Views/DOM; routes remain thin. Next's native-preview compatibility is intentional: build still runs stable `tsc` before Webpack. See [tooling](docs/26-biome-migration-ts7.md).

## Commands

Run from root; install root and Worker packages separately. Node 22+ is needed; current CI pins Bun 1.2.15.

```sh
bun install --frozen-lockfile
bun install --cwd worker --frozen-lockfile
bun run dev
bun run typecheck
bun run lint
bun run build
bun run test:coverage
bun run test:worker:coverage
bun run test:e2e:api
bun run test:e2e:browser
bun run security
```

Follow README for local Worker startup on 8787 before `bun run migrate:local`. Web dev uses 7028. Names required for normal login: `AUTH_SECRET`, `AUTH_URL`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_ALLOWED_EMAILS`; Worker connection uses `WORKER_URL`/`WORKER_SECRET`. Ordinary dev uploads use configured R2; E2E uses the local file adapter. Install Chromium with `bunx playwright install chromium`. CI supplies `AUTH_SECRET`/`AUTH_ALLOWED_EMAILS`; never copy production secrets into fixtures.

## Verification

6DQ = L1/L2/L3 + G1/G2 + D1. Status: `enforced`, `planned`, `manual`, `N/A`. L1 requires each of statements/branches/functions/lines ≥95%; no `.skip`/`.only`.

| Piece | Requirement and current reality | Status | Evidence |
| --- | --- | --- | --- |
| L1 Web | Four metrics ≥95% for configured non-View TypeScript | enforced | Root Vitest thresholds; pre-push/CI coverage |
| L1 Worker | Four metrics ≥95%; coverage command exists but CI runs plain tests | planned | `worker/vitest.config.ts`; CI `worker-tests` omits coverage |
| L2 | Real HTTP, 100% endpoint/method coverage, real SQL | planned | API runner enforced in CI; complete surface proof/isolated lane remains a gap |
| L3 | Critical blog/admin journeys | enforced | CI browser job → `test:e2e:browser` / Playwright |
| G1 | Both type lanes, zero-error/warning Biome and AST/skip gates | enforced | `lint`, pre-push/CI; custom gates use index snapshots in pre-commit |
| G2 | OSV + gitleaks, missing scanner fails; both lockfiles | planned | Root security script scans only root Bun lock; Worker lock coverage missing there |
| D1 | Dedicated per-run local D1/R2 with guards/marker | enforced | Runner creates fresh local state, a zero-UUID binding and `_test_marker`, checks ports and supplies synthetic credentials |
| Build | `tsc --noEmit && next build --webpack` | manual | Manifest; run for bundler/runtime changes |
| Docs | Commands, migrations and contracts kept current | manual | Review linked guides |

Current pre-commit skips heavy gates for docs, otherwise runs lint-staged before worktree tests/types; only custom gates use the index. Pre-push runs root coverage/lint/security, despite a stale comment claiming Worker coverage. Its secret range uses upstream, not stdin push refs. Target: check-only full index L1/G1 <30s; pushed-ref L2/G2 in parallel <3min. Never bypass commit/branch-push hooks; remove autofix from future gate design.

## Resources / Isolation

| Purpose | Ports / state | Current behavior |
| --- | --- | --- |
| Dev | Web 7028, local Worker 8787 | Can use real configured R2 |
| L2 | Web 17028, Worker 8787 | Fresh `worker/.wrangler/e2e-<random>/` D1/R2 state; cache proofs run after API mutations |
| L3 | Web 27028, Worker 8787 | Own per-run state; ports remain shared, never run alongside another runner or dev Worker |

Use per-run local Wrangler/Miniflare SQLite and local R2, with credential/binding guards and `_test_marker` verified before seed/reset/cleanup. Never touch daily-dev/production data or deploy remote `-test` resources. The runner leaves its own state for failure inspection and never resets shared development state.

## Operations / Release

For an authorized release use `bun run release`; it bumps, commits, tags and pushes. `bun run migrate` defaults to production, while `migrate:local` targets local 8787. Apply schema before dependent code and validate the deployed site/Worker using the [runbook](docs/31-development.md). Documentation updates do not require a release or deployment.

## Retrospective

Keep full narratives in [Retrospective.md](Retrospective.md). Cross-project lessons belong in nmem/global rules; enforce deterministic lessons in tests.

- Restore fake timers in every suite because `isolate: false` shares process state.
- Test production-only security headers separately from development; never contaminate localhost with HSTS.
