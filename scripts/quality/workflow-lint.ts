#!/usr/bin/env bun
/**
 * S3: Workflow — self-check of the CI configuration itself.
 *
 *   - actionlint on every workflow file
 *   - `nocoo/base-ci/...` references pinned to a full 40-character SHA
 *
 * yamllint runs in CI only (`workflow-lint-yamllint` in the slot job) because it
 * is not installed on developer machines.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { checkTool } from "./tools";

const root = resolve(import.meta.dir, "../..");
const workflowDir = join(root, ".github/workflows");

const files = readdirSync(workflowDir)
  .filter((name) => name.endsWith(".yml") || name.endsWith(".yaml"))
  .sort()
  .map((name) => join(workflowDir, name));

if (files.length === 0) {
  console.error("S3: no workflow files found");
  process.exit(1);
}

const tool = await checkTool("actionlint");
if (!tool.ok) {
  console.error(`S3: actionlint unavailable — ${tool.detail}`);
  process.exit(2);
}

console.log(`S3: actionlint ${tool.detail.replace("actionlint ", "")} on ${files.length} workflow files`);
const lint = Bun.spawn(["actionlint", "-shellcheck=", "-pyflakes=", ...files], {
  cwd: root,
  stdout: "inherit",
  stderr: "inherit",
});
await lint.exited;
if (lint.exitCode !== 0) {
  console.error(`S3: actionlint failed (exit ${lint.exitCode})`);
  process.exit(1);
}

const violations: string[] = [];
for (const file of files) {
  readFileSync(file, "utf-8")
    .split("\n")
    .forEach((line, index) => {
      const match = /^\s*(?:uses:|-\s+uses:)\s*["']?([^"'\s]+)["']?/.exec(line);
      if (!match) return;
      const reference = match[1];
      if (!reference.startsWith("nocoo/base-ci/")) return;
      const [, ref] = reference.split("@");
      if (!/^[0-9a-f]{40}$/.test(ref ?? "")) {
        violations.push(`${file.replace(`${root}/`, "")}:${index + 1} ${reference}`);
      }
    });
}

if (violations.length > 0) {
  console.error(`S3: ${violations.length} base-ci reference(s) not pinned to a full SHA:`);
  for (const violation of violations) console.error(`  ${violation}`);
  process.exit(1);
}

console.log(`S3: ${files.length} workflow files clean, base-ci references pinned`);
