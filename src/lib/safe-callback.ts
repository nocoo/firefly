/**
 * Validate a `callbackUrl` query parameter for same-origin redirects.
 *
 * Rejects:
 *   - non-string / missing values
 *   - values not starting with "/"
 *   - protocol-relative URLs ("//evil.com") — these are accepted by a naive
 *     `startsWith("/")` check but cause cross-origin redirects (CWE-601)
 *   - backslash bypass ("/\evil.com") — some browsers normalize "\" to "/"
 */
export function isSafeCallbackPath(raw: unknown): raw is string {
  if (typeof raw !== "string") return false;
  if (!raw.startsWith("/")) return false;
  if (raw.startsWith("//")) return false;
  if (raw.startsWith("/\\")) return false;
  return true;
}

/**
 * Resolve a `callbackUrl` query parameter to a safe redirect target.
 * Falls back to `fallback` (default "/admin") when validation fails.
 */
export function resolveCallbackUrl(raw: unknown, fallback = "/admin"): string {
  return isSafeCallbackPath(raw) ? raw : fallback;
}
