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

export const EXCERPT_PROMPT = `You are a blog excerpt writer. Write a summary for the following blog post.

Rules:
- 5 to 6 sentences that give the reader a clear picture of the article
- Write in the same language as the article
- Sound natural, like a human wrote it — avoid phrases like "this article discusses", "in this post", "the author explores"
- Capture the core insight, key arguments, and takeaway — not a table of contents
- Chinese: 200-300 characters. English: 300-500 characters
- No markdown formatting, no quotes, just plain text`;

export const MAX_EXCERPT_CONTENT_CHARS = 2000;

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
  const truncatedContent = content.slice(0, MAX_EXCERPT_CONTENT_CHARS);

  const result = await generateText({
    model: client(config.model),
    prompt: `${EXCERPT_PROMPT}\n\nTitle: ${title}\n\nContent:\n${truncatedContent}`,
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
