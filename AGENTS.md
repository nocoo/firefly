# Firefly

Personal blog and administration platform with Next.js, a Cloudflare D1 Worker and R2 media.
Profile: ts-worker-web.
Human overview: [README.md](README.md). Direction: [development guide](docs/31-development.md), [architecture](docs/03-architecture.md). Maintain this root `AGENTS.md` as the only project handbook; do not create a `CLAUDE.md` alias, copy or import.

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

- Deploy Next.js as a standalone Node container on jp4 (Tailscale) through successful main CI and the pinned Docker CD workflow into `/data/firefly`. Public DNS may still route `lizheng.blog` to jp2 until steward cutover; until then `x-firefly-origin` and `DEPLOY_ORIGIN_MARKER` remain `jp2`. The owner-approved Railway→jp2 cutover completed on 2026-10-21; Railway is stopped and retained only for rollback. See [the migration runbook](docs/35-jp2-migration.md). The D1 Worker and migrations remain separate operations. Preserve Google login and the administrator email allowlist.
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

Run from root; install root and Worker packages separately. `.mise.toml` pins the toolchain (bun 1.4.4, node 26.13.0); CI pins the same versions and the local gate fails when the installed bun differs.

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
bun run gate:pre-commit
bun run gate:pre-push
```

Follow README for local Worker startup on 8787 before `bun run migrate:local`. Web dev uses 7028. Names required for normal login: `AUTH_SECRET`, `AUTH_URL`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_ALLOWED_EMAILS`; Worker connection uses `WORKER_URL`/`WORKER_SECRET`. Ordinary dev uploads use configured R2; E2E uses the local file adapter. Install Chromium with `bunx playwright install chromium`. CI supplies `AUTH_SECRET`/`AUTH_ALLOWED_EMAILS`; never copy production secrets into fixtures.

## Verification

System0 is the 12-slot set of the `system0-quality` skill (v1.3.0, nocoo/workflow); base-ci v2026.13 only supplies composite actions and the deploy interface. Slot names, stages and timeouts live in `scripts/quality/slots.ts`. Status: `enforced`, `planned`, `manual`, `na`.

| Slot | Stage | Command and object | Target | Status | Measured |
| --- | --- | --- | --- | --- | --- |
| S1 Types | pre-commit, pre-push, CI | `bun run typecheck`: `next typegen` + `tsc --noEmit` on the root and Worker lanes | `src/`, `worker/src/` | enforced | 1.0s |
| S2 Lint | pre-commit, pre-push, CI | `bun run lint`: Biome check-only (`--error-on-warnings`) plus oxc AST gates (dynamic delete, `@ts-expect-error`, permanent test skip) | every tracked TS/JSON file | enforced | 0.6s |
| S3 Workflow | pre-commit (when workflows are staged), CI | `bun run scripts/quality/workflow-lint.ts`: actionlint 1.7.12 + `nocoo/base-ci` references pinned to a full SHA; CI adds yamllint 1.38.0 | `.github/workflows/*.yml` | enforced | 0.2s |
| G1 Secrets | pre-commit (Git index), pre-push (pushed range), CI (checkout) | gitleaks 8.30.1 `--staged`, `--log-opts=<remote-sha>..<local-sha>` (`<oid> --not --remotes` for new refs), `dir .` in CI; every scan redacted | staged content / pushed commits / checked-out tree | enforced | 0.3s |
| G2 Dependencies | pre-push, CI | `bun run security`: osv-scanner over `bun.lock` and `worker/bun.lock`; a missing or too-old scanner fails separately from findings | both lockfiles | enforced | 2.2s |
| B1 Build | pre-push, CI | `bun run build`: `next typegen && tsc --noEmit && next build --webpack` | standalone site bundle | enforced | 11.9s |
| L1 Unit | pre-commit, pre-push, CI | root `test:coverage` + `test:worker:coverage`; statements/branches/functions/lines each ≥95% in both lanes | `src/`, `scripts/`, `worker/src` | enforced | 2.2s |
| L2 Runtime | — | no workerd / vitest-pool-workers suite exists; `worker/test` runs in Node with a mocked D1 binding and is counted as L1. Real D1 execution is proven by L3 | — | na | — |
| L3 Integration | pre-push, CI | `bun run test:e2e:api`: real HTTP against `wrangler dev` + `next start` with per-run D1/R2, `_test_marker` and synthetic credentials | every API route | enforced | 5.5s |
| L4 E2E | pre-push, CI | `bun run test:e2e:browser`: Playwright chromium journeys | blog and admin journeys | enforced | 29.4s |
| P1 Package | — | `package.json` is private and nothing is published to npm | — | na | — |
| Z1 Gate | every stage | local: `scripts/quality/gate.ts`; CI: the `Z1: Gate` validator in `quality-slots.yml` | all slots above | enforced | see below |

Local gates are check-only and never touch the worktree. Pre-commit exports the Git index with `git checkout-index` into a temporary snapshot, symlinks the installed `node_modules` read-only after proving the index manifests match them, and runs S1, S2, L1, G1 plus S3 when workflows change; frozen-lockfile validation is `--dry-run` only. Pre-push reads the push refs from stdin, creates one detached worktree per commit and runs S1, S2, L1, G1, G2, B1, L3 and L4 there — never on the working tree. Every step has a timeout, every slot has an empty-run guard, and a missing scanner, a failing step or a timeout fails the stage.

Measured on the development machine (warm): pre-commit 3.6–4.5s end to end against a 15s bar; pre-push 54.4s end to end (S1 1.0, S2 0.6, G1 0.0, L1 2.2, G2 2.2, B1 11.9, L3 5.5, L4 29.4) against the skill's 2.5min target and 5min limit. CI runs the same slots as separate jobs and aggregates them in `quality / Z1: Gate`.

CI is native mode: `.github/workflows/ci.yml` is a single caller job (key `quality`, no `name`) over `./.github/workflows/quality-slots.yml`, whose jobs are named exactly `<ID>: <Name>`. `quality / Z1: Gate` is the only required check on `main`; direct pushes stay possible through the admin bypass. Never bypass commit or branch-push hooks.

## Resources / Isolation

| Purpose | Ports / state | Current behavior |
| --- | --- | --- |
| Dev | Web 7028, local Worker 8787 | Can use real configured R2 |
| L3 | Web 17028, Worker 8787 | Fresh `worker/.wrangler/e2e-<random>/` D1/R2 state; cache proofs run after API mutations |
| L4 | Web 27028, Worker 8787 | Own per-run state; ports remain shared, never run alongside another runner or dev Worker |

Use per-run local Wrangler/Miniflare SQLite and local R2, with credential/binding guards and `_test_marker` verified before seed/reset/cleanup. Never touch daily-dev/production data or deploy remote `-test` resources. The runner leaves its own state for failure inspection and never resets shared development state.

## Operations / Release

For an authorized release use `bun run release`; it bumps, commits, tags and pushes. `bun run migrate` defaults to production, while `migrate:local` targets local 8787. Apply schema before dependent code and validate the deployed site/Worker using the [runbook](docs/31-development.md). Documentation updates do not require a version release; main pushes still run Docker CD.

Docker CD uses `firefly / production`, `/data/firefly` on jp4, the `web` Compose
service and immutable image digests. Railway production application variables are
copied unchanged to the private host `.env.runtime`, never into build arguments or
test fixtures. Production uses proxied DNS, Full (strict) TLS and Caddy with the
shared Cloudflare origin-pull CA: `tls_client_auth=on`, not the custom-certificate
zone-level AOP toggle. Keep one active application instance/write origin until DNS
cutover; do not restart Railway while jp2 still accepts public writes; project
deletion needs owner approval.
Only `lizheng.blog` routes to Firefly; `www` remains a separate redirect Worker.
The duplicate `origin.lizheng.blog` was retired with owner approval. Do not
restore it from pre-cutover DNS or Caddy backups. For this file-backed Caddy
(`caddy run`, no `--resume`, admin API disabled), validate the candidate first,
then use `SIGUSR1` to reload without restarting the shared proxy.
Caller-visible repository variables control deployment phase; credentials remain
environment-scoped. Production verification requires `DEPLOY_PHASE=production`, the canonical
`DEPLOY_URL=https://lizheng.blog`, and `DEPLOY_ORIGIN_MARKER=jp2`.

CI additionally runs `bun scripts/run-e2e.ts --api-only --container-image=<image>`
from the `container-image-e2e` job in `quality-slots.yml`. This Linux-only lane
uses host networking and the same per-run marked D1/R2 isolation; it never pulls
an unspecified image. It is the one blocking job outside the 12 slots: the name
carries no slot id and `Z1: Gate` aggregates it. Do not run it alongside another
E2E lane or a development Worker.

## Retrospective

Keep full narratives in [Retrospective.md](Retrospective.md). Cross-project lessons belong in nmem/global rules; enforce deterministic lessons in tests.

- Restore fake timers in every suite because `isolate: false` shares process state.
- Test production-only security headers separately from development; never contaminate localhost with HSTS.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
