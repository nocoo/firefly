// Pure business logic for Backy remote backup integration — no React, no DOM.

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Backy configuration stored in site_settings */
export interface BackyConfig {
  webhookUrl: string;
  apiKey: string;
}

/** Validation result from validateBackyConfig */
export type ValidationResult =
  | { valid: true }
  | { valid: false; error: string };

/** Backy backup history response from the remote API */
export interface BackyHistoryResponse {
  project_name: string;
  environment: string | null;
  total_backups: number;
  recent_backups: BackyBackupEntry[];
}

/** A single backup entry in the history */
export interface BackyBackupEntry {
  id: string;
  tag: string;
  environment: string;
  file_size: number;
  is_single_json: number;
  created_at: string;
}

/** Detailed push result with request metadata and timing */
export interface BackyPushDetail {
  ok: boolean;
  message: string;
  /** Duration of the push in milliseconds */
  durationMs?: number;
  request?: {
    tag: string;
    fileName: string;
    fileSizeBytes: number;
    backupStats: Record<string, number>;
  };
  response?: {
    status: number;
    body: unknown;
  };
  /** Backup history fetched inline on push success (avoids extra round-trip) */
  history?: BackyHistoryResponse | undefined;
}

/** Entity counts used to build backup tag */
export interface BackupCounts {
  posts: number;
  categories: number;
  tags: number;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/** Check whether a string looks like a valid Backy webhook URL */
export function isValidWebhookUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * Validate Backy config.
 *
 * @param config      Partial config to validate
 * @param requireApiKey  When false, apiKey may be omitted (update scenario).
 *                       Defaults to true (create scenario).
 */
export function validateBackyConfig(
  config: Partial<BackyConfig>,
  requireApiKey = true,
): ValidationResult {
  if (!config.webhookUrl?.trim()) {
    return { valid: false, error: "Webhook URL is required" };
  }
  if (!isValidWebhookUrl(config.webhookUrl)) {
    return { valid: false, error: "Webhook URL is not a valid URL" };
  }
  if (requireApiKey && !config.apiKey?.trim()) {
    return { valid: false, error: "API Key is required" };
  }
  return { valid: true };
}

// ---------------------------------------------------------------------------
// API key masking
// ---------------------------------------------------------------------------

/**
 * Mask an API key for display: show first 4 and last 4 chars, mask the rest.
 * Keys shorter than 10 chars are fully masked.
 */
export function maskApiKey(key: string): string {
  if (key.length < 10) return "\u2022".repeat(key.length);
  return (
    key.slice(0, 4) + "\u2022".repeat(key.length - 8) + key.slice(-4)
  );
}

// ---------------------------------------------------------------------------
// Environment detection
// ---------------------------------------------------------------------------

/** Derive the environment string from NODE_ENV */
export function getBackyEnvironment(): "prod" | "dev" {
  return process.env.NODE_ENV === "production" ? "prod" : "dev";
}

// ---------------------------------------------------------------------------
// Backup tag builder
// ---------------------------------------------------------------------------

/**
 * Build a Backy backup tag in the format:
 * v{version}-{datetime}-{rand4}-{posts}post-{cats}cat-{tags}tag
 *
 * @param version  App version (e.g. "1.4.0")
 * @param counts   Object with posts, categories, tags counts
 * @param rand     4-char random suffix for uniqueness
 * @param date     Optional ISO date string (defaults to now, seconds precision)
 */
export function buildBackyTag(
  version: string,
  counts: BackupCounts,
  rand: string,
  date?: string,
): string {
  const d =
    date ??
    new Date()
      .toISOString()
      .slice(0, 19) // YYYY-MM-DDTHH:mm:ss
      .replaceAll(":", "-"); // YYYY-MM-DDTHH-mm-ss
  return `v${version}-${d}-${rand}-${counts.posts}post-${counts.categories}cat-${counts.tags}tag`;
}

// ---------------------------------------------------------------------------
// File size formatting
// ---------------------------------------------------------------------------

/** Format a byte count to a human-readable string (e.g. "1.2 MB") */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ---------------------------------------------------------------------------
// Time formatting
// ---------------------------------------------------------------------------

/** Format a date string as a relative time (e.g. "3 days ago") */
export function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}
