import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isE2EMode } from "@/lib/auth-utils";
import { createDb } from "@/lib/db";
import { trackPageView } from "@/lib/tracking";
import { createCache } from "@/lib/cache";
import { rateLimit } from "@/lib/rate-limit";

// Routes that require authentication
const PROTECTED_PREFIXES = ["/admin"];

// Match blog post URLs: /YYYY/MM/slug
const BLOG_POST_ROUTE = /^\/(?<year>\d{4})\/(?<month>\d{2})\/(?<slug>[^/]+)\/?$/;

// API routes that require authentication (write operations)
const PROTECTED_API_METHODS = ["POST", "PUT", "DELETE", "PATCH"];

// Process-level redirect cache (5-min TTL)
interface RedirectRow {
  id: string;
  source_path: string;
  target_path: string;
  status_code: number;
}
const redirectCache = createCache<Map<string, RedirectRow>>(5 * 60 * 1000);

/**
 * Check if Accept header explicitly rejects text/markdown (q=0).
 * Handles optional whitespace and preceding parameters per RFC 9110.
 */
function markdownRejected(accept: string): boolean {
  // Split on comma to get individual media-range entries
  for (const entry of accept.split(",")) {
    const trimmed = entry.trim();
    if (!trimmed.startsWith("text/markdown")) continue;
    // Check if this entry has q=0 (or q=0.0, q=0.000 etc.)
    if (/;\s*q\s*=\s*0(?:\.0+)?\s*(?:;|$)/.test(trimmed)) return true;
  }
  return false;
}

function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

// ---------------------------------------------------------------------------
// Public API rate limiting
// ---------------------------------------------------------------------------

const MCP_REGISTER_PATH = "/api/mcp/register";
const MCP_TOKEN_PATH = "/api/mcp/token";
// Per-minute caps for public endpoints. MCP registration is a sensitive
// onboarding action so it's throttled more aggressively.
const RATE_LIMIT_WINDOW_MS = 60_000;
const MCP_REGISTER_LIMIT = 10;
const MCP_TOKEN_LIMIT = 20;
const PUBLIC_API_LIMIT = 60;

interface RateLimitConfig {
  limit: number;
  windowMs: number;
}

/**
 * Decide whether a public API route should be rate-limited and, if so, with
 * which budget. Returns null when the route is exempt (auth, mcp other than
 * /register, or non-API paths).
 */
function getRateLimitConfig(
  pathname: string,
  method: string,
): RateLimitConfig | null {
  if (!pathname.startsWith("/api/")) return null;
  if (pathname.startsWith("/api/auth/")) return null;

  // /api/mcp/register: stricter cap. Only POST onboards a new client.
  if (pathname === MCP_REGISTER_PATH && method === "POST") {
    return { limit: MCP_REGISTER_LIMIT, windowMs: RATE_LIMIT_WINDOW_MS };
  }

  // /api/mcp/token: token exchange endpoint, rate-limited to prevent brute-force.
  if (pathname === MCP_TOKEN_PATH) {
    return { limit: MCP_TOKEN_LIMIT, windowMs: RATE_LIMIT_WINDOW_MS };
  }

  // All other /api/mcp routes are exempt (own auth + token-bound).
  if (pathname === "/api/mcp" || pathname.startsWith("/api/mcp/")) return null;

  return { limit: PUBLIC_API_LIMIT, windowMs: RATE_LIMIT_WINDOW_MS };
}

/**
 * Extract the client IP from x-forwarded-for (first value) or fall back to
 * x-real-ip. Returns "unknown" so all unidentified callers share a single
 * bucket — far better than skipping the limiter entirely.
 */
function extractClientIp(request: NextRequest): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = request.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

function isProtectedApiRoute(pathname: string, method: string): boolean {
  if (!pathname.startsWith("/api/")) return false;
  // Auth API routes are never protected (they handle auth themselves)
  if (pathname.startsWith("/api/auth/")) return false;
  // MCP registration requires admin auth
  if (pathname === "/api/mcp/register" && method === "POST") return true;
  // MCP has its own Bearer token auth — exempt both /api/mcp and /api/mcp/*
  if (pathname === "/api/mcp" || pathname.startsWith("/api/mcp/")) return false;
  // Admin API routes require auth for ALL methods (including GET)
  if (pathname.startsWith("/api/admin")) return true;
  // Analytics endpoints require admin auth for all methods (including GET)
  if (pathname.startsWith("/api/analytics")) return true;
  // Media endpoints require admin auth for all methods (including GET)
  if (pathname.startsWith("/api/media")) return true;
  // Backup endpoints require admin auth for all methods (including GET),
  // except the exact /api/backup/pull path which uses its own X-Webhook-Key auth.
  // IMPORTANT: Must NOT use startsWith("/api/backup/pull") — that would also
  // exempt /api/backup/pull-key, leaking the pull key to unauthenticated requests.
  if (pathname.startsWith("/api/backup")) {
    if (pathname === "/api/backup/pull") return false; // M2M, own auth
    return true;
  }
  return PROTECTED_API_METHODS.includes(method);
}

export async function proxy(request: NextRequest) {
  // --- HTTPS redirect: force HTTP → HTTPS in production ---
  // Skip when:
  // - No x-forwarded-proto (direct localhost access)
  // - Already HTTPS
  // - localhost/127.0.0.1 host (E2E tests, local dev)
  // - E2E mode explicitly enabled
  const proto = request.headers.get("x-forwarded-proto");
  const host = request.headers.get("host") ?? "";
  const isLocalhost = host.startsWith("localhost") || host.startsWith("127.0.0.1");
  if (
    proto === "http" &&
    process.env.NODE_ENV === "production" &&
    !isLocalhost &&
    !isE2EMode()
  ) {
    const url = request.nextUrl.clone();
    url.protocol = "https";
    return NextResponse.redirect(url, 301);
  }

  const { pathname } = request.nextUrl;
  const method = request.method;

  // Skip static assets and Next.js internals.
  // Exception: /index.php/* paths are WordPress legacy URLs that need redirect
  // lookup, so they must NOT be short-circuited here.
  if (
    pathname.startsWith("/_next/") ||
    (pathname.includes(".") && !pathname.startsWith("/index.php"))
  ) {
    return NextResponse.next();
  }

  // --- Markdown content negotiation: rewrite blog posts when Accept: text/markdown ---
  const accept = request.headers.get("accept") ?? "";
  if (accept.includes("text/markdown") && !markdownRejected(accept)) {
    // Homepage
    if (pathname === "/" || pathname === "") {
      const url = request.nextUrl.clone();
      url.pathname = "/api/md";
      const response = NextResponse.rewrite(url);
      response.headers.set("Vary", "Accept");
      return response;
    }

    const postMatch = pathname.match(BLOG_POST_ROUTE);
    if (postMatch?.groups) {
      const { year, month, slug } = postMatch.groups;
      const url = request.nextUrl.clone();
      url.pathname = `/api/md/${year}/${month}/${slug}`;
      const response = NextResponse.rewrite(url);
      response.headers.set("Vary", "Accept");
      return response;
    }
  }

  // --- Auth guard: protect admin routes and write API endpoints ---
  if (isProtectedRoute(pathname) || isProtectedApiRoute(pathname, method)) {
    // E2E auth bypass — only active when E2E_SKIP_AUTH is explicitly set.
    // Never set in production; .env.test sets it for local E2E runs.
    if (isE2EMode()) {
      return NextResponse.next();
    }

    const session = await auth();
    if (!session) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  // --- Rate limit: public API endpoints (post-auth, only public paths) ---
  // Protected routes have already returned above, so reaching this point
  // guarantees we're handling a public request.
  const rlConfig = getRateLimitConfig(pathname, method);
  if (rlConfig) {
    const ip = extractClientIp(request);
    const result = rateLimit(`${pathname}:${ip}`, rlConfig.limit, rlConfig.windowMs);
    if (!result.allowed) {
      const retryAfterSec = Math.max(1, Math.ceil(result.resetMs / 1000));
      return NextResponse.json(
        { error: "Too Many Requests" },
        {
          status: 429,
          headers: {
            "Retry-After": String(retryAfterSec),
            "X-RateLimit-Limit": String(rlConfig.limit),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(retryAfterSec),
          },
        },
      );
    }
  }

  // --- WordPress redirect lookup (public routes only) ---
  if (
    !pathname.startsWith("/api/") &&
    !pathname.startsWith("/login")
  ) {
    // Hard redirect: /feed → /feed.xml (RSS subscribers from WordPress era)
    if (pathname === "/feed" || pathname === "/feed/" ||
        pathname === "/index.php/feed" || pathname === "/index.php/feed/") {
      const url = request.nextUrl.clone();
      url.pathname = "/feed.xml";
      return NextResponse.redirect(url, 301);
    }

    try {
      const workerUrl = process.env.WORKER_URL;
      const workerSecret = process.env.WORKER_SECRET;

      if (workerUrl && workerSecret) {
        let map = redirectCache.get();
        if (!map) {
          const db = createDb(workerUrl, workerSecret);
          const { results } = await db.query<RedirectRow>(
            "SELECT id, source_path, target_path, status_code FROM redirects",
          );
          map = new Map(results.map((r) => [r.source_path, r]));
          redirectCache.set(map);
        }

        // Try exact match, then with trailing slash (WP URLs stored with slash)
        const redirect = map.get(pathname) ?? map.get(pathname + "/");
        if (redirect) {
          // Fire-and-forget: increment hit counter
          const db = createDb(workerUrl, workerSecret);
          db.execute(
            "UPDATE redirects SET hit_count = hit_count + 1 WHERE id = ?",
            [redirect.id],
          ).catch(() => {
            // Ignore errors on hit counter update
          });

          const url = request.nextUrl.clone();
          url.pathname = redirect.target_path;
          return NextResponse.redirect(url, redirect.status_code);
        }
      }
    } catch {
      // If redirect lookup fails, continue normally
    }
  }

  // --- Analytics: track public page views (fire-and-forget) ---
  if (
    !pathname.startsWith("/api/") &&
    !pathname.startsWith("/admin") &&
    !pathname.startsWith("/login")
  ) {
    trackPageView({
      path: pathname,
      userAgent: request.headers.get("user-agent"),
      ip:
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      referrer: request.headers.get("referer"),
      country: request.headers.get("cf-ipcountry") ?? null,
      city: request.headers.get("cf-ipcity") ?? null,
    }).catch(() => {
      // Never let analytics break the response
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all routes except static files
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** @internal — exposed for unit tests only */
export const _testHelpers = {
  isProtectedRoute,
  isProtectedApiRoute,
  markdownRejected,
  getRateLimitConfig,
  extractClientIp,
};
