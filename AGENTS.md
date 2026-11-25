# Firefly

Personal blog and admin platform on Next.js 16 (standalone Node), Cloudflare D1 Worker (`worker/`), and R2 media.
Docs: [README](README.md) · [Index](docs/README.md) · [Architecture](docs/03-architecture.md) · [Dev](docs/31-development.md) · [Quality](docs/22-quality-system.md) · [Migration](docs/35-jp2-migration.md) · [Retrospective](Retrospective.md)

## Commands

Run from root; install root and `worker/` separately. Toolchain is pinned in `.mise.toml` (Bun `1.4.4`, Node `26.13.1`; local gates fail on Bun mismatch). Variable names live in `.env.example`.

```sh
bun install --frozen-lockfile
bun install --cwd worker --frozen-lockfile
bun run dev                  # Web 127.0.0.1:7028 (start local Worker 8787 first)
bun run migrate:local        # Local Worker 8787 (`bun run migrate` defaults to prod)
bun run typecheck            # S1: next typegen + tsc (root + worker)
bun run lint                 # S2: Biome check-only (0 warnings) + oxc AST gates
bun run test:coverage        # L1: root >= 80% (4 metrics)
bun run test:worker:coverage # L1: worker >= 80%
bun run test:e2e:api         # L3: HTTP against wrangler dev + next start
bun run test:e2e:browser     # L4: Playwright Chromium (`bunx playwright install chromium`)
bun run security             # G2: osv-scanner (root + worker lockfiles)
bun run build                # B1: next build --webpack
bun run gate:pre-commit      # Staged-index local gate
bun run release              # Authorized only: bump, commit, tag, push
```

Auth requires `AUTH_SECRET`, `AUTH_URL`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_ALLOWED_EMAILS`; Worker uses `WORKER_URL`, `WORKER_SECRET`. Dev uploads hit real R2; E2E uses local files. Never copy prod secrets to fixtures.

## Invariants

- **Auth & MCP**: Preserve Google OAuth and admin email allowlist. Keep `full` and `author` MCP scopes separate; author-created posts stay `private` until an admin publishes them.
- **Data**: `src/data/core/` owns SQL/cache/timestamp primitives; entities are pure CRUD; services orchestrate side effects. Primary failures throw; post-write hooks log without rollback (D6).
- **Naming**: Entity inputs are camelCase; DB columns and external MCP/REST fields are snake_case. Map only at boundaries via entity/route hooks.
- **MCP & mocks**: Retain `afterGet`, best-effort `afterCreate`/`afterUpdate`, `mapCreateInput`, and `mapUpdateInput` in MCP configs. Reuse `createMockDb()` from `@/data/core/test-utils`.
- **Media & search**: Keep original upload filenames for display/search (UUIDs in R2 keys only). Preserve FTS query syntax and validate pagination before SQL.
- **UI & build**: MVVM — keep ViewModels free of Views/DOM and routes thin. Build runs stable `tsc` before Webpack alongside `@typescript/native-preview` ([tooling](docs/26-biome-migration-ts7.md)).
- **Migrations**: Connection-scoped PRAGMAs use `-- @batch`. Apply schema before dependent code; `bun run migrate` targets prod. Never revive retired remote test D1 procedures.
- **Tests & headers**: Restore fake timers in every suite (root Vitest uses `isolate: false`). Test prod-only security headers separately from dev; never set HSTS on localhost.
- **CD & releases**: Main CI triggers Docker CD (`firefly / production`, jp4 `/data/firefly`, immutable digests), even on doc pushes. Worker deploy/migrations stay separate; root `package.json` owns version.
- **Origin & routing**: One active write origin only; only `lizheng.blog` routes to Firefly (`www` is a redirect Worker; `origin.lizheng.blog` retired). Keep `DEPLOY_ORIGIN_MARKER=jp2` until DNS cutover.
- **Rollback & TLS**: Railway stays stopped for rollback (deletion needs owner approval); prod TLS (`tls_client_auth=on`), Caddy `SIGUSR1` reload, and rollback live in [runbook](docs/35-jp2-migration.md).

## Quality & Local Gates

Follows `system1-quality`; CI slots and pinned `base-ci` live in `.github/workflows/quality-slots.yml` (`ci.yml` caller `quality`; `quality / Z1: Gate` required on `main`, admin bypass enabled), local config in `scripts/quality/slots.ts`. Status: `enforced`, `planned`, `manual`, `N/A`.

- **Exceptions**: `L2 Runtime` is `N/A` (`worker/test` mocks D1 in Node as L1; L3 covers real D1).
- **Coverage & package gate**: `L1 Unit` enforces >=80% x4 on root (`src/`, minus `vitest.config.ts` exclusions) and `worker/src/`. CI `P1: Package` verifies the built Docker image via API E2E, aggregated by `Z1: Gate`.
- **Local hooks**: Installed via `bun run prepare` (`.husky/`); check-only, never touch worktree. `pre-commit` checks staged Git index (`S1/S2/L1/G1` + `S3` when workflows change).
- **Pre-push & guards**: `pre-push` checks detached worktrees per pushed OID (`S1/S2/L1/G1/G2/B1/L3/L4`). Missing scanners, Bun drift, empty runs, or timeouts fail; never bypass ([docs/22](docs/22-quality-system.md)).

## Resources & Isolation

| Lane | Endpoint / State                                             | Boundary                                                               |
| ---- | ------------------------------------------------------------ | ---------------------------------------------------------------------- |
| Dev  | Web `7028`, Worker `8787` (`.wrangler/state/dev`)            | Daily local data; real configured R2                                   |
| L3   | Web `17028`, Worker `8787`, `worker/.wrangler/e2e-<random>/` | Per-run D1 + local R2; post-mutation cache proofs                      |
| L4   | Web `27028`, Worker `8787`, `worker/.wrangler/e2e-<random>/` | Shared `8787`; never run with dev Worker or another E2E/container lane |
| Prod | `https://lizheng.blog` (jp4 CD; jp2 origin pre-cutover)      | Read-only unless authorized; never deploy remote `-test` resources     |

E2E uses per-run local Wrangler/Miniflare SQLite and local R2 with credential/binding guards and `_test_marker` verified before seed/reset/cleanup; runners keep state for failure inspection and never reset shared dev state.

## Retrospective

Record incident narratives in [Retrospective.md](Retrospective.md); promote recurring constraints to `Invariants` and enforceable safeguards to tests/hooks.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
