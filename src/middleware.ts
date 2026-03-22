import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createDb } from "@/lib/db";
import { trackPageView } from "@/lib/tracking";

// Routes that require authentication
const PROTECTED_PREFIXES = ["/admin"];

// API routes that require authentication (write operations)
const PROTECTED_API_METHODS = ["POST", "PUT", "DELETE", "PATCH"];

function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isProtectedApiRoute(pathname: string, method: string): boolean {
  if (!pathname.startsWith("/api/")) return false;
  // Auth API routes are never protected (they handle auth themselves)
  if (pathname.startsWith("/api/auth/")) return false;
  return PROTECTED_API_METHODS.includes(method);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method;

  // Skip static assets and Next.js internals
  if (pathname.startsWith("/_next/") || pathname.includes(".")) {
    return NextResponse.next();
  }

  // --- Auth guard: protect admin routes and write API endpoints ---
  if (isProtectedRoute(pathname) || isProtectedApiRoute(pathname, method)) {
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

  // --- WordPress redirect lookup (public routes only) ---
  if (
    !pathname.startsWith("/api/") &&
    !pathname.startsWith("/login")
  ) {
    try {
      const workerUrl = process.env.WORKER_URL;
      const workerSecret = process.env.WORKER_SECRET;

      if (workerUrl && workerSecret) {
        const db = createDb(workerUrl, workerSecret);
        const redirect = await db.firstOrNull<{
          id: string;
          target_path: string;
          status_code: number;
        }>(
          "SELECT id, target_path, status_code FROM redirects WHERE source_path = ?",
          [pathname],
        );

        if (redirect) {
          // Fire-and-forget: increment hit counter
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
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        request.ip ??
        null,
      referrer: request.headers.get("referer"),
      country:
        request.headers.get("cf-ipcountry") ??
        request.geo?.country ??
        null,
      city: request.geo?.city ?? null,
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
