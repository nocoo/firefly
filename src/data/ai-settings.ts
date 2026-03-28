import type { Db } from "@/lib/db";
import type { AiProvider, SdkType } from "@/services/ai";
import { buildSetClauses } from "@/data/core/sql";
import type { FieldDef } from "@/data/core/types";

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
// Field map (D5: camelCase → snake_case)
// ---------------------------------------------------------------------------

const fields: Record<string, FieldDef> = {
  provider: { column: "ai_provider" },
  apiKey: { column: "ai_api_key" },
  model: { column: "ai_model" },
  baseURL: { column: "ai_base_url" },
  sdkType: { column: "ai_sdk_type" },
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
  const { setClauses, params } = buildSetClauses(input, fields);

  if (setClauses.length === 0) {
    return getAiSettings(db);
  }

  setClauses.push("updated_at = unixepoch()");

  await db.execute(
    `UPDATE site_settings SET ${setClauses.join(", ")} WHERE id = 1`,
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
