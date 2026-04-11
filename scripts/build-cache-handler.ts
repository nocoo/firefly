#!/usr/bin/env bun
/**
 * Pre-build script: compile cache-handler.ts to cache-handler.js
 * This is needed because Next.js `next build` uses Node.js internally,
 * which cannot load .ts files directly.
 */
import { $ } from "bun";

const src = "src/lib/cache-handler.ts";
const out = "src/lib/cache-handler.js";

console.log(`▸ Compiling ${src} → ${out}...`);

await $`bun build ${src} --outfile=${out} --target=node --format=esm`;

console.log(`✓ Cache handler compiled`);
