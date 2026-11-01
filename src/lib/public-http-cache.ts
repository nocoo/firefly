/**
 * Shared Cache-Control for anonymous public blog content.
 * Aligns with `public-content` Data Cache revalidate (1h) while keeping
 * browser max-age short enough for reasonable freshness.
 */
export const PUBLIC_CONTENT_CACHE_CONTROL =
  "public, max-age=60, s-maxage=300, stale-while-revalidate=3600";

export const PRIVATE_NOCACHE =
  "private, no-store, max-age=0, must-revalidate";

const AUTH_SESSION_COOKIES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
  "next-auth.session-token",
  "__Secure-next-auth.session-token",
] as const;

const PUBLIC_API_GET_PREFIXES = [
  "/api/posts",
  "/api/md",
  "/api/settings",
  "/api/favicon",
  "/api/og",
] as const;

const PUBLIC_API_GET_EXACT = new Set([
  "/feed.xml",
  "/sitemap.xml",
  "/sitemap.xsl",
  "/llms.txt",
  "/robots.txt",
]);

const NOCACHE_API_PREFIXES = [
  "/api/admin",
  "/api/analytics",
  "/api/media",
  "/api/auth",
  "/api/mcp",
  "/api/backup",
  "/api/live",
  "/api/comments",
] as const;

export function hasAuthSessionCookie(
  cookieHeader: string | null | undefined,
): boolean {
  if (!cookieHeader) return false;
  return AUTH_SESSION_COOKIES.some((name) =>
    cookieHeader.includes(`${name}=`),
  );
}

function isStaticAssetPath(pathname: string): boolean {
  return pathname.startsWith("/_next/") || /\.[a-z0-9]+$/i.test(pathname);
}

function isProtectedHtmlPath(pathname: string): boolean {
  return (
    pathname.startsWith("/admin")
    || pathname.startsWith("/login")
    || pathname.startsWith("/preview")
    || pathname.startsWith("/podcast-post-preview")
  );
}

export function shouldCachePublicHtmlRequest(
  pathname: string,
  method: string,
  cookieHeader: string | null | undefined,
): boolean {
  if (method !== "GET" && method !== "HEAD") return false;
  if (pathname.startsWith("/api/")) return false;
  if (isProtectedHtmlPath(pathname)) return false;
  if (isStaticAssetPath(pathname)) return false;
  if (hasAuthSessionCookie(cookieHeader)) return false;
  return true;
}

export function shouldCachePublicApiGet(
  pathname: string,
  method: string,
): boolean {
  if (method !== "GET" && method !== "HEAD") return false;
  if (PUBLIC_API_GET_EXACT.has(pathname)) return true;
  if (NOCACHE_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return false;
  }
  return PUBLIC_API_GET_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function cacheControlForPublicApiGet(
  pathname: string,
  method: string,
): string | null {
  return shouldCachePublicApiGet(pathname, method)
    ? PUBLIC_CONTENT_CACHE_CONTROL
    : null;
}
