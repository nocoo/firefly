import { type NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSiteSettings } from "@/data/settings";
import { getLogoUrl, type LogoSize } from "@/lib/logo";

const VALID_SIZES: LogoSize[] = [16, 32, 48, 180, 192, 512];
const DEFAULT_SIZE: LogoSize = 32;

/**
 * GET /api/favicon — dynamic favicon redirect.
 *
 * Query params:
 *   ?size=16|32|48|180|192|512 (default: 32)
 *
 * If a custom logo is configured (site_logo_version is set):
 *   → 302 redirect to the versioned R2 URL for the requested size.
 *
 * If no custom logo:
 *   → 302 redirect to /favicon.ico (static fallback for all sizes).
 */
export async function GET(request: NextRequest) {
  const sizeParam = request.nextUrl.searchParams.get("size");
  const parsedSize = sizeParam ? parseInt(sizeParam, 10) : NaN;
  const size: LogoSize = VALID_SIZES.includes(parsedSize as LogoSize)
    ? (parsedSize as LogoSize)
    : DEFAULT_SIZE;

  const db = getDb();
  const settings = await getSiteSettings(db);

  if (settings.siteLogoVersion) {
    const url = getLogoUrl(settings.siteLogoVersion, size);
    return NextResponse.redirect(url, 302);
  }

  // No custom logo — fallback to static favicon.ico
  const faviconUrl = new URL("/favicon.ico", request.nextUrl.origin);
  return NextResponse.redirect(faviconUrl, 302);
}
