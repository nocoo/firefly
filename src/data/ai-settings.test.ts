import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Db } from "@/lib/db";
import { createMockDb } from "@/data/core/test-utils";
import {
  getAiSettings,
  updateAiSettings,
  _testHelpers,
} from "./ai-settings";

const { parseRow, maskApiKey, DEFAULTS } = _testHelpers;

// ---------------------------------------------------------------------------
// Mock DB
// ---------------------------------------------------------------------------


const sampleRow = {
  ai_provider: "anthropic",
  ai_api_key: "sk-ant-test1234",
  ai_model: "claude-sonnet-4-20250514",
  ai_base_url: "",
  ai_sdk_type: "",
};

// ---------------------------------------------------------------------------
// parseRow
// ---------------------------------------------------------------------------

describe("parseRow", () => {
  it("parses a complete row", () => {
    expect(parseRow(sampleRow)).toEqual({
      provider: "anthropic",
      apiKey: "sk-ant-test1234",
      model: "claude-sonnet-4-20250514",
      baseURL: "",
      sdkType: "",
    });
  });

  it("parses a custom provider row", () => {
    expect(
      parseRow({
        ai_provider: "custom",
        ai_api_key: "sk-custom",
        ai_model: "my-model",
        ai_base_url: "https://my-api.example.com/v1",
        ai_sdk_type: "openai",
      }),
    ).toEqual({
      provider: "custom",
      apiKey: "sk-custom",
      model: "my-model",
      baseURL: "https://my-api.example.com/v1",
      sdkType: "openai",
    });
  });

  it("returns empty strings for empty values", () => {
    expect(
      parseRow({
        ai_provider: "",
        ai_api_key: "",
        ai_model: "",
        ai_base_url: "",
        ai_sdk_type: "",
      }),
    ).toEqual(DEFAULTS);
  });
});

// ---------------------------------------------------------------------------
// maskApiKey
// ---------------------------------------------------------------------------

describe("maskApiKey", () => {
  it("masks all but last 4 chars", () => {
    // "sk-ant-test1234" = 15 chars, 15-4=11 stars + last 4
    expect(maskApiKey("sk-ant-test1234")).toBe("***********1234");
  });

  it("returns empty for empty key", () => {
    expect(maskApiKey("")).toBe("");
  });

  it("handles short keys", () => {
    expect(maskApiKey("abcd")).toBe("abcd");
    expect(maskApiKey("abc")).toBe("abc");
  });
});

// ---------------------------------------------------------------------------
// getAiSettings
// ---------------------------------------------------------------------------

describe("getAiSettings", () => {
  let db: Db;

  beforeEach(() => {
    db = createMockDb();
  });

  it("fetches from DB and parses", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue(sampleRow);

    const result = await getAiSettings(db);
    expect(result.provider).toBe("anthropic");
    expect(result.apiKey).toBe("sk-ant-test1234");
    expect(result.model).toBe("claude-sonnet-4-20250514");
    expect(db.firstOrNull).toHaveBeenCalledOnce();
  });

  it("returns defaults when row is null", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue(null);

    const result = await getAiSettings(db);
    expect(result).toEqual(DEFAULTS);
  });
});

// ---------------------------------------------------------------------------
// updateAiSettings
// ---------------------------------------------------------------------------

describe("updateAiSettings", () => {
  let db: Db;

  beforeEach(() => {
    db = createMockDb();
  });

  it("updates provider", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 0 });
    vi.mocked(db.firstOrNull).mockResolvedValue({
      ...sampleRow,
      ai_provider: "glm",
    });

    const result = await updateAiSettings(db, { provider: "glm" });
    expect(result.provider).toBe("glm");

    const sql = vi.mocked(db.execute).mock.calls[0][0] as string;
    expect(sql).toContain("ai_provider = ?");
    expect(sql).toContain("updated_at = unixepoch()");
  });

  it("updates apiKey", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 0 });
    vi.mocked(db.firstOrNull).mockResolvedValue(sampleRow);

    await updateAiSettings(db, { apiKey: "new-key" });
    const params = vi.mocked(db.execute).mock.calls[0][1] as unknown[];
    expect(params).toContain("new-key");
  });

  it("updates multiple fields at once", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 0 });
    vi.mocked(db.firstOrNull).mockResolvedValue(sampleRow);

    await updateAiSettings(db, {
      provider: "custom",
      baseURL: "https://example.com",
      sdkType: "openai",
      model: "my-model",
    });

    const sql = vi.mocked(db.execute).mock.calls[0][0] as string;
    expect(sql).toContain("ai_provider = ?");
    expect(sql).toContain("ai_base_url = ?");
    expect(sql).toContain("ai_sdk_type = ?");
    expect(sql).toContain("ai_model = ?");
  });

  it("does nothing when input is empty", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue(sampleRow);

    await updateAiSettings(db, {});
    expect(db.execute).not.toHaveBeenCalled();
  });
});
