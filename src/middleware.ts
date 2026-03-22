import { NextRequest, NextResponse } from "next/server";
import { createDb } from "@/lib/db";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip API routes, static assets, and Next.js internals
  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/admin/") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Check for redirects from old WordPress URLs
  try {
    const workerUrl = process.env.WORKER_URL;
    const workerSecret = process.env.WORKER_SECRET;

    if (!workerUrl || !workerSecret) {
      return NextResponse.next();
    }

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
  } catch {
    // If redirect lookup fails, continue normally
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match WordPress-style URLs that might need redirecting
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
