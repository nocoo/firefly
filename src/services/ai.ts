/**
 * AI service module.
 *
 * Provides LLM integration via configurable AI providers.
 * Supports both OpenAI and Anthropic SDK protocols through Vercel AI SDK.
 * Includes built-in providers (Anthropic, MiniMax, GLM, AIHubMix) and a
 * "custom" provider where users supply their own base URL and SDK type.
 */

import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";

// ── Provider registry ──

export type SdkType = "anthropic" | "openai";

export type AiProvider = "anthropic" | "minimax" | "glm" | "aihubmix" | "custom";

export interface AiProviderInfo {
  id: AiProvider;
  label: string;
  baseURL: string;
  sdkType: SdkType;
  models: string[];
  defaultModel: string;
}

export const AI_PROVIDERS: Record<Exclude<AiProvider, "custom">, AiProviderInfo> = {
  anthropic: {
    id: "anthropic",
    label: "Anthropic",
    baseURL: "https://api.anthropic.com/v1",
    sdkType: "anthropic",
    models: ["claude-sonnet-4-20250514"],
    defaultModel: "claude-sonnet-4-20250514",
  },
  minimax: {
    id: "minimax",
    label: "MiniMax",
    baseURL: "https://api.minimaxi.com/anthropic/v1",
    sdkType: "anthropic",
    models: ["MiniMax-M2.5", "MiniMax-M2.1"],
    defaultModel: "MiniMax-M2.5",
  },
  glm: {
    id: "glm",
    label: "GLM (Zhipu)",
    baseURL: "https://open.bigmodel.cn/api/anthropic/v1",
    sdkType: "anthropic",
    models: ["glm-5", "glm-4.7"],
    defaultModel: "glm-5",
  },
  aihubmix: {
    id: "aihubmix",
    label: "AIHubMix",
    baseURL: "https://aihubmix.com/v1",
    sdkType: "openai",
    models: ["gpt-4o-mini", "gpt-5-nano"],
    defaultModel: "gpt-4o-mini",
  },
};

/** All valid provider IDs (including "custom"). */
export const ALL_PROVIDER_IDS: AiProvider[] = [
  ...Object.keys(AI_PROVIDERS) as Exclude<AiProvider, "custom">[],
  "custom",
];

/**
 * Custom provider sentinel — used when provider === "custom".
 * baseURL and sdkType are supplied by user settings at runtime.
 */
export const CUSTOM_PROVIDER_INFO: Omit<AiProviderInfo, "baseURL" | "sdkType"> = {
  id: "custom",
  label: "Custom",
  models: [],
  defaultModel: "",
};

// ── Config resolution ──

export interface AiConfig {
  provider: AiProvider;
  baseURL: string;
  apiKey: string;
  model: string;
  sdkType: SdkType;
}

/** User-facing settings (stored in DB). */
export interface AiSettingsInput {
  provider: AiProvider;
  apiKey: string;
  model: string; // empty = use provider default
  /** Only used when provider === "custom" */
  baseURL?: string | undefined;
  /** Only used when provider === "custom" */
  sdkType?: SdkType | undefined;
}

/**
 * Look up a built-in provider's static config.
 */
export function getProviderConfig(
  providerId: AiProvider,
): AiProviderInfo | undefined {
  if (providerId === "custom") return undefined;
  return AI_PROVIDERS[providerId];
}

/**
 * Check if a provider ID is valid (built-in or custom).
 */
export function isValidProvider(id: string): id is AiProvider {
  return ALL_PROVIDER_IDS.includes(id as AiProvider);
}

/**
 * Resolve user settings into a complete AiConfig.
 * Fills in baseURL, sdkType, and default model from the provider registry.
 * For "custom" provider, baseURL and sdkType must be supplied in the input.
 */
export function resolveAiConfig(input: AiSettingsInput): AiConfig {
  if (!input.apiKey) {
    throw new Error("API key is required");
  }

  if (input.provider === "custom") {
    if (!input.baseURL) {
      throw new Error("Base URL is required for custom provider");
    }
    if (!input.sdkType) {
      throw new Error("SDK type is required for custom provider");
    }
    if (!input.model) {
      throw new Error("Model is required for custom provider");
    }
    return {
      provider: "custom",
      baseURL: input.baseURL,
      apiKey: input.apiKey,
      model: input.model,
      sdkType: input.sdkType,
    };
  }

  const info = getProviderConfig(input.provider);
  if (!info) {
    throw new Error(`Unknown AI provider: ${input.provider}`);
  }

  return {
    provider: input.provider,
    baseURL: info.baseURL,
    apiKey: input.apiKey,
    model: input.model || info.defaultModel,
    sdkType: info.sdkType,
  };
}

// ── Client creation ──

/**
 * Create a Vercel AI SDK provider instance based on sdkType.
 * Returns a function that creates model references: `client(modelId)`.
 *
 * When sdkType is "anthropic", uses @ai-sdk/anthropic.
 * When sdkType is "openai", uses @ai-sdk/openai.
 * Both return the same calling convention: `client(modelId) → LanguageModelV2`.
 */
export function createAiClient(config: AiConfig) {
  if (config.sdkType === "openai") {
    return createOpenAI({
      baseURL: config.baseURL,
      apiKey: config.apiKey,
    });
  }
  return createAnthropic({
    baseURL: config.baseURL,
    apiKey: config.apiKey,
  });
}

// ── Excerpt generation ──

import { generateText } from "ai";
import { getDb } from "@/lib/db";
import { getAiSettings } from "@/data/ai-settings";

export const EXCERPT_PROMPT = `你是这篇文章的作者，用中文写一段 4 到 5 句话的摘要。

规则：
- 目标是让读者产生共鸣并想点进去看全文，而不是复述文章内容
- 用第一人称（我），像在跟朋友分享一个刚想明白的事
- 说出写这篇文章的缘由或触动点，传递情绪和态度
- 绝对不要剧透核心观点、拆解论点、罗列要点或概括段落
- 不要用"本文探讨了""作者认为""笔者""这篇文章将"这类套话
- 不要用 markdown 格式，不要加引号包裹，输出纯文本`;

/**
 * Generate a blog post excerpt using the configured AI provider.
 *
 * Reads AI settings from DB, resolves provider config, and calls
 * generateText() with a prompt designed to produce a human-sounding,
 * length-controlled summary.
 *
 * @throws Error("AI not configured") when provider or API key is missing
 */
export async function generateExcerpt(
  title: string,
  content: string,
): Promise<string> {
  const db = getDb();
  const settings = await getAiSettings(db);

  if (!settings.provider || !settings.apiKey) {
    throw new Error("AI not configured");
  }

  const config = resolveAiConfig({
    provider: settings.provider as AiProvider,
    apiKey: settings.apiKey,
    model: settings.model,
    baseURL: settings.baseURL || undefined,
    sdkType: (settings.sdkType || undefined) as SdkType | undefined,
  });

  const client = createAiClient(config);

  const result = await generateText({
    model: client(config.model),
    prompt: `${EXCERPT_PROMPT}\n\n标题：${title}\n\n正文：\n${content}`,
    maxOutputTokens: 1024,
  });

  // Some models (e.g. MiniMax) use extended thinking via Anthropic protocol.
  // If all output tokens were consumed by reasoning and text is empty,
  // extract the trailing content from the last reasoning block as fallback.
  let excerpt = result.text.trim();
  if (!excerpt && result.reasoning) {
    const lastReasoning = result.reasoning.at(-1);
    if (lastReasoning?.type === "reasoning" && lastReasoning.text) {
      // The reasoning may contain the draft excerpt after the analysis.
      // Look for quoted content near the end (often the model drafts the excerpt in quotes).
      const lines = lastReasoning.text.trim().split("\n");
      // Take the last non-empty line(s) that look like the actual excerpt
      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i].trim();
        if (!line) continue;
        // Strip surrounding quotes if present
        const unquoted = line.replace(/^["「『]|["」』]$/g, "").trim();
        if (unquoted.length >= 20) {
          excerpt = unquoted;
          break;
        }
      }
    }
  }

  return excerpt;
}

// ── Unfurl metadata summarization ──

export const UNFURL_PROMPT = `你是一个收藏者，正在为书签写标题和描述。

规则：
- 标题：不超过 50 个字，写出项目或文章的名字，不要带网站名后缀
- 描述：不超过 150 个字，用一句话说明它是什么、有什么价值
- 如果原始内容是英文，把标题和描述翻译成中文
- 如果原始内容已经是中文，保持原样
- 用第一人称视角，像在告诉朋友「这个链接值得收藏」
- 不要用"本文""该文""笔者"这类套话
- 只输出 JSON，不要输出其他内容：{"title":"...","description":"..."}`;

/**
 * Summarize unfurled URL metadata using the configured AI provider.
 *
 * **Never throws** — returns null on any failure:
 * - AI not configured (no provider/key) → null
 * - Model timeout / rate limit / network error → null
 * - Response not valid JSON → null
 *
 * Uses strict JSON output format so reasoning-model content is ignored.
 */
export async function summarizeUnfurl(
  ogTitle: string | null,
  ogDescription: string | null,
  bodyText: string,
): Promise<{ title: string; description: string } | null> {
  try {
    const db = getDb();
    const settings = await getAiSettings(db);

    if (!settings.provider || !settings.apiKey) {
      return null;
    }

    const config = resolveAiConfig({
      provider: settings.provider as AiProvider,
      apiKey: settings.apiKey,
      model: settings.model,
      baseURL: settings.baseURL || undefined,
      sdkType: (settings.sdkType || undefined) as SdkType | undefined,
    });

    const client = createAiClient(config);

    const contextParts: string[] = [];
    if (ogTitle) contextParts.push(`OG Title: ${ogTitle}`);
    if (ogDescription) contextParts.push(`OG Description: ${ogDescription}`);
    if (bodyText) contextParts.push(`Page Content:\n${bodyText}`);

    if (contextParts.length === 0) return null;

    const result = await generateText({
      model: client(config.model),
      prompt: `${UNFURL_PROMPT}\n\n${contextParts.join("\n\n")}`,
      maxOutputTokens: 1024,
    });

    // Prefer result.text; for thinking models (e.g. MiniMax-M2.1) that put
    // output in reasoning blocks and return empty text, try extracting from reasoning.
    let text = result.text.trim();
    if (!text && result.reasoning) {
      const reasoningText = result.reasoning
        .filter((r): r is { type: "reasoning"; text: string } => r.type === "reasoning" && !!r.text)
        .map((r) => r.text)
        .join("\n");
      // Look for JSON in reasoning output
      const reasoningJson = reasoningText.match(/\{[\s\S]*?"title"[\s\S]*?"description"[\s\S]*?\}/);
      if (reasoningJson) {
        text = reasoningJson[0];
      }
    }

    if (!text) return null;

    // Extract JSON from response (tolerates markdown fences and surrounding text)
    const jsonMatch = text.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    const title = typeof parsed.title === "string" ? parsed.title.trim() : "";
    const description = typeof parsed.description === "string" ? parsed.description.trim() : "";

    if (!title) return null;

    return { title, description };
  } catch (err) {
    // Never throw — AI failure is not an error
    console.warn("[summarizeUnfurl] AI enhancement failed:", err);
    return null;
  }
}
