import type { Db } from "@/lib/db";
import type { Locale } from "@/i18n/translations";

export type FontStyle = "pingfang" | "classic" | "serif" | "sans";
const FONT_STYLES: FontStyle[] = ["pingfang", "classic", "serif", "sans"];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Raw row shape from the DB */
interface SiteSettingsRow {
  id: number;
  locale: string;
  posts_per_page: number;
  comments_enabled: number;
  font_style: string;
  site_logo_version: string | null;
  updated_at: number;
}

/** Parsed application-level settings */
export interface SiteSettings {
  locale: Locale;
  postsPerPage: number;
  commentsEnabled: boolean;
  fontStyle: FontStyle;
  siteLogoVersion: string | null;
  updatedAt: number;
}

const DEFAULTS: SiteSettings = {
  locale: "zh",
  postsPerPage: 10,
  commentsEnabled: false,
  fontStyle: "pingfang",
  siteLogoVersion: null,
  updatedAt: 0,
};

// ---------------------------------------------------------------------------
// Process-level cache (TTL = 5 min)
// ---------------------------------------------------------------------------

let cached: SiteSettings | null = null;
let cachedAt = 0;
const TTL = 5 * 60 * 1000;

function parseRow(row: SiteSettingsRow): SiteSettings {
  return {
    locale: row.locale === "en" ? "en" : "zh",
    postsPerPage: row.posts_per_page > 0 ? row.posts_per_page : 10,
    commentsEnabled: row.comments_enabled === 1,
    fontStyle: FONT_STYLES.includes(row.font_style as FontStyle)
      ? (row.font_style as FontStyle)
      : "pingfang",
    siteLogoVersion: row.site_logo_version ?? null,
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
  locale?: Locale;
  postsPerPage?: number;
  commentsEnabled?: boolean;
  fontStyle?: FontStyle;
  // Note: siteLogoVersion is intentionally NOT here.
  // It is managed exclusively by updateSiteLogoVersion().
}

export async function updateSiteSettings(
  db: Db,
  input: UpdateSiteSettingsInput,
): Promise<SiteSettings> {
  const sets: string[] = [];
  const params: unknown[] = [];

  if (input.locale !== undefined) {
    sets.push("locale = ?");
    params.push(input.locale);
  }
  if (input.postsPerPage !== undefined) {
    sets.push("posts_per_page = ?");
    params.push(Math.max(1, Math.min(100, input.postsPerPage)));
  }
  if (input.commentsEnabled !== undefined) {
    sets.push("comments_enabled = ?");
    params.push(input.commentsEnabled ? 1 : 0);
  }
  if (input.fontStyle !== undefined) {
    sets.push("font_style = ?");
    params.push(input.fontStyle);
  }

  if (sets.length === 0) {
    return getSiteSettings(db);
  }

  sets.push("updated_at = unixepoch()");

  await db.execute(
    `UPDATE site_settings SET ${sets.join(", ")} WHERE id = 1`,
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
  DEFAULTS,
};
