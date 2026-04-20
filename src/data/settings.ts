import type { Db } from "@/lib/db";
import { buildSetClauses } from "@/data/core/sql";
import type { FieldDef } from "@/data/core/types";

export type FontStyle = "pingfang" | "classic" | "serif" | "sans";
const FONT_STYLES: FontStyle[] = ["pingfang", "classic", "serif", "sans"];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A social link entry stored as JSON in the DB. */
export interface SocialLink {
  name: string;
  url: string;
  brand: string;
}

/** Raw row shape from the DB */
interface SiteSettingsRow {
  id: number;
  posts_per_page: number;
  comments_enabled: number;
  font_style: string;
  site_logo_version: string | null;
  site_name: string;
  site_tagline: string;
  site_description: string;
  site_author: string;
  author_email: string;
  twitter_handle: string;
  social_links: string;
  updated_at: number;
}

/** Parsed application-level settings */
export interface SiteSettings {
  postsPerPage: number;
  commentsEnabled: boolean;
  fontStyle: FontStyle;
  siteLogoVersion: string | null;
  siteName: string;
  siteTagline: string;
  siteDescription: string;
  siteAuthor: string;
  authorEmail: string;
  twitterHandle: string;
  socialLinks: SocialLink[];
  updatedAt: number;
}

const DEFAULTS: SiteSettings = {
  postsPerPage: 10,
  commentsEnabled: false,
  fontStyle: "pingfang",
  siteLogoVersion: null,
  siteName: "My Blog",
  siteTagline: "",
  siteDescription: "",
  siteAuthor: "",
  authorEmail: "",
  twitterHandle: "",
  socialLinks: [],
  updatedAt: 0,
};

// ---------------------------------------------------------------------------
// Process-level cache (TTL = 5 min)
// ---------------------------------------------------------------------------

let cached: SiteSettings | null = null;
let cachedAt = 0;
const TTL = 5 * 60 * 1000;

function parseSocialLinks(raw: string): SocialLink[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is SocialLink =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as SocialLink).name === "string" &&
        typeof (item as SocialLink).url === "string" &&
        typeof (item as SocialLink).brand === "string",
    );
  } catch {
    return [];
  }
}

function parseRow(row: SiteSettingsRow): SiteSettings {
  return {
    postsPerPage: row.posts_per_page > 0 ? row.posts_per_page : 10,
    commentsEnabled: row.comments_enabled === 1,
    fontStyle: FONT_STYLES.includes(row.font_style as FontStyle)
      ? (row.font_style as FontStyle)
      : "pingfang",
    siteLogoVersion: row.site_logo_version ?? null,
    siteName: row.site_name || "My Blog",
    siteTagline: row.site_tagline ?? "",
    siteDescription: row.site_description ?? "",
    siteAuthor: row.site_author ?? "",
    authorEmail: row.author_email ?? "",
    twitterHandle: row.twitter_handle ?? "",
    socialLinks: parseSocialLinks(row.social_links),
    updatedAt: row.updated_at,
  };
}

/**
 * Get site settings with process-level caching.
 * Cache is invalidated after TTL or by calling `invalidateSettingsCache()`.
 */
export async function getSiteSettings(db: Db): Promise<SiteSettings> {
  if (cached && Date.now() - cachedAt < TTL) return cached;

  const row = await db.firstOrNull<SiteSettingsRow>(
    "SELECT * FROM site_settings WHERE id = 1",
  );

  cached = row ? parseRow(row) : { ...DEFAULTS };
  cachedAt = Date.now();
  return cached;
}

/** Force next `getSiteSettings` call to re-fetch from DB. */
export function invalidateSettingsCache(): void {
  cached = null;
  cachedAt = 0;
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

export interface UpdateSiteSettingsInput {
  postsPerPage?: number;
  commentsEnabled?: boolean;
  fontStyle?: FontStyle;
  siteName?: string;
  siteTagline?: string;
  siteDescription?: string;
  siteAuthor?: string;
  authorEmail?: string;
  twitterHandle?: string;
  socialLinks?: SocialLink[];
  // Note: siteLogoVersion is intentionally NOT here.
  // It is managed exclusively by updateSiteLogoVersion().
}

// Field map for buildSetClauses (D5: camelCase → snake_case)
const settingsFields: Record<string, FieldDef> = {
  postsPerPage: { column: "posts_per_page" },
  commentsEnabled: { column: "comments_enabled" },
  fontStyle: { column: "font_style" },
  siteName: { column: "site_name" },
  siteTagline: { column: "site_tagline" },
  siteDescription: { column: "site_description" },
  siteAuthor: { column: "site_author" },
  authorEmail: { column: "author_email" },
  twitterHandle: { column: "twitter_handle" },
  socialLinks: { column: "social_links" },
};

/**
 * Normalize input values before building SET clauses.
 * Applies clamping, slicing, bool→int, and JSON.stringify.
 */
function normalizeSettingsInput(
  input: UpdateSiteSettingsInput,
): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};

  if (input.postsPerPage !== undefined) {
    normalized.postsPerPage = Math.max(1, Math.min(100, input.postsPerPage));
  }
  if (input.commentsEnabled !== undefined) {
    normalized.commentsEnabled = input.commentsEnabled ? 1 : 0;
  }
  if (input.fontStyle !== undefined) normalized.fontStyle = input.fontStyle;
  if (input.siteName !== undefined) normalized.siteName = input.siteName.slice(0, 255);
  if (input.siteTagline !== undefined) normalized.siteTagline = input.siteTagline.slice(0, 500);
  if (input.siteDescription !== undefined) normalized.siteDescription = input.siteDescription.slice(0, 1000);
  if (input.siteAuthor !== undefined) normalized.siteAuthor = input.siteAuthor.slice(0, 255);
  if (input.authorEmail !== undefined) normalized.authorEmail = input.authorEmail.slice(0, 255);
  if (input.twitterHandle !== undefined) normalized.twitterHandle = input.twitterHandle.slice(0, 50);
  if (input.socialLinks !== undefined) normalized.socialLinks = JSON.stringify(input.socialLinks);

  return normalized;
}

export async function updateSiteSettings(
  db: Db,
  input: UpdateSiteSettingsInput,
): Promise<SiteSettings> {
  const normalized = normalizeSettingsInput(input);
  const { setClauses, params } = buildSetClauses(normalized, settingsFields);

  if (setClauses.length === 0) {
    return getSiteSettings(db);
  }

  setClauses.push("updated_at = unixepoch()");

  await db.execute(
    `UPDATE site_settings SET ${setClauses.join(", ")} WHERE id = 1`,
    params,
  );

  invalidateSettingsCache();
  return getSiteSettings(db);
}

// ---------------------------------------------------------------------------
// Site logo version (dedicated writer)
// ---------------------------------------------------------------------------

/**
 * Update the site logo version. Pass null to remove the custom logo.
 * This is the only way to change `site_logo_version` — the general
 * `updateSiteSettings()` does not accept it.
 */
export async function updateSiteLogoVersion(
  db: Db,
  version: string | null,
): Promise<SiteSettings> {
  await db.execute(
    "UPDATE site_settings SET site_logo_version = ?, updated_at = unixepoch() WHERE id = 1",
    [version],
  );

  invalidateSettingsCache();
  return getSiteSettings(db);
}

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** @internal — exposed for unit tests only */
export const _testHelpers = {
  parseRow,
  parseSocialLinks,
  DEFAULTS,
};
