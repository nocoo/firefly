/**
 * AI service tests.
 *
 * Tests the AI provider configuration, client creation, and config resolution.
 * Covers both built-in providers and the "custom" provider type.
 */

import { describe, expect, it, vi } from "vitest";
import {
  AI_PROVIDERS,
  ALL_PROVIDER_IDS,
  CUSTOM_PROVIDER_INFO,
  getProviderConfig,
  isValidProvider,
  resolveAiConfig,
  createAiClient,
  EXCERPT_PROMPT,
  type AiProvider,
  type AiConfig,
} from "./ai";

describe("AI_PROVIDERS", () => {
  it("has 4 built-in providers", () => {
    expect(Object.keys(AI_PROVIDERS)).toHaveLength(4);
  });

  it("each provider has id, label, baseURL, sdkType, models, defaultModel", () => {
    for (const [id, p] of Object.entries(AI_PROVIDERS)) {
      expect(id).toBe(p.id);
      expect(p.label).toBeTruthy();
      expect(p.baseURL).toMatch(/^https:\/\//);
      expect(p.sdkType).toMatch(/^(anthropic|openai)$/);
      expect(Array.isArray(p.models)).toBe(true);
      expect(p.models.length).toBeGreaterThan(0);
      expect(p.defaultModel).toBeTruthy();
      expect(p.models).toContain(p.defaultModel);
    }
  });

  it("contains expected provider ids", () => {
    const ids = Object.keys(AI_PROVIDERS);
    expect(ids).toContain("anthropic");
    expect(ids).toContain("glm");
    expect(ids).toContain("minimax");
    expect(ids).toContain("aihubmix");
  });

  it("anthropic, minimax, glm use anthropic sdkType", () => {
    expect(AI_PROVIDERS.anthropic.sdkType).toBe("anthropic");
    expect(AI_PROVIDERS.minimax.sdkType).toBe("anthropic");
    expect(AI_PROVIDERS.glm.sdkType).toBe("anthropic");
  });

  it("aihubmix uses openai sdkType", () => {
    expect(AI_PROVIDERS.aihubmix.sdkType).toBe("openai");
  });

  it("providers have expected models", () => {
    expect(AI_PROVIDERS.anthropic.models).toContain("claude-sonnet-4-20250514");
    expect(AI_PROVIDERS.minimax.models).toContain("MiniMax-M2.5");
    expect(AI_PROVIDERS.minimax.models).toContain("MiniMax-M2.1");
    expect(AI_PROVIDERS.glm.models).toContain("glm-5");
    expect(AI_PROVIDERS.glm.models).toContain("glm-4.7");
    expect(AI_PROVIDERS.aihubmix.models).toContain("gpt-4o-mini");
    expect(AI_PROVIDERS.aihubmix.models).toContain("gpt-5-nano");
  });
});

describe("ALL_PROVIDER_IDS", () => {
  it("includes all built-in providers plus custom", () => {
    expect(ALL_PROVIDER_IDS).toContain("anthropic");
    expect(ALL_PROVIDER_IDS).toContain("minimax");
    expect(ALL_PROVIDER_IDS).toContain("glm");
    expect(ALL_PROVIDER_IDS).toContain("aihubmix");
    expect(ALL_PROVIDER_IDS).toContain("custom");
    expect(ALL_PROVIDER_IDS).toHaveLength(5);
  });
});

describe("CUSTOM_PROVIDER_INFO", () => {
  it("has id, label, empty models, empty defaultModel", () => {
    expect(CUSTOM_PROVIDER_INFO.id).toBe("custom");
    expect(CUSTOM_PROVIDER_INFO.label).toBe("Custom");
    expect(CUSTOM_PROVIDER_INFO.models).toEqual([]);
    expect(CUSTOM_PROVIDER_INFO.defaultModel).toBe("");
  });
});

describe("isValidProvider", () => {
  it("returns true for built-in providers", () => {
    expect(isValidProvider("anthropic")).toBe(true);
    expect(isValidProvider("glm")).toBe(true);
    expect(isValidProvider("minimax")).toBe(true);
    expect(isValidProvider("aihubmix")).toBe(true);
  });

  it("returns true for custom", () => {
    expect(isValidProvider("custom")).toBe(true);
  });

  it("returns false for unknown strings", () => {
    expect(isValidProvider("invalid")).toBe(false);
    expect(isValidProvider("")).toBe(false);
  });
});

describe("getProviderConfig", () => {
  it("returns config for valid built-in provider", () => {
    const config = getProviderConfig("anthropic");
    expect(config).toBeDefined();
    expect(config!.id).toBe("anthropic");
    expect(config!.baseURL).toBe("https://api.anthropic.com/v1");
    expect(config!.sdkType).toBe("anthropic");
  });

  it("returns undefined for custom provider", () => {
    expect(getProviderConfig("custom")).toBeUndefined();
  });

  it("returns undefined for invalid provider", () => {
    expect(getProviderConfig("invalid" as AiProvider)).toBeUndefined();
  });
});

describe("resolveAiConfig", () => {
  it("uses provider defaults when model is empty", () => {
    const config = resolveAiConfig({
      provider: "anthropic",
      apiKey: "sk-test",
      model: "",
    });
    expect(config.baseURL).toBe("https://api.anthropic.com/v1");
    expect(config.model).toBe(AI_PROVIDERS.anthropic.defaultModel);
    expect(config.apiKey).toBe("sk-test");
    expect(config.sdkType).toBe("anthropic");
  });

  it("uses custom model when provided", () => {
    const config = resolveAiConfig({
      provider: "anthropic",
      apiKey: "sk-test",
      model: "claude-3-haiku-20240307",
    });
    expect(config.model).toBe("claude-3-haiku-20240307");
  });

  it("resolves different providers correctly", () => {
    const glm = resolveAiConfig({ provider: "glm", apiKey: "k", model: "" });
    expect(glm.baseURL).toBe("https://open.bigmodel.cn/api/anthropic/v1");
    expect(glm.sdkType).toBe("anthropic");

    const mm = resolveAiConfig({ provider: "minimax", apiKey: "k", model: "" });
    expect(mm.baseURL).toBe("https://api.minimaxi.com/anthropic/v1");
    expect(mm.sdkType).toBe("anthropic");

    const hub = resolveAiConfig({ provider: "aihubmix", apiKey: "k", model: "" });
    expect(hub.baseURL).toBe("https://aihubmix.com/v1");
    expect(hub.sdkType).toBe("openai");
  });

  it("resolves custom provider with all fields", () => {
    const config = resolveAiConfig({
      provider: "custom",
      apiKey: "sk-custom",
      model: "my-model",
      baseURL: "https://my-api.example.com/v1",
      sdkType: "openai",
    });
    expect(config.provider).toBe("custom");
    expect(config.baseURL).toBe("https://my-api.example.com/v1");
    expect(config.model).toBe("my-model");
    expect(config.sdkType).toBe("openai");
    expect(config.apiKey).toBe("sk-custom");
  });

  it("resolves custom provider with anthropic sdkType", () => {
    const config = resolveAiConfig({
      provider: "custom",
      apiKey: "sk-custom",
      model: "my-model",
      baseURL: "https://my-api.example.com/v1",
      sdkType: "anthropic",
    });
    expect(config.sdkType).toBe("anthropic");
  });

  it("throws when provider is unknown", () => {
    expect(() =>
      resolveAiConfig({ provider: "bad" as AiProvider, apiKey: "k", model: "" }),
    ).toThrow("Unknown AI provider");
  });

  it("throws when apiKey is empty", () => {
    expect(() =>
      resolveAiConfig({ provider: "anthropic", apiKey: "", model: "" }),
    ).toThrow("API key is required");
  });

  it("throws when custom provider missing baseURL", () => {
    expect(() =>
      resolveAiConfig({
        provider: "custom",
        apiKey: "k",
        model: "m",
        sdkType: "openai",
      }),
    ).toThrow("Base URL is required");
  });

  it("throws when custom provider missing sdkType", () => {
    expect(() =>
      resolveAiConfig({
        provider: "custom",
        apiKey: "k",
        model: "m",
        baseURL: "https://example.com",
      }),
    ).toThrow("SDK type is required");
  });

  it("throws when custom provider missing model", () => {
    expect(() =>
      resolveAiConfig({
        provider: "custom",
        apiKey: "k",
        model: "",
        baseURL: "https://example.com",
        sdkType: "openai",
      }),
    ).toThrow("Model is required");
  });
});

describe("createAiClient", () => {
  it("creates an anthropic provider instance", () => {
    const config: AiConfig = {
      provider: "anthropic",
      baseURL: "https://api.anthropic.com/v1",
      apiKey: "sk-test",
      model: "claude-sonnet-4-20250514",
      sdkType: "anthropic",
    };
    const client = createAiClient(config);
    expect(client).toBeDefined();
    expect(typeof client).toBe("function");
  });

  it("creates an openai provider instance", () => {
    const config: AiConfig = {
      provider: "aihubmix",
      baseURL: "https://aihubmix.com/v1",
      apiKey: "sk-test",
      model: "gpt-4o-mini",
      sdkType: "openai",
    };
    const client = createAiClient(config);
    expect(client).toBeDefined();
    expect(typeof client).toBe("function");
  });

  it("creates client for custom provider with openai sdkType", () => {
    const config: AiConfig = {
      provider: "custom",
      baseURL: "https://my-api.example.com/v1",
      apiKey: "sk-test",
      model: "my-model",
      sdkType: "openai",
    };
    const client = createAiClient(config);
    expect(client).toBeDefined();
    expect(typeof client).toBe("function");
  });

  it("creates client for custom provider with anthropic sdkType", () => {
    const config: AiConfig = {
      provider: "custom",
      baseURL: "https://my-api.example.com/v1",
      apiKey: "sk-test",
      model: "my-model",
      sdkType: "anthropic",
    };
    const client = createAiClient(config);
    expect(client).toBeDefined();
    expect(typeof client).toBe("function");
  });
});

// ── generateExcerpt tests ──

// Mock dependencies before importing generateExcerpt
vi.mock("ai", () => ({
  generateText: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  getDb: vi.fn(() => ({})),
}));

vi.mock("@/data/ai-settings", () => ({
  getAiSettings: vi.fn(),
}));

// Must import after mocks are defined
const { generateText } = await import("ai");
const { getAiSettings } = await import("@/data/ai-settings");
const { generateExcerpt, summarizeUnfurl, UNFURL_PROMPT } = await import("./ai");

const mockedGenerateText = vi.mocked(generateText);
const mockedGetAiSettings = vi.mocked(getAiSettings);

describe("generateExcerpt", () => {
  const mockSettings = {
    provider: "anthropic" as const,
    apiKey: "sk-test-key",
    model: "claude-sonnet-4-20250514",
    baseURL: "",
    sdkType: "" as const,
  };

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
});

// ── summarizeUnfurl tests ──

describe("summarizeUnfurl", () => {
  const mockSettings = {
    provider: "anthropic" as const,
    apiKey: "sk-test-key",
    model: "claude-sonnet-4-20250514",
    baseURL: "",
    sdkType: "" as const,
  };

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

    const result = await summarizeUnfurl("Title", "Desc", "Body");
    expect(result).toBeNull();
  });

  it("returns null when AI returns empty text", async () => {
    mockedGetAiSettings.mockResolvedValue(mockSettings);
    mockedGenerateText.mockResolvedValue({
      text: "",
    } as ReturnType<typeof generateText> extends Promise<infer T> ? T : never);

    const result = await summarizeUnfurl("Title", "Desc", "Body");
    expect(result).toBeNull();
  });

  // ── JSON parsing edge cases ──

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

  // ── Reasoning fallback for thinking models ──

  it("extracts JSON from reasoning when result.text is empty", async () => {
    mockedGetAiSettings.mockResolvedValue(mockSettings);
    mockedGenerateText.mockResolvedValue({
      text: "",
      reasoning: [
        {
          type: "reasoning" as const,
          text: 'Let me think...\n{"title":"From Reasoning","description":"Extracted from thinking"}',
        },
      ],
    } as ReturnType<typeof generateText> extends Promise<infer T> ? T : never);

    const result = await summarizeUnfurl("Title", null, "Body");
    expect(result).toEqual({
      title: "From Reasoning",
      description: "Extracted from thinking",
    });
  });

  it("returns null when reasoning has no JSON", async () => {
    mockedGetAiSettings.mockResolvedValue(mockSettings);
    mockedGenerateText.mockResolvedValue({
      text: "",
      reasoning: [
        {
          type: "reasoning" as const,
          text: "Just some thinking without any JSON output",
        },
      ],
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

// ── generateExcerpt reasoning fallback tests ──

describe("generateExcerpt reasoning fallback", () => {
  const mockSettings = {
    provider: "anthropic" as const,
    apiKey: "sk-test-key",
    model: "claude-sonnet-4-20250514",
    baseURL: "",
    sdkType: "" as const,
  };

  it("extracts excerpt from reasoning when text is empty", async () => {
    mockedGetAiSettings.mockResolvedValue(mockSettings);
    mockedGenerateText.mockResolvedValue({
      text: "",
      reasoning: [
        {
          type: "reasoning" as const,
          text: "Let me analyze...\n\n\"This is a long enough excerpt line that should be extracted from reasoning\"",
        },
      ],
    } as ReturnType<typeof generateText> extends Promise<infer T> ? T : never);

    const result = await generateExcerpt("Title", "Content");
    expect(result).toBe(
      "This is a long enough excerpt line that should be extracted from reasoning",
    );
  });

  it("skips reasoning lines shorter than 20 chars", async () => {
    mockedGetAiSettings.mockResolvedValue(mockSettings);
    mockedGenerateText.mockResolvedValue({
      text: "",
      reasoning: [
        {
          type: "reasoning" as const,
          text: "short\nstill short\nThis line is definitely long enough to be an excerpt",
        },
      ],
    } as ReturnType<typeof generateText> extends Promise<infer T> ? T : never);

    const result = await generateExcerpt("Title", "Content");
    expect(result).toBe(
      "This line is definitely long enough to be an excerpt",
    );
  });

  it("returns empty when reasoning has no long lines", async () => {
    mockedGetAiSettings.mockResolvedValue(mockSettings);
    mockedGenerateText.mockResolvedValue({
      text: "",
      reasoning: [
        {
          type: "reasoning" as const,
          text: "short\ntoo small",
        },
      ],
    } as ReturnType<typeof generateText> extends Promise<infer T> ? T : never);

    const result = await generateExcerpt("Title", "Content");
    expect(result).toBe("");
  });

  it("uses last reasoning block, not first", async () => {
    mockedGetAiSettings.mockResolvedValue(mockSettings);
    mockedGenerateText.mockResolvedValue({
      text: "",
      reasoning: [
        {
          type: "reasoning" as const,
          text: "first block should be ignored if last block is used",
        },
        {
          type: "reasoning" as const,
          text: "「This is the actual last block excerpt content」",
        },
      ],
    } as ReturnType<typeof generateText> extends Promise<infer T> ? T : never);

    const result = await generateExcerpt("Title", "Content");
    expect(result).toBe("This is the actual last block excerpt content");
  });

  it("skips empty lines in reasoning text", async () => {
    mockedGetAiSettings.mockResolvedValue(mockSettings);
    mockedGenerateText.mockResolvedValue({
      text: "",
      reasoning: [
        {
          type: "reasoning" as const,
          text: "\n\n\nThis line is after empty lines and long enough\n\n",
        },
      ],
    } as ReturnType<typeof generateText> extends Promise<infer T> ? T : never);

    const result = await generateExcerpt("Title", "Content");
    expect(result).toBe("This line is after empty lines and long enough");
  });

  it("returns empty when lastReasoning.text is empty string", async () => {
    mockedGetAiSettings.mockResolvedValue(mockSettings);
    mockedGenerateText.mockResolvedValue({
      text: "",
      reasoning: [
        {
          type: "reasoning" as const,
          text: "",
        },
      ],
    } as ReturnType<typeof generateText> extends Promise<infer T> ? T : never);

    const result = await generateExcerpt("Title", "Content");
    expect(result).toBe("");
  });
});
