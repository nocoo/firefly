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
  type AiProvider,
  type SdkType,
} from "@/services/ai";
import { createAiModel } from "@nocoo/next-ai/server";
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
      ...(settings.baseURL ? { baseURL: settings.baseURL } : {}),
      ...(settings.sdkType ? { sdkType: settings.sdkType as SdkType } : {}),
      ...(settings.authType ? { authType: settings.authType } : {}),
    });

    const { text } = await generateText({
      model: createAiModel(config),
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
    // Surface upstream provider errors with their original status + message
    // so the UI shows "401 Authentication failed (upstream: ...)" instead of
    // a generic 502 (which Railway's edge can render as HTML, breaking the
    // client's res.json() parse). ai-sdk attaches `statusCode` and a
    // structured `responseBody` for HTTP errors.
    type UpstreamError = Error & {
      statusCode?: number;
      responseBody?: string;
      url?: string;
    };
    const e = err as UpstreamError;
    const statusCode = typeof e.statusCode === "number" ? e.statusCode : 502;
    const baseMessage = e.message ?? "Unknown error";
    let detail = baseMessage;
    if (e.responseBody) {
      try {
        const parsed = JSON.parse(e.responseBody) as {
          error?: { message?: string } | string;
          message?: string;
        };
        const inner =
          typeof parsed.error === "string"
            ? parsed.error
            : parsed.error?.message ?? parsed.message;
        if (inner) detail = inner;
      } catch {
        // responseBody not JSON — keep baseMessage
      }
    }
    return errorResponse(
      e.url ? `${detail} (upstream: ${e.url})` : detail,
      statusCode,
    );
  }
}
