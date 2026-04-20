import { NextRequest } from "next/server";
import { getDb, DbError } from "@/lib/db";
import { jsonResponse, errorResponse } from "@/lib/api";
import {
  getSiteSettings,
  updateSiteSettings,
  type UpdateSiteSettingsInput,
  type FontStyle,
} from "@/data/settings";

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

    // Validate siteName
    if (body.siteName !== undefined) {
      if (typeof body.siteName !== "string" || body.siteName.length === 0) {
        return errorResponse("siteName must be a non-empty string");
      }
      if (body.siteName.length > 255) {
        return errorResponse("siteName must be at most 255 characters");
      }
      input.siteName = body.siteName;
    }

    // Validate siteTagline
    if (body.siteTagline !== undefined) {
      if (typeof body.siteTagline !== "string") {
        return errorResponse("siteTagline must be a string");
      }
      if (body.siteTagline.length > 500) {
        return errorResponse("siteTagline must be at most 500 characters");
      }
      input.siteTagline = body.siteTagline;
    }

    // Validate siteDescription
    if (body.siteDescription !== undefined) {
      if (typeof body.siteDescription !== "string") {
        return errorResponse("siteDescription must be a string");
      }
      if (body.siteDescription.length > 1000) {
        return errorResponse("siteDescription must be at most 1000 characters");
      }
      input.siteDescription = body.siteDescription;
    }

    // Validate siteAuthor
    if (body.siteAuthor !== undefined) {
      if (typeof body.siteAuthor !== "string") {
        return errorResponse("siteAuthor must be a string");
      }
      if (body.siteAuthor.length > 255) {
        return errorResponse("siteAuthor must be at most 255 characters");
      }
      input.siteAuthor = body.siteAuthor;
    }

    // Validate authorEmail
    if (body.authorEmail !== undefined) {
      if (typeof body.authorEmail !== "string") {
        return errorResponse("authorEmail must be a string");
      }
      if (body.authorEmail.length > 255) {
        return errorResponse("authorEmail must be at most 255 characters");
      }
      input.authorEmail = body.authorEmail;
    }

    // Validate twitterHandle
    if (body.twitterHandle !== undefined) {
      if (typeof body.twitterHandle !== "string") {
        return errorResponse("twitterHandle must be a string");
      }
      if (body.twitterHandle.length > 50) {
        return errorResponse("twitterHandle must be at most 50 characters");
      }
      input.twitterHandle = body.twitterHandle;
    }

    // Validate socialLinks
    if (body.socialLinks !== undefined) {
      if (!Array.isArray(body.socialLinks)) {
        return errorResponse("socialLinks must be an array");
      }
      for (const link of body.socialLinks) {
        if (
          typeof link !== "object" ||
          link === null ||
          typeof link.name !== "string" ||
          typeof link.url !== "string" ||
          typeof link.brand !== "string"
        ) {
          return errorResponse(
            "Each social link must have name, url, and brand as strings",
          );
        }
      }
      input.socialLinks = body.socialLinks;
    }

    const db = getDb();
    const settings = await updateSiteSettings(db, input);
    return jsonResponse(settings);
  } catch (error) {
    return handleError(error);
  }
}
