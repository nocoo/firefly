import type { Db } from "@/lib/db";
import type { Locale } from "@/i18n/translations";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Raw row shape from the DB */
interface SiteSettingsRow {
  id: number;
  locale: string;
  posts_per_page: number;
  comments_enabled: number;
  updated_at: number;
}

/** Parsed application-level settings */
export interface SiteSettings {
  locale: Locale;
  postsPerPage: number;
  commentsEnabled: boolean;
  updatedAt: number;
}

const DEFAULTS: SiteSettings = {
  locale: "zh",
  postsPerPage: 10,
  commentsEnabled: false,
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
// Test helpers
// ---------------------------------------------------------------------------

/** @internal — exposed for unit tests only */
export const _testHelpers = {
  parseRow,
  DEFAULTS,
};
