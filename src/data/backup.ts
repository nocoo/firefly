import type { Db } from "@/lib/db";
import type { BackyConfig } from "@/models/backup";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Raw Backy columns from site_settings */
interface BackyConfigRow {
  backy_webhook_url: string;
  backy_api_key: string;
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/**
 * Get Backy push configuration from site_settings.
 * Returns null if no webhook URL is configured.
 */
export async function getBackyConfig(db: Db): Promise<BackyConfig | null> {
  const row = await db.firstOrNull<BackyConfigRow>(
    "SELECT backy_webhook_url, backy_api_key FROM site_settings WHERE id = 1",
  );

  if (!row || !row.backy_webhook_url) return null;

  return {
    webhookUrl: row.backy_webhook_url,
    apiKey: row.backy_api_key,
  };
}

/**
 * Get the Backy pull webhook key from site_settings.
 * Returns null if no key is configured.
 */
export async function getBackyPullKey(db: Db): Promise<string | null> {
  const row = await db.firstOrNull<{ backy_pull_key: string }>(
    "SELECT backy_pull_key FROM site_settings WHERE id = 1",
  );

  if (!row || !row.backy_pull_key) return null;
  return row.backy_pull_key;
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

/** Save Backy push configuration to site_settings. */
export async function saveBackyConfig(
  db: Db,
  config: BackyConfig,
): Promise<void> {
  await db.execute(
    "UPDATE site_settings SET backy_webhook_url = ?, backy_api_key = ?, updated_at = unixepoch() WHERE id = 1",
    [config.webhookUrl, config.apiKey],
  );
}

/** Clear Backy push configuration from site_settings. */
export async function clearBackyConfig(db: Db): Promise<void> {
  await db.execute(
    "UPDATE site_settings SET backy_webhook_url = '', backy_api_key = '', updated_at = unixepoch() WHERE id = 1",
  );
}

/** Save a pull webhook key to site_settings. */
export async function saveBackyPullKey(
  db: Db,
  key: string,
): Promise<void> {
  await db.execute(
    "UPDATE site_settings SET backy_pull_key = ?, updated_at = unixepoch() WHERE id = 1",
    [key],
  );
}

/** Clear the pull webhook key from site_settings. */
export async function clearBackyPullKey(db: Db): Promise<void> {
  await db.execute(
    "UPDATE site_settings SET backy_pull_key = '', updated_at = unixepoch() WHERE id = 1",
  );
}

// ---------------------------------------------------------------------------
// Pull key verification (for pull route — no session auth)
// ---------------------------------------------------------------------------

/**
 * Verify a pull webhook key against the stored value.
 * Returns true only if a non-empty key is stored AND matches.
 */
export async function verifyBackyPullKey(
  db: Db,
  key: string,
): Promise<boolean> {
  if (!key) return false;

  const stored = await getBackyPullKey(db);
  if (!stored) return false;

  return stored === key;
}
