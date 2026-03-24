import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { jsonResponse, errorResponse } from "@/lib/api";
import {
  getSiteSettings,
  updateSiteSettings,
  type UpdateSiteSettingsInput,
  type FontStyle,
} from "@/data/settings";
import { LOCALES } from "@/i18n/translations";

const FONT_STYLES: FontStyle[] = ["pingfang", "classic", "serif", "sans"];

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
    return errorResponse(
      error instanceof Error ? error.message : "Internal server error",
      500,
    );
  }
}

/**
 * PUT /api/settings — update site settings.
 * Protected by proxy (requires auth).
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const input: UpdateSiteSettingsInput = {};

    // Validate locale
    if (body.locale !== undefined) {
      if (!LOCALES.includes(body.locale)) {
        return errorResponse(`Invalid locale. Must be one of: ${LOCALES.join(", ")}`);
      }
      input.locale = body.locale;
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
      if (!FONT_STYLES.includes(body.fontStyle)) {
        return errorResponse(`Invalid fontStyle. Must be one of: ${FONT_STYLES.join(", ")}`);
      }
      input.fontStyle = body.fontStyle;
    }

    const db = getDb();
    const settings = await updateSiteSettings(db, input);
    return jsonResponse(settings);
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Internal server error",
      500,
    );
  }
}
