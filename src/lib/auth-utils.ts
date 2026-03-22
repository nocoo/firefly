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
