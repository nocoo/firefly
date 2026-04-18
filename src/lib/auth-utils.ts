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
 * Production guard: even if `E2E_SKIP_AUTH=true` somehow leaks into a
 * production environment, this returns false so auth is never bypassed.
 *
 * Exception: CI environments (CI=true) are allowed to bypass auth even
 * in production mode, because E2E tests use production builds.
 */
export function isE2EMode(): boolean {
  if (process.env.E2E_SKIP_AUTH !== "true") return false;
  // Allow in development/test mode
  if (process.env.NODE_ENV !== "production") return true;
  // Allow in CI environment (E2E tests use production builds)
  if (process.env.CI === "true") return true;
  return false;
}
