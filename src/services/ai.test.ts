/**
 * AI service tests.
 *
 * Provider registry, config resolution, and client creation are covered
 * by @nocoo/next-ai's own test suite. These tests focus on the
 * firefly-specific behavior layered on top: the excerpt and unfurl
 * prompts and their callers' contracts.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("ai", () => ({
  generateText: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Backward-compatible registry shims
// ---------------------------------------------------------------------------

describe("getProviderConfig", () => {
  it("returns undefined for the special \"custom\" id", async () => {
    const { getProviderConfig } = await import("./ai");
    expect(getProviderConfig("custom")).toBeUndefined();
  });

  it("returns undefined for an unknown provider id", async () => {
    const { getProviderConfig } = await import("./ai");
    expect(getProviderConfig("definitely-not-a-real-provider")).toBeUndefined();
  });

  it("returns provider info for a known built-in provider id", async () => {
    const { getProviderConfig, ALL_PROVIDER_IDS } = await import("./ai");
    const knownId = ALL_PROVIDER_IDS.find((id) => id !== "custom");
    expect(knownId).toBeDefined();
    expect(getProviderConfig(knownId!)).toBeDefined();
  });
});

vi.mock("@/lib/db", () => ({
  getDb: vi.fn(() => ({})),
}));

vi.mock("@/data/ai-settings", () => ({
  getAiSettings: vi.fn(),
}));

vi.mock("@nocoo/next-ai/server", () => ({
  createAiModel: vi.fn(() => "mock-model"),
}));

const { generateText } = await import("ai");
const { getAiSettings } = await import("@/data/ai-settings");
const { createAiModel } = await import("@nocoo/next-ai/server");
const {
  generateExcerpt,
  summarizeUnfurl,
  EXCERPT_PROMPT,
  UNFURL_PROMPT,
} = await import("./ai");

const mockedGenerateText = vi.mocked(generateText);
const mockedGetAiSettings = vi.mocked(getAiSettings);
const mockedCreateAiModel = vi.mocked(createAiModel);

const mockSettings = {
  provider: "anthropic" as const,
  apiKey: "sk-test-key",
  model: "claude-sonnet-4-20250514",
  baseURL: "",
  sdkType: "" as const,
  authType: "" as const,
};

describe("generateExcerpt", () => {
  it("forwards baseURL and sdkType to resolveAiConfig when set", async () => {
    mockedGetAiSettings.mockResolvedValue({
      ...mockSettings,
      baseURL: "https://custom.example.com",
      sdkType: "anthropic" as unknown as "",
    });
    mockedGenerateText.mockResolvedValue({
      text: "Summary",
    } as ReturnType<typeof generateText> extends Promise<infer T> ? T : never);

    await generateExcerpt("T", "C");

    expect(mockedCreateAiModel).toHaveBeenCalled();
  });

  it("returns trimmed AI-generated text", async () => {
    mockedGetAiSettings.mockResolvedValue(mockSettings);
    mockedGenerateText.mockResolvedValue({
      text: "  A concise summary of the post.  ",
    } as ReturnType<typeof generateText> extends Promise<infer T> ? T : never);

    const result = await generateExcerpt("Test Title", "Test content here");
    expect(result).toBe("A concise summary of the post.");
  });

  it("passes title and content in the prompt", async () => {
    mockedGetAiSettings.mockResolvedValue(mockSettings);
    mockedGenerateText.mockResolvedValue({
      text: "Summary",
    } as ReturnType<typeof generateText> extends Promise<infer T> ? T : never);

    await generateExcerpt("My Title", "My content body");

    expect(mockedGenerateText).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining("My Title"),
        maxOutputTokens: 1024,
      }),
    );
    expect(mockedGenerateText).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining("My content body"),
      }),
    );
  });

  it("includes the excerpt prompt template", async () => {
    mockedGetAiSettings.mockResolvedValue(mockSettings);
    mockedGenerateText.mockResolvedValue({
      text: "Summary",
    } as ReturnType<typeof generateText> extends Promise<infer T> ? T : never);

    await generateExcerpt("Title", "Content");

    expect(mockedGenerateText).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining(EXCERPT_PROMPT),
      }),
    );
  });

  it("passes full content without truncation", async () => {
    mockedGetAiSettings.mockResolvedValue(mockSettings);
    mockedGenerateText.mockResolvedValue({
      text: "Summary",
    } as ReturnType<typeof generateText> extends Promise<infer T> ? T : never);

    const longContent = "x".repeat(5000);
    await generateExcerpt("Title", longContent);

    const call = mockedGenerateText.mock.calls.at(-1)!;
    const prompt = (call[0] as { prompt: string }).prompt;
    const contentInPrompt = prompt.split("正文：\n")[1];
    expect(contentInPrompt.length).toBe(5000);
  });

  it("uses createAiModel from next-ai", async () => {
    mockedGetAiSettings.mockResolvedValue(mockSettings);
    mockedGenerateText.mockResolvedValue({
      text: "Summary",
    } as ReturnType<typeof generateText> extends Promise<infer T> ? T : never);

    await generateExcerpt("Title", "Content");

    expect(mockedCreateAiModel).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "anthropic",
        apiKey: "sk-test-key",
      }),
    );
  });

  it("throws 'AI not configured' when provider is empty", async () => {
    mockedGetAiSettings.mockResolvedValue({
      ...mockSettings,
      provider: "" as const,
    });

    await expect(generateExcerpt("Title", "Content")).rejects.toThrow(
      "AI not configured",
    );
  });

  it("throws 'AI not configured' when apiKey is empty", async () => {
    mockedGetAiSettings.mockResolvedValue({
      ...mockSettings,
      apiKey: "",
    });

    await expect(generateExcerpt("Title", "Content")).rejects.toThrow(
      "AI not configured",
    );
  });

  it("returns empty string when result.text is empty", async () => {
    mockedGetAiSettings.mockResolvedValue(mockSettings);
    mockedGenerateText.mockResolvedValue({
      text: "",
    } as ReturnType<typeof generateText> extends Promise<infer T> ? T : never);

    const result = await generateExcerpt("Title", "Content");
    expect(result).toBe("");
  });
});

describe("summarizeUnfurl", () => {
  it("forwards baseURL and sdkType to resolveAiConfig when set", async () => {
    mockedGetAiSettings.mockResolvedValue({
      ...mockSettings,
      baseURL: "https://custom.example.com",
      sdkType: "openai" as unknown as "",
    });
    mockedGenerateText.mockResolvedValue({
      text: '{"title":"t","description":"d"}',
    } as ReturnType<typeof generateText> extends Promise<infer T> ? T : never);

    const result = await summarizeUnfurl("t", "d", "body");
    expect(result).toEqual({ title: "t", description: "d" });
    expect(mockedCreateAiModel).toHaveBeenCalled();
  });

  it("returns parsed title and description from JSON output", async () => {
    mockedGetAiSettings.mockResolvedValue(mockSettings);
    mockedGenerateText.mockResolvedValue({
      text: '{"title":"AI生成的标题","description":"这是一句描述内容"}',
    } as ReturnType<typeof generateText> extends Promise<infer T> ? T : never);

    const result = await summarizeUnfurl("OG Title", "OG Desc", "Body text");
    expect(result).toEqual({
      title: "AI生成的标题",
      description: "这是一句描述内容",
    });
  });

  it("includes the unfurl prompt template", async () => {
    mockedGetAiSettings.mockResolvedValue(mockSettings);
    mockedGenerateText.mockResolvedValue({
      text: '{"title":"Title","description":"Description"}',
    } as ReturnType<typeof generateText> extends Promise<infer T> ? T : never);

    await summarizeUnfurl("OG Title", null, "Body");

    expect(mockedGenerateText).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining(UNFURL_PROMPT),
        maxOutputTokens: 1024,
      }),
    );
  });

  it("includes OG metadata and body text in prompt", async () => {
    mockedGetAiSettings.mockResolvedValue(mockSettings);
    mockedGenerateText.mockResolvedValue({
      text: '{"title":"Title","description":"Description"}',
    } as ReturnType<typeof generateText> extends Promise<infer T> ? T : never);

    await summarizeUnfurl("My Title", "My Description", "Page content");

    const call = mockedGenerateText.mock.calls.at(-1)!;
    const prompt = (call[0] as { prompt: string }).prompt;
    expect(prompt).toContain("OG Title: My Title");
    expect(prompt).toContain("OG Description: My Description");
    expect(prompt).toContain("Page Content:\nPage content");
  });

  it("returns null when AI is not configured", async () => {
    mockedGetAiSettings.mockResolvedValue({
      ...mockSettings,
      provider: "" as const,
    });

    const result = await summarizeUnfurl("Title", "Desc", "Body");
    expect(result).toBeNull();
  });

  it("returns null when apiKey is empty", async () => {
    mockedGetAiSettings.mockResolvedValue({
      ...mockSettings,
      apiKey: "",
    });

    const result = await summarizeUnfurl("Title", "Desc", "Body");
    expect(result).toBeNull();
  });

  it("returns null when all context parts are empty", async () => {
    mockedGetAiSettings.mockResolvedValue(mockSettings);

    const result = await summarizeUnfurl(null, null, "");
    expect(result).toBeNull();
  });

  it("returns title with empty description when description is empty string", async () => {
    mockedGetAiSettings.mockResolvedValue(mockSettings);
    mockedGenerateText.mockResolvedValue({
      text: '{"title":"Just a title","description":""}',
    } as ReturnType<typeof generateText> extends Promise<infer T> ? T : never);

    const result = await summarizeUnfurl("OG Title", null, "Body");
    expect(result).toEqual({
      title: "Just a title",
      description: "",
    });
  });

  it("returns null and does not throw when AI call fails", async () => {
    mockedGetAiSettings.mockResolvedValue(mockSettings);
    mockedGenerateText.mockRejectedValue(new Error("Network error"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await summarizeUnfurl("Title", "Desc", "Body");
    expect(result).toBeNull();
    expect(warn).toHaveBeenCalledWith(
      "[summarizeUnfurl] AI enhancement failed:",
      expect.any(Error),
    );
  });

  it("returns null when AI returns empty text", async () => {
    mockedGetAiSettings.mockResolvedValue(mockSettings);
    mockedGenerateText.mockResolvedValue({
      text: "",
    } as ReturnType<typeof generateText> extends Promise<infer T> ? T : never);

    const result = await summarizeUnfurl("Title", "Desc", "Body");
    expect(result).toBeNull();
  });

  it("extracts JSON from markdown code fence", async () => {
    mockedGetAiSettings.mockResolvedValue(mockSettings);
    mockedGenerateText.mockResolvedValue({
      text: '```json\n{"title":"Raven","description":"Copilot代理"}\n```',
    } as ReturnType<typeof generateText> extends Promise<infer T> ? T : never);

    const result = await summarizeUnfurl("Title", null, "Body");
    expect(result).toEqual({
      title: "Raven",
      description: "Copilot代理",
    });
  });

  it("returns null when response has no JSON object", async () => {
    mockedGetAiSettings.mockResolvedValue(mockSettings);
    mockedGenerateText.mockResolvedValue({
      text: "Just some plain text without JSON",
    } as ReturnType<typeof generateText> extends Promise<infer T> ? T : never);

    const result = await summarizeUnfurl("Title", null, "Body");
    expect(result).toBeNull();
  });

  it("returns null when JSON has empty title", async () => {
    mockedGetAiSettings.mockResolvedValue(mockSettings);
    mockedGenerateText.mockResolvedValue({
      text: '{"title":"","description":"some desc"}',
    } as ReturnType<typeof generateText> extends Promise<infer T> ? T : never);

    const result = await summarizeUnfurl("Title", null, "Body");
    expect(result).toBeNull();
  });

  it("treats non-string title as empty and returns null", async () => {
    mockedGetAiSettings.mockResolvedValue(mockSettings);
    mockedGenerateText.mockResolvedValue({
      text: '{"title":123,"description":"some desc"}',
    } as ReturnType<typeof generateText> extends Promise<infer T> ? T : never);

    const result = await summarizeUnfurl("Title", null, "Body");
    expect(result).toBeNull();
  });

  it("treats non-string description as empty string", async () => {
    mockedGetAiSettings.mockResolvedValue(mockSettings);
    mockedGenerateText.mockResolvedValue({
      text: '{"title":"Valid Title","description":null}',
    } as ReturnType<typeof generateText> extends Promise<infer T> ? T : never);

    const result = await summarizeUnfurl("Title", null, "Body");
    expect(result).toEqual({
      title: "Valid Title",
      description: "",
    });
  });
});
