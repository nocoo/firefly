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

// ---------------------------------------------------------------------------
// Validation helpers — return null on success, an error message on failure.
// ---------------------------------------------------------------------------

/** Assign value if non-undefined and passes the validator; returns error or null. */
function assignString(
  source: Record<string, unknown>,
  key: string,
  target: UpdateSiteSettingsInput,
  fieldKey: keyof UpdateSiteSettingsInput,
  maxLen: number,
  required = false,
): string | null {
  if (source[key] === undefined) return null;
  const v = source[key];
  if (typeof v !== "string") return `${key} must be a string`;
  if (required && v.length === 0) return `${key} must be a non-empty string`;
  if (v.length > maxLen)
    return `${key} must be at most ${maxLen} characters`;
  (target as Record<string, unknown>)[fieldKey as string] = v;
  return null;
}

function validatePostsPerPage(
  body: Record<string, unknown>,
  input: UpdateSiteSettingsInput,
): string | null {
  if (body.postsPerPage === undefined) return null;
  const n = Number(body.postsPerPage);
  if (Number.isNaN(n) || !Number.isInteger(n)) {
    return "postsPerPage must be an integer";
  }
  input.postsPerPage = n;
  return null;
}

function validateCommentsEnabled(
  body: Record<string, unknown>,
  input: UpdateSiteSettingsInput,
): string | null {
  if (body.commentsEnabled === undefined) return null;
  if (typeof body.commentsEnabled !== "boolean") {
    return "commentsEnabled must be a boolean";
  }
  input.commentsEnabled = body.commentsEnabled;
  return null;
}

function validateFontStyle(
  body: Record<string, unknown>,
  input: UpdateSiteSettingsInput,
): string | null {
  if (body.fontStyle === undefined) return null;
  if (!FONT_STYLES.includes(body.fontStyle as FontStyle)) {
    return `Invalid fontStyle. Must be one of: ${FONT_STYLES.join(", ")}`;
  }
  input.fontStyle = body.fontStyle as FontStyle;
  return null;
}

function validateSocialLinks(
  body: Record<string, unknown>,
  input: UpdateSiteSettingsInput,
): string | null {
  if (body.socialLinks === undefined) return null;
  if (!Array.isArray(body.socialLinks)) {
    return "socialLinks must be an array";
  }
  for (const link of body.socialLinks) {
    if (
      typeof link !== "object" ||
      link === null ||
      typeof link.name !== "string" ||
      typeof link.url !== "string" ||
      typeof link.brand !== "string"
    ) {
      return "Each social link must have name, url, and brand as strings";
    }
  }
  input.socialLinks = body.socialLinks;
  return null;
}

/** Validate the full PUT body, returning either the input shape or an error string. */
function parseSettingsBody(
  body: Record<string, unknown>,
): UpdateSiteSettingsInput | string {
  const input: UpdateSiteSettingsInput = {};

  const stringFields: Array<{
    key: string;
    field: keyof UpdateSiteSettingsInput;
    maxLen: number;
    required?: boolean;
  }> = [
    { key: "siteName", field: "siteName", maxLen: 255, required: true },
    { key: "siteTagline", field: "siteTagline", maxLen: 500 },
    { key: "siteDescription", field: "siteDescription", maxLen: 1000 },
    { key: "siteAuthor", field: "siteAuthor", maxLen: 255 },
    { key: "authorEmail", field: "authorEmail", maxLen: 255 },
    { key: "twitterHandle", field: "twitterHandle", maxLen: 50 },
  ];

  const checks: Array<() => string | null> = [
    () => validatePostsPerPage(body, input),
    () => validateCommentsEnabled(body, input),
    () => validateFontStyle(body, input),
    ...stringFields.map(
      ({ key, field, maxLen, required }) =>
        () =>
          assignString(body, key, input, field, maxLen, required),
    ),
    () => validateSocialLinks(body, input),
  ];

  for (const check of checks) {
    const err = check();
    if (err) return err;
  }

  return input;
}

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

    const parsed = parseSettingsBody(body);
    if (typeof parsed === "string") return errorResponse(parsed);

    const db = getDb();
    const settings = await updateSiteSettings(db, parsed);
    return jsonResponse(settings);
  } catch (error) {
    return handleError(error);
  }
}
