#!/usr/bin/env bun
/**
 * DB migration CLI for Firefly.
 *
 * Usage:
 *   bun scripts/migrations/migrate.ts up [--target prod|local]
 *   bun scripts/migrations/migrate.ts status [--target prod|local]
 *
 * Default target is "prod".
 */
import { applyAll, status } from "./runner.ts";

const args = process.argv.slice(2);
const command = args.find((a) => !a.startsWith("--")) ?? "up";
const targetIdx = args.indexOf("--target");
const target = targetIdx >= 0 ? args[targetIdx + 1] : "prod";

const VALID_TARGETS = ["prod", "local"];

if (!VALID_TARGETS.includes(target)) {
  console.error(
    `Invalid target: "${target}". Use one of: ${VALID_TARGETS.join(", ")}`,
  );
  process.exit(1);
}

const t = target as "prod" | "local";

if (command === "status") {
  await status(t);
} else if (command === "up") {
  const result = await applyAll(t);

  if (result.warnings.length) {
    console.warn(`\n⚠️  ${result.warnings.length} warning(s):`);
    for (const w of result.warnings) {
      console.warn(`   ${w}`);
    }
  }

  console.log(
    `\n✓ ${result.applied.length} applied, ${result.skipped.length} skipped`,
  );
} else {
  console.error(`Unknown command: "${command}". Use "up" or "status".`);
  process.exit(1);
}
