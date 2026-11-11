/**
 * System0 slot definitions for the local gates (`.husky/pre-commit`, `.husky/pre-push`).
 *
 * Slot semantics live in the system0-quality skill (v1.3.0); CI wiring lives in
 * `.github/workflows/quality-slots.yml`. Keep the ids, names and stages here in
 * sync with both.
 */

export type Stage = "pre-commit" | "pre-push";

export interface GateStep {
  label: string;
  command: string;
  timeoutMs: number;
  /** Minimum number of matches a step must produce; guards against empty runs. */
  expect?: { pattern: RegExp; label: string; min: number };
}

export interface GateContext {
  /** Working tree that owns the committed content under test. */
  root: string;
  /** Repository with the index (pre-commit) — the snapshot itself has no .git. */
  gitRoot: string;
  /** Commit range for the pushed refs (pre-push). */
  g1Range?: string;
}

export interface SlotDefinition {
  id: string;
  name: string;
  stages: Stage[];
  target: string;
  steps?: GateStep[];
  stepsFor?: (ctx: GateContext) => GateStep[];
  /** Run only when the staged change touches the matching paths. */
  stagedOnly?: RegExp;
}

// Stage budget from the skill: pre-commit ~30s (governance 1 min), pre-push ~2.5 min
// (governance 5 min). Individual step timeouts are generous multiples of measured
// warm timings so a real hang fails instead of the gate grinding.
export const STAGE_TIMEOUT_MS: Record<Stage, number> = {
  "pre-commit": 60_000,
  "pre-push": 300_000,
};

const MIN = 60_000;

export const SLOTS: SlotDefinition[] = [
  {
    id: "S1",
    name: "S1: Types",
    stages: ["pre-commit", "pre-push"],
    target: "src/ + worker/src/ TypeScript (next typegen, tsc --noEmit x2 lanes)",
    steps: [{ label: "typecheck", command: "bun run typecheck", timeoutMs: 3 * MIN }],
  },
  {
    id: "S2",
    name: "S2: Lint",
    stages: ["pre-commit", "pre-push"],
    target: "Biome check-only (0 error / 0 warning) + oxc AST gates",
    steps: [{ label: "lint", command: "bun run lint", timeoutMs: 2 * MIN }],
  },
  {
    id: "S3",
    name: "S3: Workflow",
    stages: ["pre-commit"],
    target: ".github/workflows/*.yml (actionlint + immutable base-ci pins)",
    stagedOnly: /^\.github\/workflows\//,
    steps: [
      { label: "workflow lint", command: "bun run scripts/quality/workflow-lint.ts", timeoutMs: MIN },
    ],
  },
  {
    id: "G1",
    name: "G1: Secrets",
    stages: ["pre-commit", "pre-push"],
    target: "git-staged content (pre-commit) / pushed ref range (pre-push)",
    stepsFor: (ctx) => [
      {
        label: ctx.g1Range ? `range ${ctx.g1Range}` : "staged",
        command: ctx.g1Range
          ? `bun run scripts/quality/secrets.ts --range=${ctx.g1Range}`
          : "bun run scripts/quality/secrets.ts --index-snapshot",
        timeoutMs: 2 * MIN,
      },
    ],
  },
  {
    id: "L1",
    name: "L1: Unit",
    stages: ["pre-commit", "pre-push"],
    target: "root Vitest (src/, scripts/) + worker Vitest, coverage >= 95%",
    steps: [
      {
        label: "root coverage",
        command: "bun run test:coverage",
        timeoutMs: 3 * MIN,
        expect: { pattern: /Tests\s+(\d+)\s+passed/, label: "passed tests", min: 1 },
      },
      {
        label: "worker coverage",
        command: "bun run test:worker:coverage",
        timeoutMs: 2 * MIN,
        expect: { pattern: /Tests\s+(\d+)\s+passed/, label: "passed tests", min: 1 },
      },
    ],
  },
  {
    id: "G2",
    name: "G2: Dependencies",
    stages: ["pre-push"],
    target: "osv-scanner over bun.lock + worker/bun.lock",
    steps: [
      {
        label: "osv-scanner",
        command: "bun run security",
        timeoutMs: 3 * MIN,
        expect: { pattern: /lockfiles? scanned: (\d+)/, label: "scanned lockfiles", min: 2 },
      },
    ],
  },
  {
    id: "B1",
    name: "B1: Build",
    stages: ["pre-push"],
    target: "Next.js standalone bundle from this snapshot (next build --webpack)",
    steps: [{ label: "build", command: "bun run build", timeoutMs: 7 * MIN }],
  },
  {
    id: "L3",
    name: "L3: Integration",
    stages: ["pre-push"],
    target: "real HTTP against wrangler dev + next start with per-run D1/R2",
    steps: [
      {
        label: "api e2e",
        command: "bun run test:e2e:api",
        timeoutMs: 5 * MIN,
        expect: { pattern: /Test Files\s+(\d+) passed/, label: "passed test files", min: 1 },
      },
    ],
  },
  {
    id: "L4",
    name: "L4: E2E",
    stages: ["pre-push"],
    target: "Playwright chromium journeys against the built site",
    steps: [
      {
        label: "browser e2e",
        command: "bun run test:e2e:browser",
        timeoutMs: 7 * MIN,
        expect: { pattern: /(\d+) passed/, label: "passed tests", min: 1 },
      },
    ],
  },
];

/** Slots declared `na` for this project; recorded so the table stays honest. */
export const NOT_APPLICABLE: { id: string; name: string; reason: string }[] = [
  {
    id: "L2",
    name: "L2: Runtime",
    reason:
      "worker/test runs in Node with a mocked D1 binding (L1 evidence); no workerd / vitest-pool-workers runtime suite exists",
  },
  {
    id: "P1",
    name: "P1: Package",
    reason: "root package.json is private and nothing is published to npm",
  },
];

export function slotsForStage(stage: Stage): SlotDefinition[] {
  return SLOTS.filter((slot) => slot.stages.includes(stage));
}
