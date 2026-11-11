#!/usr/bin/env bun
/**
 * G1: Secrets — gitleaks over the content of a single gate stage.
 *
 *   --staged              pre-commit: scan the Git index (staged content)
 *   --range=<a..b>        pre-push: scan the commits this push introduces
 *
 * Missing scanner, wrong version, or a scanner error is reported as a gate
 * failure distinct from "leaks found". Findings are redacted.
 */
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { checkTool } from "./tools";

const args = process.argv.slice(2);
const value = (name: string) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);

const staged = args.includes("--staged");
const range = value("range");
const gitRoot = value("git-root") ?? process.cwd();
const configRoot = resolve(import.meta.dir, "../..");

if (staged === Boolean(range)) {
  console.error("G1: pass exactly one of --staged or --range=<a..b>");
  process.exit(2);
}

const tool = await checkTool("gitleaks");
if (!tool.ok) {
  console.error(`G1: scanner unavailable — ${tool.detail}`);
  process.exit(2);
}

const config = [join(process.cwd(), ".gitleaks.toml"), join(configRoot, ".gitleaks.toml")].find((path) =>
  existsSync(path),
);
if (!config) {
  console.error("G1: .gitleaks.toml not found");
  process.exit(2);
}

const cwd = range ? process.cwd() : gitRoot;
const target = range ? `range ${range}` : "staged content";
const invocation = [
  "gitleaks",
  "git",
  ...(range ? [`--log-opts=${range}`] : ["--staged"]),
  "--no-banner",
  "--redact",
  `--config=${config}`,
  `--gitleaks-ignore-path=${configRoot}`,
];

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
