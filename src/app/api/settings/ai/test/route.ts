/**
 * POST /api/settings/ai/test — Test AI connection with current settings.
 *
 * Sends a minimal prompt to verify the API key and endpoint work.
 */

import { getDb } from "@/lib/db";
import { jsonResponse, errorResponse } from "@/lib/api";
import { getAiSettings } from "@/data/ai-settings";
import {
  resolveAiConfig,
  createAiClient,
  type AiProvider,
  type SdkType,
} from "@/services/ai";
import { generateText } from "ai";

export async function POST(): Promise<Response> {
  try {
    const db = getDb();
    const settings = await getAiSettings(db);

    if (!settings.provider || !settings.apiKey) {
      return errorResponse(
        "AI provider and API key must be configured first",
        400,
      );
    }

    const config = resolveAiConfig({
      provider: settings.provider as AiProvider,
      apiKey: settings.apiKey,
      model: settings.model,
      baseURL: settings.baseURL || undefined,
      sdkType: (settings.sdkType || undefined) as SdkType | undefined,
    });

    const client = createAiClient(config);

    const { text } = await generateText({
      model: client(config.model),
      prompt: "Reply with exactly: OK",
      maxOutputTokens: 10,
    });

    return jsonResponse({
      success: true,
      response: text.trim(),
      model: config.model,
      provider: config.provider,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return errorResponse(message, 502);
  }
}
