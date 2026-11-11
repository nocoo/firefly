/**
 * Toolchain and scanner checks shared by the local gates (system0-quality L1/G1/G2
 * "missing tool or report must fail the gate") and `scripts/run-security.ts`.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface ToolCheck {
  name: string;
  ok: boolean;
  detail: string;
}

interface ToolSpec {
  bin: string;
  args: string[];
  minimum: string;
  pattern: RegExp;
}

const TOOLS: Record<string, ToolSpec> = {
  gitleaks: { bin: "gitleaks", args: ["version"], minimum: "8.30.1", pattern: /(\d+\.\d+\.\d+)/ },
  osv: {
    bin: "osv-scanner",
    args: ["--version"],
    minimum: "2.5.1",
    pattern: /osv-scanner version:\s*(\d+\.\d+\.\d+)/,
  },
  actionlint: {
    bin: "actionlint",
    args: ["--version"],
    minimum: "1.7.12",
    pattern: /(\d+\.\d+\.\d+)/,
  },
};

/** Compare dotted versions numerically; returns negative when a < b. */
export function compareVersions(a: string, b: string): number {
  const left = a.split(".").map(Number);
  const right = b.split(".").map(Number);
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

async function run(bin: string, args: string[]): Promise<{ code: number; text: string } | undefined> {
  const which = Bun.which(bin);
  if (!which) return undefined;
  const proc = Bun.spawn([which, ...args], { stdout: "pipe", stderr: "pipe" });
  const [out, err] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const code = await proc.exited;
  return { code, text: `${out}\n${err}` };
}

export async function checkTool(key: keyof typeof TOOLS): Promise<ToolCheck> {
  const spec = TOOLS[key];
  const result = await run(spec.bin, spec.args);
  if (!result) {
    return { name: key, ok: false, detail: `${spec.bin} not found on PATH (need >= ${spec.minimum})` };
  }
  const match = spec.pattern.exec(result.text);
  if (!match) {
    return { name: key, ok: false, detail: `${spec.bin} ${spec.args.join(" ")} printed no version` };
  }
  const version = match[1];
  if (compareVersions(version, spec.minimum) < 0) {
    return { name: key, ok: false, detail: `${spec.bin} ${version} < required ${spec.minimum}` };
  }
  return { name: key, ok: true, detail: `${spec.bin} ${version}` };
}

/** Bun version declared in `.mise.toml`, or undefined when absent. */
export function declaredBunVersion(root: string): string | undefined {
  const path = join(root, ".mise.toml");
  if (!existsSync(path)) return undefined;
  const match = /^\s*bun\s*=\s*"([^"]+)"/m.exec(readFileSync(path, "utf-8"));
  return match?.[1];
}

export async function checkBun(root: string): Promise<ToolCheck> {
  const declared = declaredBunVersion(root);
  const result = await run("bun", ["--version"]);
  if (result?.code !== 0) {
    return { name: "bun", ok: false, detail: "bun is required" };
  }
  const actual = result.text.trim().split("\n")[0].trim();
  if (!declared) {
    return { name: "bun", ok: true, detail: `${actual} (no .mise.toml declaration)` };
  }
  const matches =
    actual === declared || (declared.split(".").length < 3 && actual.startsWith(`${declared}.`));
  return {
    name: "bun",
    ok: matches,
    detail: matches
      ? `${actual} matches .mise.toml ${declared}`
      : `${actual} does not match .mise.toml ${declared}; install the declared toolchain`,
  };
}
