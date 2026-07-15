// ---------------------------------------------------------------------------
// Shared helpers for local E2E mode (filesystem R2 adapter + read route).
//
// Extracted so that both r2-client.ts (write/delete) and the __e2e-r2 route
// (read/serve) use the same gate and path-traversal protection — no drift.
// ---------------------------------------------------------------------------

import { resolve, normalize } from "node:path";

// ---------------------------------------------------------------------------
// Gate
// ---------------------------------------------------------------------------

/**
 * Whether R2 operations should go to a local directory instead of Cloudflare.
 * Gated by three conditions:
 *   1. E2E_R2_LOCAL_DIR env var is set (runner injects the path)
 *   2. E2E_SKIP_AUTH=true (E2E mode)
 *   3. E2E_TEST_RUNNER=true (set only by scripts/run-e2e.ts, never in
 *      real production — Next.js production builds set NODE_ENV=production
 *      even during E2E, so we use this runner-specific flag instead)
 */
export function isLocalE2EMode(): boolean {
  return !!(
    process.env.E2E_R2_LOCAL_DIR &&
    process.env.E2E_SKIP_AUTH === "true" &&
    process.env.E2E_TEST_RUNNER === "true"
  );
}

// ---------------------------------------------------------------------------
// Path resolution with traversal protection
// ---------------------------------------------------------------------------

/**
 * Validate and resolve an R2 key to a safe local filesystem path.
 * Rejects path traversal (../), absolute paths, backslashes, and any key
 * that resolves outside the E2E R2 root directory.
 *
 * @throws if E2E_R2_LOCAL_DIR is not set, or the key attempts traversal.
 */
export function resolveLocalR2Path(key: string): string {
  const localDir = process.env.E2E_R2_LOCAL_DIR;
  if (!localDir) {
    throw new Error("E2E_R2_LOCAL_DIR is not set");
  }

  // Reject obvious path traversal patterns
  if (key.includes("..") || key.startsWith("/") || key.includes("\\")) {
    throw new Error(
      `Invalid R2 key: path traversal or absolute path rejected: ${key}`,
    );
  }

  // Normalize and verify the resolved path stays within the root
  const root = resolve(localDir);
  const target = resolve(root, normalize(key));
  if (!target.startsWith(`${root}/`) && target !== root) {
    throw new Error(
      `Invalid R2 key: resolved path escapes local R2 root: ${key}`,
    );
  }

  return target;
}
