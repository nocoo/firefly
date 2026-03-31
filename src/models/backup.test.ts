import { describe, it, expect, vi, afterEach } from "vitest";
import {
  isValidWebhookUrl,
  validateBackyConfig,
  maskApiKey,
  getBackyEnvironment,
  buildBackyTag,
  formatFileSize,
  formatTimeAgo,
} from "./backup";

// ---------------------------------------------------------------------------
// isValidWebhookUrl
// ---------------------------------------------------------------------------

describe("isValidWebhookUrl", () => {
  it("accepts valid HTTPS URL", () => {
    expect(isValidWebhookUrl("https://example.com/api/webhook/abc")).toBe(
      true,
    );
  });

  it("accepts valid HTTP URL", () => {
    expect(isValidWebhookUrl("http://localhost:3000/webhook")).toBe(true);
  });

  it("rejects empty string", () => {
    expect(isValidWebhookUrl("")).toBe(false);
  });

  it("rejects non-URL string", () => {
    expect(isValidWebhookUrl("not-a-url")).toBe(false);
  });

  it("rejects FTP protocol", () => {
    expect(isValidWebhookUrl("ftp://example.com/backup")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validateBackyConfig
// ---------------------------------------------------------------------------

describe("validateBackyConfig", () => {
  it("returns valid for complete config", () => {
    const result = validateBackyConfig({
      webhookUrl: "https://example.com/api/webhook/abc",
      apiKey: "test-api-key-12345",
    });
    expect(result).toEqual({ valid: true });
  });

  it("rejects missing webhookUrl", () => {
    const result = validateBackyConfig({ apiKey: "key" });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toContain("Webhook URL");
  });

  it("rejects empty webhookUrl", () => {
    const result = validateBackyConfig({ webhookUrl: "  ", apiKey: "key" });
    expect(result.valid).toBe(false);
  });

  it("rejects invalid webhookUrl format", () => {
    const result = validateBackyConfig({
      webhookUrl: "not-valid",
      apiKey: "key",
    });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toContain("valid URL");
  });

  it("rejects missing apiKey when requireApiKey is true (default)", () => {
    const result = validateBackyConfig({
      webhookUrl: "https://example.com",
    });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toContain("API Key");
  });

  it("rejects empty apiKey when requireApiKey is true", () => {
    const result = validateBackyConfig({
      webhookUrl: "https://example.com",
      apiKey: "   ",
    });
    expect(result.valid).toBe(false);
  });

  it("allows missing apiKey when requireApiKey is false (update mode)", () => {
    const result = validateBackyConfig(
      { webhookUrl: "https://example.com" },
      false,
    );
    expect(result).toEqual({ valid: true });
  });

  it("allows empty apiKey when requireApiKey is false", () => {
    const result = validateBackyConfig(
      { webhookUrl: "https://example.com", apiKey: "" },
      false,
    );
    expect(result).toEqual({ valid: true });
  });

  it("still validates webhookUrl when requireApiKey is false", () => {
    const result = validateBackyConfig({ webhookUrl: "not-valid" }, false);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toContain("valid URL");
  });
});

// ---------------------------------------------------------------------------
// maskApiKey
// ---------------------------------------------------------------------------

describe("maskApiKey", () => {
  it("fully masks keys shorter than 10 chars", () => {
    expect(maskApiKey("short")).toBe("\u2022\u2022\u2022\u2022\u2022");
  });

  it("masks middle of key 10+ chars", () => {
    // "1234567890" → "1234••7890"
    const result = maskApiKey("1234567890");
    expect(result).toBe("1234\u2022\u20227890");
    expect(result.length).toBe(10);
  });

  it("handles long API key (48 chars)", () => {
    const key = "abcd" + "x".repeat(40) + "wxyz";
    const masked = maskApiKey(key);
    expect(masked.startsWith("abcd")).toBe(true);
    expect(masked.endsWith("wxyz")).toBe(true);
    expect(masked.length).toBe(48);
  });

  it("handles empty string", () => {
    expect(maskApiKey("")).toBe("");
  });
});

// ---------------------------------------------------------------------------
// getBackyEnvironment
// ---------------------------------------------------------------------------

describe("getBackyEnvironment", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 'prod' when NODE_ENV is production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(getBackyEnvironment()).toBe("prod");
  });

  it("returns 'dev' when NODE_ENV is development", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(getBackyEnvironment()).toBe("dev");
  });

  it("returns 'dev' when NODE_ENV is test", () => {
    vi.stubEnv("NODE_ENV", "test");
    expect(getBackyEnvironment()).toBe("dev");
  });
});

// ---------------------------------------------------------------------------
// buildBackyTag
// ---------------------------------------------------------------------------

describe("buildBackyTag", () => {
  it("builds tag with provided date and counts", () => {
    const tag = buildBackyTag(
      "1.4.0",
      { posts: 42, categories: 5, tags: 12 },
      "a7x2",
      "2026-03-26T14-30-05",
    );
    expect(tag).toBe("v1.4.0-2026-03-26T14-30-05-a7x2-42post-5cat-12tag");
  });

  it("uses current time when no date provided", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-26T14:30:05Z"));

    const tag = buildBackyTag(
      "1.4.0",
      { posts: 10, categories: 3, tags: 7 },
      "b8z3",
    );
    expect(tag).toBe("v1.4.0-2026-03-26T14-30-05-b8z3-10post-3cat-7tag");

    vi.useRealTimers();
  });

  it("handles zero counts", () => {
    const tag = buildBackyTag(
      "1.0.0",
      { posts: 0, categories: 0, tags: 0 },
      "0000",
      "2026-01-01T00-00-00",
    );
    expect(tag).toBe("v1.0.0-2026-01-01T00-00-00-0000-0post-0cat-0tag");
  });
});

// ---------------------------------------------------------------------------
// formatFileSize
// ---------------------------------------------------------------------------

describe("formatFileSize", () => {
  it("formats bytes", () => {
    expect(formatFileSize(500)).toBe("500 B");
  });

  it("formats kilobytes", () => {
    expect(formatFileSize(1536)).toBe("1.5 KB");
  });

  it("formats megabytes", () => {
    expect(formatFileSize(2.5 * 1024 * 1024)).toBe("2.5 MB");
  });

  it("formats zero", () => {
    expect(formatFileSize(0)).toBe("0 B");
  });

  it("formats exactly 1 KB", () => {
    expect(formatFileSize(1024)).toBe("1.0 KB");
  });
});

// ---------------------------------------------------------------------------
// formatTimeAgo
// ---------------------------------------------------------------------------

describe("formatTimeAgo", () => {
  it("formats just now", () => {
    const now = new Date().toISOString();
    expect(formatTimeAgo(now)).toBe("just now");
  });

  it("formats minutes ago", () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    expect(formatTimeAgo(fiveMinAgo)).toBe("5m ago");
  });

  it("formats hours ago", () => {
    const threeHoursAgo = new Date(
      Date.now() - 3 * 60 * 60 * 1000,
    ).toISOString();
    expect(formatTimeAgo(threeHoursAgo)).toBe("3h ago");
  });

  it("formats days ago", () => {
    const twoDaysAgo = new Date(
      Date.now() - 2 * 24 * 60 * 60 * 1000,
    ).toISOString();
    expect(formatTimeAgo(twoDaysAgo)).toBe("2d ago");
  });

  it("formats months ago", () => {
    const sixtyDaysAgo = new Date(
      Date.now() - 60 * 24 * 60 * 60 * 1000,
    ).toISOString();
    expect(formatTimeAgo(sixtyDaysAgo)).toBe("2mo ago");
  });
});
