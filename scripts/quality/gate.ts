#!/usr/bin/env bun
/**
 * Local System0 gate runner (the pre-commit / pre-push counterpart of CI `Z1: Gate`).
 *
 * Every selected slot runs inside the snapshot under test, with its own timeout.
 * A failing slot, a missing scanner, a non-matching empty run or a timeout fails
 * the whole stage and prints the reason per slot.
 *
 * Usage (from inside the snapshot root):
 *   bun scripts/quality/gate.ts --stage=pre-commit
 *   bun scripts/quality/gate.ts --stage=pre-push --g1-range=<remote..local>
 *   bun scripts/quality/gate.ts --stage=pre-push --only=B1,L3
 */
import { join, resolve } from "node:path";
import { NOT_APPLICABLE, type SlotDefinition, type Stage, STAGE_TIMEOUT_MS, slotsForStage } from "./slots";
import { checkBun, checkTool } from "./tools";

const args = process.argv.slice(2);
const argValue = (name: string) =>
  args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);

const stage = argValue("stage") as Stage | undefined;
const only = argValue("only");
const g1Range = argValue("g1-range");
const listOnly = args.includes("--list");

if (listOnly) {
  for (const slot of ["pre-commit", "pre-push"] as Stage[]) {
    console.log(`${slot}: ${slotsForStage(slot).map((slot) => slot.id).join(", ")}`);
  }
  process.exit(0);
}

if (stage !== "pre-commit" && stage !== "pre-push") {
  console.error("gate: --stage=pre-commit|pre-push is required");
  process.exit(2);
}

const root = resolve(import.meta.dir, "../..");
const gitRoot = process.env.GATE_GIT_ROOT ?? root;
const startedAt = performance.now();
const stageBudgetMs = STAGE_TIMEOUT_MS[stage];
const timeoutBin = Bun.which("timeout") ?? Bun.which("gtimeout");

type Outcome = "pass" | "fail" | "timeout" | "skip";

interface StepResult {
  label: string;
  command: string;
  outcome: Outcome;
  ms: number;
  note: string;
}

interface SlotResult {
  slot: SlotDefinition;
  outcome: Outcome;
  ms: number;
  steps: StepResult[];
  note: string;
}

const selected = slotsForStage(stage).filter((slot) => {
  if (!only) return true;
  return only.split(",").includes(slot.id);
});

const stagedPaths = (process.env.GATE_STAGED_FILES ?? "")
  .split("\n")
  .map((line) => line.trim())
  .filter(Boolean);

function tee(chunk: string, stream: "out" | "err") {
  const target = stream === "out" ? process.stdout : process.stderr;
  target.write(chunk);
}

async function runStep(
  command: string,
  timeoutMs: number,
  expect: { pattern: RegExp; label: string; min: number } | undefined,
  label: string,
): Promise<StepResult> {
  const started = performance.now();
  const invocation = timeoutBin
    ? [timeoutBin, "-s", "KILL", String(Math.ceil(timeoutMs / 1000)), "sh", "-c", command]
    : ["sh", "-c", command];
  const proc = Bun.spawn(invocation, {
    cwd: root,
    env: { ...process.env, CI: process.env.CI ?? "" },
    stdout: "pipe",
    stderr: "pipe",
  });
  const timer = timeoutBin
    ? undefined
    : setTimeout(() => {
        proc.kill("SIGKILL");
      }, timeoutMs);

  let output = "";
  const pump = async (stream: ReadableStream<Uint8Array> | undefined, kind: "out" | "err") => {
    if (!stream) return;
    const decoder = new TextDecoder();
    for await (const chunk of stream as unknown as AsyncIterable<Uint8Array>) {
      const text = decoder.decode(chunk, { stream: true });
      output += text;
      tee(text, kind);
    }
  };
  await Promise.all([pump(proc.stdout as ReadableStream<Uint8Array>, "out"), pump(proc.stderr as ReadableStream<Uint8Array>, "err")]);
  const code = await proc.exited;
  if (timer) clearTimeout(timer);
  const ms = performance.now() - started;

  if (code === 124 || code === 137) {
    return { label, command, outcome: "timeout", ms, note: `exceeded ${Math.round(timeoutMs / 1000)}s` };
  }
  if (code !== 0) {
    return { label, command, outcome: "fail", ms, note: `exit ${code}` };
  }
  if (expect) {
    const matches = [...output.matchAll(new RegExp(expect.pattern.source, "g"))];
    const count = matches.reduce((sum, match) => sum + Number(match[1] ?? 0), 0);
    if (count < expect.min) {
      return {
        label,
        command,
        outcome: "fail",
        ms,
        note: `empty run: ${count} ${expect.label} (need >= ${expect.min})`,
      };
    }
  }
  return { label, command, outcome: "pass", ms, note: "" };
}

function formatMs(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

async function preflight(): Promise<boolean> {
  const started = performance.now();
  console.log("▸ preflight: toolchain and lockfiles");
  const checks = [await checkBun(root)];
  const needs = new Set<string>();
  for (const slot of selected) {
    if (slot.id === "G1") needs.add("gitleaks");
    if (slot.id === "G2") needs.add("osv");
    if (slot.id === "S3") needs.add("actionlint");
  }
  for (const tool of needs) {
    checks.push(await checkTool(tool as "gitleaks" | "osv" | "actionlint"));
  }

  const lockDirs = ["", "worker"].filter((dir) => {
    const base = join(root, dir);
    return Bun.file(join(base, "package.json")).size > 0;
  });
  for (const dir of lockDirs) {
    const cwd = join(root, dir);
    if (!(await verifyLockfile(cwd))) {
      checks.push({
        name: `lockfile ${dir || "root"}`,
        ok: false,
        detail: "bun install --frozen-lockfile --dry-run failed; run bun install and commit the lockfile",
      });
    } else {
      checks.push({ name: `lockfile ${dir || "root"}`, ok: true, detail: "frozen" });
    }
  }

  let ok = true;
  for (const check of checks) {
    console.log(`  ${check.ok ? "✓" : "✗"} ${check.name}: ${check.detail}`);
    if (!check.ok) ok = false;
  }
  console.log(`  preflight ${formatMs(performance.now() - started)}`);
  return ok;
}

async function verifyLockfile(cwd: string): Promise<boolean> {
  const proc = Bun.spawn(["bun", "install", "--frozen-lockfile", "--dry-run"], {
    cwd,
    stdout: "ignore",
    stderr: "ignore",
  });
  await proc.exited;
  return proc.exitCode === 0;
}

const results: SlotResult[] = [];

function stageBudgetExceeded(): boolean {
  return performance.now() - startedAt > stageBudgetMs;
}

if (!(await preflight())) {
  console.error(`\n❌ ${stage}: preflight failed`);
  process.exit(1);
}

for (const slot of selected) {
  if (stageBudgetExceeded()) {
    results.push({
      slot,
      outcome: "timeout",
      ms: 0,
      steps: [],
      note: `stage budget ${Math.round(stageBudgetMs / 1000)}s exceeded before this slot`,
    });
    continue;
  }
  if (slot.stagedOnly && !stagedPaths.some((path) => slot.stagedOnly?.test(path))) {
    results.push({ slot, outcome: "skip", ms: 0, steps: [], note: "no staged change for this slot" });
    console.log(`\n▸ ${slot.name} — skipped (no staged change for ${slot.stagedOnly})`);
    continue;
  }

  const steps = slot.stepsFor?.({ root, gitRoot, g1Range }) ?? slot.steps ?? [];
  console.log(`\n▸ ${slot.name} — ${slot.target}`);
  const slotStarted = performance.now();
  const stepResults: StepResult[] = [];
  for (const step of steps) {
    console.log(`  $ ${step.command}`);
    const result = await runStep(step.command, step.timeoutMs, step.expect, step.label);
    stepResults.push(result);
    console.log(`  ${result.outcome === "pass" ? "✓" : "✗"} ${result.label} ${formatMs(result.ms)}${result.note ? ` — ${result.note}` : ""}`);
    if (result.outcome !== "pass") {
      for (const rest of steps.slice(stepResults.length)) {
        stepResults.push({ label: rest.label, command: rest.command, outcome: "skip", ms: 0, note: "not run" });
      }
      break;
    }
  }
  const failed = stepResults.find((step) => step.outcome === "fail" || step.outcome === "timeout");
  results.push({
    slot,
    outcome: failed ? failed.outcome : "pass",
    ms: performance.now() - slotStarted,
    steps: stepResults,
    note: failed?.note ?? "",
  });
}

const totalMs = performance.now() - startedAt;
console.log(`\n${"─".repeat(78)}`);
console.log(`System0 ${stage} gate — ${root}`);
console.log(`${"ID".padEnd(4)}${"SLOT".padEnd(17)}${"RESULT".padEnd(9)}${"TIME".padEnd(8)}TARGET`);
for (const result of results) {
  console.log(
    `${result.slot.id.padEnd(4)}${result.slot.name.slice(4).padEnd(17)}${result.outcome.toUpperCase().padEnd(9)}${formatMs(result.ms).padEnd(8)}${result.slot.target}`,
  );
}
for (const entry of NOT_APPLICABLE) {
  console.log(`${entry.id.padEnd(4)}${entry.name.slice(4).padEnd(17)}${"N/A".padEnd(9)}${"-".padEnd(8)}${entry.reason}`);
}
console.log(`${"─".repeat(78)}`);
console.log(`total ${formatMs(totalMs)} (stage budget ${Math.round(stageBudgetMs / 1000)}s)`);

const failedSlots = results.filter((result) => result.outcome === "fail" || result.outcome === "timeout");
if (failedSlots.length > 0) {
  console.error(`\n❌ ${stage} gate failed: ${failedSlots.map((result) => `${result.slot.id} (${result.outcome}${result.note ? `: ${result.note}` : ""})`).join(", ")}`);
  process.exit(1);
}
if (results.every((result) => result.outcome === "skip")) {
  console.error(`\n❌ ${stage} gate failed: no slot ran`);
  process.exit(1);
}
console.log(`\n✅ ${stage} gate passed`);
