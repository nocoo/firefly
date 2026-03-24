import type { Db } from "@/lib/db";
import type { AiProvider, SdkType } from "@/services/ai";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Raw row shape from the DB (AI columns only) */
interface AiSettingsRow {
  ai_provider: string;
  ai_api_key: string;
  ai_model: string;
  ai_base_url: string;
  ai_sdk_type: string;
}

/** Parsed AI settings */
export interface AiSettings {
  provider: AiProvider | "";
  apiKey: string;
  model: string;
  baseURL: string;
  sdkType: SdkType | "";
}

const DEFAULTS: AiSettings = {
  provider: "",
  apiKey: "",
  model: "",
  baseURL: "",
  sdkType: "",
};

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

function parseRow(row: AiSettingsRow): AiSettings {
  return {
    provider: (row.ai_provider || "") as AiProvider | "",
    apiKey: row.ai_api_key || "",
    model: row.ai_model || "",
    baseURL: row.ai_base_url || "",
    sdkType: (row.ai_sdk_type || "") as SdkType | "",
  };
}

/**
 * Get AI settings from the singleton site_settings row.
 */
export async function getAiSettings(db: Db): Promise<AiSettings> {
  const row = await db.firstOrNull<AiSettingsRow>(
    "SELECT ai_provider, ai_api_key, ai_model, ai_base_url, ai_sdk_type FROM site_settings WHERE id = 1",
  );

  return row ? parseRow(row) : { ...DEFAULTS };
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

export interface UpdateAiSettingsInput {
  provider?: string;
  apiKey?: string;
  model?: string;
  baseURL?: string;
  sdkType?: string;
}

export async function updateAiSettings(
  db: Db,
  input: UpdateAiSettingsInput,
): Promise<AiSettings> {
  const sets: string[] = [];
  const params: unknown[] = [];

  if (input.provider !== undefined) {
    sets.push("ai_provider = ?");
    params.push(input.provider);
  }
  if (input.apiKey !== undefined) {
    sets.push("ai_api_key = ?");
    params.push(input.apiKey);
  }
  if (input.model !== undefined) {
    sets.push("ai_model = ?");
    params.push(input.model);
  }
  if (input.baseURL !== undefined) {
    sets.push("ai_base_url = ?");
    params.push(input.baseURL);
  }
  if (input.sdkType !== undefined) {
    sets.push("ai_sdk_type = ?");
    params.push(input.sdkType);
  }

  if (sets.length === 0) {
    return getAiSettings(db);
  }

  sets.push("updated_at = unixepoch()");

  await db.execute(
    `UPDATE site_settings SET ${sets.join(", ")} WHERE id = 1`,
    params,
  );

  return getAiSettings(db);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function maskApiKey(key: string): string {
  if (!key) return "";
  return `${"*".repeat(Math.max(0, key.length - 4))}${key.slice(-4)}`;
}

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** @internal — exposed for unit tests only */
export const _testHelpers = {
  parseRow,
  maskApiKey,
  DEFAULTS,
};
