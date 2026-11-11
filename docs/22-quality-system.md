# 22 — Quality System (System0 slots)

> Authoritative quality document for this repository. Slot semantics come from the
> `system0-quality` skill (v1.3.0, nocoo/workflow); base-ci v2026.13 only supplies
> composite actions and the deploy interface.
>
> Supersedes [07](./07-quality-system-upgrade.md) and [17](./17-quality-upgrade.md)
> (the retired "6DQ / six-dimensional" numbering). Command surface and gates are
> mirrored in [AGENTS.md](../AGENTS.md).

---

## 1. Slots

Twelve slots, no more and no fewer. `impl` means the check really runs and blocks;
`na` means the product has nothing for the slot to cover.

| Slot | Stage | Command | Checks | Status | Measured (dev machine, warm) |
| --- | --- | --- | --- | --- | --- |
| S1 Types | pre-commit, pre-push, CI | `bun run typecheck` | `next typegen` + `tsc --noEmit` on root and Worker lanes | impl | 1.0s |
| S2 Lint | pre-commit, pre-push, CI | `bun run lint` | Biome check-only, 0 error / 0 warning, plus oxc AST gates (dynamic delete, `@ts-expect-error` justification, permanent test skip) | impl | 0.6s |
| S3 Workflow | pre-commit (staged workflows), CI | `bun run scripts/quality/workflow-lint.ts` | actionlint 1.7.12, full-SHA `nocoo/base-ci` pins; CI adds yamllint 1.38.0 | impl | 0.2s |
| G1 Secrets | pre-commit (`--staged`), pre-push (pushed range), CI (`dir .`) | `bun run scripts/quality/secrets.ts` | gitleaks 8.30.1 over the exact content of the stage; redacted output | impl | 0.3s |
| G2 Dependencies | pre-push, CI | `bun run security` | osv-scanner over `bun.lock` + `worker/bun.lock`; missing or too-old scanner fails separately from findings | impl | 2.2s |
| B1 Build | pre-push, CI | `bun run build` | standalone Next bundle from the snapshot under test | impl | 11.9s |
| L1 Unit | pre-commit, pre-push, CI | `bun run test:coverage`, `bun run test:worker:coverage` | statements/branches/functions/lines ≥95% in both lanes | impl | 2.2s |
| L2 Runtime | — | — | no workerd / vitest-pool-workers suite; `worker/test` is Node with a mocked D1 binding and counts as L1; real D1 execution is proven by L3 | **na** | — |
| L3 Integration | pre-push, CI | `bun run test:e2e:api` | real HTTP through `wrangler dev` + `next start`, per-run D1/R2, `_test_marker`, synthetic credentials | impl | 5.5s |
| L4 E2E | pre-push, CI | `bun run test:e2e:browser` | Playwright chromium journeys (blog + admin) | impl | 29.4s |
| P1 Package | — | — | `package.json` is private and nothing is published to npm | **na** | — |
| Z1 Gate | every stage | `scripts/quality/gate.ts` (local), `Z1: Gate` job (CI) | all slots above | impl | — |

Coverage today: root 98.63 / 95.67 / 99.16 / 99.18 (statements/branches/functions/lines),
worker 98.64 / 96.59 / 100 / 99.52. The 95% floor is a floor, not a target.

### Why L2 and P1 are `na`

`worker/test` imports Vitest, mocks the whole `D1Database` interface and runs with
`environment: "node"`; there is no `@cloudflare/vitest-pool-workers` or workerd
dependency. Under the slot definition that is L1 evidence, not a runtime suite.
Real runtime and SQL behavior is covered by the L3 lane, which drives a real
`wrangler dev` process against per-run SQLite. Adding a workerd suite would let
L2 move to `impl`; it is tracked as an optional follow-up, not a current gap.

`P1` would only apply if this repository published a package; it does not.

## 2. Local gates

`.husky/pre-commit` and `.husky/pre-push` both delegate to
`scripts/quality/gate.ts`, which runs one stage's slots, prints a table
(slot, command, target, result, duration) and fails the stage on the first
problem. Slot definitions, stages and timeouts live in `scripts/quality/slots.ts`.

| Property | pre-commit | pre-push |
| --- | --- | --- |
| Object under test | Git index exported with `git checkout-index` into a temp snapshot | one detached `git worktree` per pushed OID from stdin |
| Slots | S1, S2, L1, G1, S3 (only when `.github/workflows/**` is staged) | S1, S2, L1, G1, G2, B1, L3, L4 |
| Dependencies | installed `node_modules` symlinked read-only after comparing the index manifests/lockfiles with the working-tree copies; the lockfile is validated with `--frozen-lockfile --dry-run` (a stale local install is not detected) | symlinked only when the pushed commit's manifests equal the installed ones, otherwise `bun install --frozen-lockfile` runs inside that worktree |
| Lockfiles | `bun install --frozen-lockfile --dry-run` (no writes) | same |
| Isolation | caches (`XDG_CACHE_HOME`) inside the snapshot; worktree untouched | caches in the temp root; worktrees removed afterwards |
| Timeout | 60s stage budget, per-step timeouts | 300s stage budget, per-step timeouts |
| Failure modes | failing step, missing/too-old scanner, toolchain drift, empty run, timeout, stage budget | same |

`bun run gate:pre-commit` runs the pre-commit hook directly. The pre-push hook has
no standalone script because it verifies push refs from stdin; to exercise it
manually, feed it refs (the worktree and its `node_modules` stay untouched):

```sh
printf 'refs/heads/x %s refs/heads/x %s\n' "$(git rev-parse HEAD)" "$(git rev-parse HEAD~1)" | .husky/pre-push origin origin
```

Blocked-by-design conditions that are easy to get wrong and are therefore explicit:

- A missing `gitleaks` / `osv-scanner` / `actionlint`, or a version below the
  minimum, fails the stage — it never silently skips the slot.
- The toolchain is checked against `.mise.toml` (bun 1.4.4, node 26.13.0); a
  mismatched `bun` fails before anything runs.
- L1/L3/L4 assert a minimum number of passed tests, so a suite that silently
  collects nothing fails instead of passing empty.
- Push deletion of a ref skips source checks; a new branch scans
  `<oid> --not --remotes` for secrets; the same commit pushed for two refs is
  verified once.
- A busy port fails the L3/L4 lane instead of skipping it.
- The stage budget fails the stage only for slots it prevented from starting; a
  stage whose every slot finished over budget prints a governance warning instead
  of turning a green run red.
- G1 refuses to run outside a real target: `--index-snapshot` requires the
  exported-snapshot marker, and pre-push requires an explicit commit range, so a
  manual `gate.ts` run can never quietly scan the working tree.

## 3. CI

Native mode: `.github/workflows/ci.yml` is a single caller job (key `quality`, no
`name`) over `./.github/workflows/quality-slots.yml`.

- Each slot is a top-level job named exactly `<ID>: <Name>`, so checks render as
  `quality / S1: Types` … `quality / Z1: Gate`.
- No matrix suffixes and no nested reusable workflows; steps are inlined. base-ci
  composite actions
  (`setup-js`, `setup-security-scanners`) are pinned to
  `e4598815d171e2281f77f27a4800ff8fc2537f3f # v2026.13`.
- `na` slots keep their job with a job-level `if:` so all twelve names exist and
  stay visibly skipped.
- `Z1: Gate` runs with `if: always()`, needs every slot job plus the one blocking
  job outside the slots (`Container image E2E`), and fails when an `impl` slot did
  not succeed, an `na`/`todo` slot actually ran, a job reports no `tested-sha`,
  the reported SHAs differ, or the declaration itself is malformed.
- L3 uploads `.wrangler/e2e-logs/`, L4 uploads `test-results/` and the logs with
  `if: always()` and `if-no-files-found: ignore`, retention 7 days.
- Branch protection on `main` requires exactly `quality / Z1: Gate`. Admin bypass
  is enabled so direct pushes to `main` keep working; no other check is required.
- Releases: `release.yml` calls `deploy-docker.yml@e4598815… # v2026.13`, which
  proves the source run/SHA before deploying; the Z1 success on that SHA is the
  release precondition.

## 4. Performance

Standards: pre-commit ≤15s good, 15–30s over target, >30s unacceptable; pre-push
~2.5min target / 5min reference limit; CI ~5min target / 10min reference limit.

| Stage | Wall time | Composition | Verdict |
| --- | --- | --- | --- |
| pre-commit | 3.6–4.5s | index export + symlink ~0.6s, S1 1.0s, S2 0.6s, L1 2.2s, G1 0.3s, S3 0.2s when applicable | within the 15s bar |
| pre-push | 54.4s | worktree + symlink ~1s, S1 1.0s, S2 0.6s, L1 2.2s, G1 0.0s, G2 2.2s, B1 11.9s, L3 5.5s, L4 29.4s | within the 2.5min target |

The pre-commit snapshot is created fresh on every run with its own cache root, so
no incremental state (`tsbuildinfo`, Vitest/Vite caches) survives between runs —
the numbers above are not warmed by a previous gate run, only by the OS file
cache. L4 dominates pre-push; it is the cheapest honest proof that the built site
still works, so it stays in the default path.

CI timings (per-job and total) are recorded in the `Z1: Gate` step summary of each
run; the current numbers and the bottleneck analysis live in
[31-development](./31-development.md#quality-gate-timings) and are refreshed when
the workflow changes.

## 5. Failure injection evidence

Every gate was verified to fail for the right reason (not just to pass when
healthy). Local injections run against the real hooks; CI injections run against
the Z1 validator extracted from the workflow.

| Injected fault | Expected | Observed |
| --- | --- | --- |
| Type error in `src/` | S1 blocks | see §5.1 |
| Biome error | S2 blocks | see §5.1 |
| Fake secret in a staged file | G1 blocks at pre-commit | see §5.1 |
| Fake secret only in an unpushed commit | G1 blocks at pre-push for that OID | see §5.1 |
| Outdated lockfile vs `package.json` | preflight blocks before any slot | see §5.1 |
| `gitleaks` / `osv-scanner` / `actionlint` removed from `PATH` | stage fails, names the missing tool | see §5.1 |
| Truncated test suite (empty run) | L1 blocks on the empty-run guard | see §5.1 |
| Deliberately failing L3 | pre-push blocks, L3 marked FAIL | see §5.1 |
| Deliberately failing L4 | pre-push blocks, L4 marked FAIL | see §5.1 |
| `bun` version differing from `.mise.toml` | preflight blocks | see §5.1 |
| Z1: `impl` job failed / `na` job ran / SHA mismatch / missing SHA / illegal status / missing declaration / empty reason / blocking extra failed | Z1 fails with a specific message | verified locally against the extracted validator |

### 5.1 Recorded runs

Local injections ran against the real hooks and `gate.ts`; each one was reverted
immediately. CI injections ran against the Z1 validator extracted from
`quality-slots.yml` with synthetic `needs` payloads.

| Injected fault | Command | Observed |
| --- | --- | --- |
| `const x: number = "s"` in `src/` | `.husky/pre-commit` | `S1 ✗ typecheck 0.8s — exit 1`, gate exit 1 |
| `export const injected: any = 1` | `.husky/pre-commit` | `S2 ✗ lint 0.2s — exit 1` (`noExplicitAny`) |
| live Stripe token staged | `.husky/pre-commit` | `G1 ✗ staged 0.4s — exit 1`, `leaks found: 1` |
| live Stripe token in one pushed commit | `.husky/pre-push` (range `parent..commit`) | `G1 ✗ range … — exit 1` |
| `gitleaks` removed from `PATH` | `gate.ts --only=G1` | preflight `✗ gitleaks: not found on PATH (need >= 8.30.1)` |
| `lodash@4.17.20` in `bun.lock` | `bun run security` | `G2: FAILED — vulnerabilities found in bun.lock` (4 advisories) |
| type error under `src/` | `gate.ts --stage=pre-push --only=B1` | `B1 ✗ build 0.5s — exit 1` |
| failing test in `e2e/api/` | `gate.ts --stage=pre-push --only=L3` | `L3 FAIL 5.7s` |
| failing spec in `e2e/bdd/` | `gate.ts --stage=pre-push --only=L4` | `L4 FAIL 30.0s` |
| step timeout lowered to 200ms | `gate.ts --only=S2` | `S2 timeout: exceeded 200ms` |
| stage budget lowered to 1ms (slots cannot start) | `gate.ts --stage=pre-commit --only=S1,S2` | `S1 (timeout: stage budget 0s exceeded before this slot)`, `S2 (…)`, `budget (timeout: 2 slot(s) never started within the 0s budget)` |
| `.mise.toml` bun bumped to 1.3.9 | `gate.ts --only=S1` | preflight `✗ bun: 1.4.4 does not match .mise.toml 1.3.9` |
| dependency added to `worker/package.json` without a lockfile update | `gate.ts --only=S1` | preflight `✗ lockfile worker: bun install --frozen-lockfile --dry-run failed` |
| broken commit on `tmp-pin`, clean worktree on `main` | `.husky/pre-push` with that OID on stdin | S1 failed on `src/inject-pin.ts`, which only exists in the pushed commit |
| ref deletion (`local OID` all zeros) | `.husky/pre-push` | `deletion, no source checks`, exit 0 |
| Z1: `impl` job failed / `na` job ran / missing SHA / SHA mismatch / illegal status / missing declaration / empty reason / blocking extra failed or cancelled | extracted validator | each rejected with its own `::error::` message |

## 6. Known gaps (honest list)

- **2 `it.todo`** in `e2e/api/upload-logo.test.ts` (square-PNG upload, logo
  removal) — declared but unimplemented L3 cases.
- **36 conditional `test.skip`** in `e2e/bdd/**`: environment/feature gates, not
  permanent skips (the AST gate blocks the permanent form). They are honest
  coverage gaps for those configurations.
- **L2 Runtime** has no workerd suite (see §1).
- **yamllint** runs in CI only; developer machines do not have it, so S3 is
  actionlint + pin checks locally.
- **Scanner version drift**: CI pins gitleaks 8.30.1 / osv-scanner 2.5.1 with
  checksums; the local gate accepts any version ≥ those minimums (dev machine
  currently osv-scanner 2.7.0).
- **G1 allowlists `e2e/**/*.{test,spec}.ts`** as synthetic-fixture space, so a real
  secret committed to an e2e test would not be reported. Fixture tokens elsewhere
  are obviously fake rather than allowlisted.
- **Local `node_modules` provenance** is not cryptographic: both gates prove the
  commit's manifests and lockfile agree with the installed ones only insofar as
  the files are compared; a hand-edited `node_modules` is not detected.
- **CI wall time** is dominated by the container lane and by per-job installs; the
  numbers and the feasible optimizations are tracked in
  [31-development](./31-development.md#quality-gate-timings).
