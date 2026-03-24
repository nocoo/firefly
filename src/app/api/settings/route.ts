import { NextRequest } from "next/server";
import { getDb, DbError } from "@/lib/db";
import { jsonResponse, errorResponse } from "@/lib/api";
import {
  getSiteSettings,
  updateSiteSettings,
  type UpdateSiteSettingsInput,
  type FontStyle,
} from "@/data/settings";
import { LOCALES, type Locale } from "@/i18n/translations";

const FONT_STYLES: FontStyle[] = ["pingfang", "classic", "serif", "sans"];

function handleError(error: unknown) {
  if (error instanceof DbError) {
    return errorResponse(error.message, error.status ?? 500);
  }
  console.error("Settings API error:", error);
  return errorResponse("Internal server error", 500);
}

/**
 * GET /api/settings — return current site settings.
 * Protected by proxy (requires auth).
 */
export async function GET() {
  try {
    const db = getDb();
    const settings = await getSiteSettings(db);
    return jsonResponse(settings);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * PUT /api/settings — update site settings.
 * Protected by proxy (requires auth).
 */
export async function PUT(request: NextRequest) {
  try {
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return errorResponse("Invalid JSON body");
    }

    const input: UpdateSiteSettingsInput = {};

    // Validate locale
    if (body.locale !== undefined) {
      if (!LOCALES.includes(body.locale as Locale)) {
        return errorResponse(`Invalid locale. Must be one of: ${LOCALES.join(", ")}`);
      }
      input.locale = body.locale as Locale;
    }

    // Validate postsPerPage
    if (body.postsPerPage !== undefined) {
      const n = Number(body.postsPerPage);
      if (Number.isNaN(n) || !Number.isInteger(n)) {
        return errorResponse("postsPerPage must be an integer");
      }
      input.postsPerPage = n;
    }

    // Validate commentsEnabled
    if (body.commentsEnabled !== undefined) {
      if (typeof body.commentsEnabled !== "boolean") {
        return errorResponse("commentsEnabled must be a boolean");
      }
      input.commentsEnabled = body.commentsEnabled;
    }

    // Validate fontStyle
    if (body.fontStyle !== undefined) {
      if (!FONT_STYLES.includes(body.fontStyle as FontStyle)) {
        return errorResponse(`Invalid fontStyle. Must be one of: ${FONT_STYLES.join(", ")}`);
      }
      input.fontStyle = body.fontStyle as FontStyle;
    }

    const db = getDb();
    const settings = await updateSiteSettings(db, input);
    return jsonResponse(settings);
  } catch (error) {
    return handleError(error);
  }
}
