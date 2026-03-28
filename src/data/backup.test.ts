import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Db } from "@/lib/db";
import { createMockDb } from "@/data/core/test-utils";
import {
  getBackyConfig,
  getBackyPullKey,
  saveBackyConfig,
  clearBackyConfig,
  saveBackyPullKey,
  clearBackyPullKey,
  verifyBackyPullKey,
} from "./backup";

// ---------------------------------------------------------------------------
// Mock DB
// ---------------------------------------------------------------------------


let db: Db;

beforeEach(() => {
  db = createMockDb();
});

// ---------------------------------------------------------------------------
// getBackyConfig
// ---------------------------------------------------------------------------

describe("getBackyConfig", () => {
  it("returns config when webhook URL is set", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue({
      backy_webhook_url: "https://backy.dev/api/webhook/abc",
      backy_api_key: "test-key-123",
    });

    const config = await getBackyConfig(db);
    expect(config).toEqual({
      webhookUrl: "https://backy.dev/api/webhook/abc",
      apiKey: "test-key-123",
    });
  });

  it("returns null when no row found", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue(null);
    expect(await getBackyConfig(db)).toBeNull();
  });

  it("returns null when webhook URL is empty", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue({
      backy_webhook_url: "",
      backy_api_key: "",
    });
    expect(await getBackyConfig(db)).toBeNull();
  });

  it("queries the correct columns", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue(null);
    await getBackyConfig(db);

    expect(db.firstOrNull).toHaveBeenCalledWith(
      expect.stringContaining("backy_webhook_url"),
    );
    expect(db.firstOrNull).toHaveBeenCalledWith(
      expect.stringContaining("backy_api_key"),
    );
  });
});

// ---------------------------------------------------------------------------
// getBackyPullKey
// ---------------------------------------------------------------------------

describe("getBackyPullKey", () => {
  it("returns key when set", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue({
      backy_pull_key: "uuid-key-123",
    });
    expect(await getBackyPullKey(db)).toBe("uuid-key-123");
  });

  it("returns null when no row found", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue(null);
    expect(await getBackyPullKey(db)).toBeNull();
  });

  it("returns null when key is empty", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue({ backy_pull_key: "" });
    expect(await getBackyPullKey(db)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// saveBackyConfig
// ---------------------------------------------------------------------------

describe("saveBackyConfig", () => {
  it("updates both columns and updated_at", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 1 });

    await saveBackyConfig(db, {
      webhookUrl: "https://backy.dev/api/webhook/abc",
      apiKey: "new-key",
    });

    expect(db.execute).toHaveBeenCalledWith(
      expect.stringContaining("backy_webhook_url"),
      ["https://backy.dev/api/webhook/abc", "new-key"],
    );
    expect(db.execute).toHaveBeenCalledWith(
      expect.stringContaining("updated_at"),
      expect.any(Array),
    );
  });
});

// ---------------------------------------------------------------------------
// clearBackyConfig
// ---------------------------------------------------------------------------

describe("clearBackyConfig", () => {
  it("clears both columns to empty strings", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 1 });
    await clearBackyConfig(db);

    expect(db.execute).toHaveBeenCalledWith(
      expect.stringContaining("backy_webhook_url = ''"),
    );
    expect(db.execute).toHaveBeenCalledWith(
      expect.stringContaining("backy_api_key = ''"),
    );
  });
});

// ---------------------------------------------------------------------------
// saveBackyPullKey
// ---------------------------------------------------------------------------

describe("saveBackyPullKey", () => {
  it("saves the key to site_settings", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 1 });
    await saveBackyPullKey(db, "new-pull-key");

    expect(db.execute).toHaveBeenCalledWith(
      expect.stringContaining("backy_pull_key"),
      ["new-pull-key"],
    );
  });
});

// ---------------------------------------------------------------------------
// clearBackyPullKey
// ---------------------------------------------------------------------------

describe("clearBackyPullKey", () => {
  it("clears the pull key to empty string", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 1 });
    await clearBackyPullKey(db);

    expect(db.execute).toHaveBeenCalledWith(
      expect.stringContaining("backy_pull_key = ''"),
    );
  });
});

// ---------------------------------------------------------------------------
// verifyBackyPullKey
// ---------------------------------------------------------------------------

describe("verifyBackyPullKey", () => {
  it("returns true when key matches stored value", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue({
      backy_pull_key: "valid-key",
    });
    expect(await verifyBackyPullKey(db, "valid-key")).toBe(true);
  });

  it("returns false when key does not match", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue({
      backy_pull_key: "stored-key",
    });
    expect(await verifyBackyPullKey(db, "wrong-key")).toBe(false);
  });

  it("returns false when no key is stored", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue({ backy_pull_key: "" });
    expect(await verifyBackyPullKey(db, "any-key")).toBe(false);
  });

  it("returns false when row is null", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue(null);
    expect(await verifyBackyPullKey(db, "any-key")).toBe(false);
  });

  it("returns false for empty key input", async () => {
    expect(await verifyBackyPullKey(db, "")).toBe(false);
    // Should not even query DB for empty key
    expect(db.firstOrNull).not.toHaveBeenCalled();
  });
});
