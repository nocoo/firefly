/**
 * Email whitelist utilities for authentication.
 * Separated from auth.ts to allow testing without next-auth imports.
 */

/**
 * Parse allowed emails from AUTH_ALLOWED_EMAILS env var.
 * Comma-separated, trimmed, lowercased.
 */
export function getAllowedEmails(): string[] {
  const raw = process.env.AUTH_ALLOWED_EMAILS ?? "";
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Check if an email is in the allowed whitelist.
 */
export function isEmailAllowed(email: string): boolean {
  const allowed = getAllowedEmails();
  if (allowed.length === 0) return false;
  return allowed.includes(email.toLowerCase());
}

/**
 * Whether the E2E auth bypass is active.
 *
 * Production guard: even if `E2E_SKIP_AUTH` somehow leaks into a
 * production environment, this returns false so auth is never bypassed.
 *
 * `next start` forces NODE_ENV=production, so we cannot gate on NODE_ENV
 * alone. Instead we require both E2E_SKIP_AUTH=true AND E2E_TEST_RUNNER=true.
 * The latter is set exclusively by scripts/run-e2e.ts — it will never
 * appear in a real production deployment.
 */
export function isE2EMode(): boolean {
  return (
    process.env.E2E_SKIP_AUTH === "true" &&
    process.env.E2E_TEST_RUNNER === "true"
  );
}
