/**
 * AI service module — delegates to @nocoo/next-ai for provider/config/client.
 * Only firefly-specific prompt logic lives here.
 */

import {
  AiProviderRegistry,
  CUSTOM_PROVIDER_INFO as NEXT_AI_CUSTOM_PROVIDER_INFO,
  isValidProvider,
  resolveAiConfig,
  type AiConfig,
  type AiProviderInfo,
  type AiSettingsInput,
  type SdkType,
} from "@nocoo/next-ai";
import { createAiModel } from "@nocoo/next-ai/server";

// Re-export from next-ai for backward compatibility
export {
  AiProviderRegistry,
  isValidProvider,
  resolveAiConfig,
  type AiConfig,
  type AiProviderInfo,
  type AiSettingsInput,
  type SdkType,
};

export { createAiModel };

// Backward-compatible type alias (firefly historically narrowed this to a union)
export type AiProvider = string;

// ── Backward-compatible registry shims ──

const defaultRegistry = new AiProviderRegistry();

export const AI_PROVIDERS: Record<string, AiProviderInfo> = Object.fromEntries(
  defaultRegistry.getAll().map((p) => [p.id, p]),
);

export const ALL_PROVIDER_IDS: string[] = defaultRegistry.getAllIds();

export const CUSTOM_PROVIDER_INFO = NEXT_AI_CUSTOM_PROVIDER_INFO;

export function getProviderConfig(providerId: string): AiProviderInfo | undefined {
  if (providerId === "custom") return undefined;
  return defaultRegistry.get(providerId);
}

// ── Excerpt generation ──

import { generateText } from "ai";
import { getDb } from "@/lib/db";
import { getAiSettings } from "@/data/ai-settings";

export const EXCERPT_PROMPT = `你是这篇文章的作者，用中文写一段摘要。

这段摘要会同时用于 meta description（搜索引擎结果展示）和文章页摘要区。

规则：
- 3 到 4 句话，100 到 150 字
- 第一句点出文章主题或痛点，让搜索引擎和读者一眼抓住关键词
- 接下来用第一人称（我）传递写这篇文章的缘由或态度，唤起共鸣
- 绝对不要剧透核心观点、拆解论点、罗列要点
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
    provider: settings.provider,
    apiKey: settings.apiKey,
    model: settings.model,
    ...(settings.baseURL ? { baseURL: settings.baseURL } : {}),
    ...(settings.sdkType ? { sdkType: settings.sdkType as SdkType } : {}),
    ...(settings.authType ? { authType: settings.authType } : {}),
  });

  const result = await generateText({
    model: createAiModel(config),
    prompt: `${EXCERPT_PROMPT}\n\n标题：${title}\n\n正文：\n${content}`,
    maxOutputTokens: 1024,
  });

  return result.text.trim();
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
      provider: settings.provider,
      apiKey: settings.apiKey,
      model: settings.model,
      ...(settings.baseURL ? { baseURL: settings.baseURL } : {}),
      ...(settings.sdkType ? { sdkType: settings.sdkType as SdkType } : {}),
      ...(settings.authType ? { authType: settings.authType } : {}),
    });

    const contextParts: string[] = [];
    if (ogTitle) contextParts.push(`OG Title: ${ogTitle}`);
    if (ogDescription) contextParts.push(`OG Description: ${ogDescription}`);
    if (bodyText) contextParts.push(`Page Content:\n${bodyText}`);

    if (contextParts.length === 0) return null;

    const result = await generateText({
      model: createAiModel(config),
      prompt: `${UNFURL_PROMPT}\n\n${contextParts.join("\n\n")}`,
      maxOutputTokens: 1024,
    });

    const text = result.text.trim();
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
