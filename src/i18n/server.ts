import { getDb } from "@/lib/db";
import { getSiteSettings } from "@/data/settings";
import type { Locale } from "./translations";

/**
 * Read the site's locale from DB-backed settings (process-cached).
 * No longer reads cookies — locale is a site-wide setting configured in admin.
 */
export async function getLocale(): Promise<Locale> {
  const db = getDb();
  const settings = await getSiteSettings(db);
  return settings.locale;
}
