#!/usr/bin/env bun
/**
 * G1: Secrets — gitleaks over the content of a single gate stage.
 *
 *   --index-snapshot      pre-commit: scan the exported Git index (the content
 *                         that becomes the commit), path allowlists included
 *   --range=<a..b>        pre-push: scan the commits this push introduces
 *
 * Missing scanner, wrong version, or a scanner error is reported as a gate
 * failure distinct from "leaks found". Findings are redacted.
 *
 * `gitleaks git --staged` is deliberately not used: with 8.30.1 it scans the diff
 * header of a new file instead of its content, so a staged secret passed clean.
 */
import { existsSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { checkTool } from "./tools";

const args = process.argv.slice(2);
const value = (name: string) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);

const indexSnapshot = args.includes("--index-snapshot");
const range = value("range");
const snapshotRoot = process.env.GATE_SNAPSHOT_ROOT;

if (indexSnapshot === Boolean(range)) {
  console.error("G1: pass exactly one of --index-snapshot or --range=<a..b>");
  process.exit(2);
}

// Without the marker, `gitleaks dir .` would scan the working tree — including
// gitignored .env and build output — instead of the exported index.
const sameDir = (a: string | undefined, b: string) => {
  if (!a) return false;
  try {
    return realpathSync(a) === realpathSync(b);
  } catch {
    return false;
  }
};

if (indexSnapshot && !sameDir(snapshotRoot, process.cwd())) {
  console.error(
    `G1: --index-snapshot requires GATE_SNAPSHOT_ROOT to be the current directory (got ${snapshotRoot ?? "unset"}); run .husky/pre-commit instead`,
  );
  process.exit(2);
}

const tool = await checkTool("gitleaks");
if (!tool.ok) {
  console.error(`G1: scanner unavailable — ${tool.detail}`);
  process.exit(2);
}

const cwd = process.cwd();
const config = [join(cwd, ".gitleaks.toml")].find((path) => existsSync(path));
if (!config) {
  console.error(`G1: .gitleaks.toml not found in ${cwd}`);
  process.exit(2);
}

const target = range ? `range ${range}` : "index snapshot";
const invocation = range
  ? ["gitleaks", "git", `--log-opts=${range}`, "--no-banner", "--redact"]
  : ["gitleaks", "dir", ".", "--no-banner", "--redact"];
invocation.push(`--config=${config}`, `--gitleaks-ignore-path=${cwd}`);

console.log(`G1: gitleaks (${tool.detail}) — ${target} in ${cwd}`);
const proc = Bun.spawn(invocation, { cwd, stdout: "inherit", stderr: "inherit" });
await proc.exited;
const code = proc.exitCode ?? 1;

if (code === 0) {
  console.log(`G1: 0 leaks in ${target}`);
  process.exit(0);
}
if (code === 1) {
  console.error(`G1: leaks found in ${target} — see the findings above`);
  process.exit(1);
}
console.error(`G1: gitleaks itself failed (exit ${code}) for ${target}`);
process.exit(1);
