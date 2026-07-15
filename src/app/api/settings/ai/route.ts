/**
 * GET  /api/settings/ai — Read AI configuration
 * PUT  /api/settings/ai — Save AI configuration
 */

import type { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { jsonResponse, errorResponse } from "@/lib/api";
import {
  getAiSettings,
  updateAiSettings,
  maskApiKey,
  type UpdateAiSettingsInput,
} from "@/data/ai-settings";
import { isValidProvider, type SdkType } from "@/services/ai";

/**
 * GET /api/settings/ai — return current AI settings.
 * API key is masked in response.
 */
export async function GET() {
  try {
    const db = getDb();
    const settings = await getAiSettings(db);
    return jsonResponse({
      ...settings,
      apiKey: maskApiKey(settings.apiKey),
      hasApiKey: !!settings.apiKey,
    });
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Internal server error",
      500,
    );
  }
}

/**
 * PUT /api/settings/ai — update AI settings.
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const input: UpdateAiSettingsInput = {};

    // Validate provider if provided
    if (body.provider !== undefined && body.provider !== "") {
      if (!isValidProvider(body.provider)) {
        return errorResponse(`Invalid provider: ${body.provider}`);
      }
      input.provider = body.provider;
    } else if (body.provider === "") {
      input.provider = "";
    }

    // Validate sdkType if provided
    if (body.sdkType !== undefined && body.sdkType !== "") {
      if (body.sdkType !== "openai" && body.sdkType !== "anthropic") {
        return errorResponse(`Invalid SDK type: ${body.sdkType}`);
      }
      input.sdkType = body.sdkType as SdkType;
    } else if (body.sdkType === "") {
      input.sdkType = "";
    }

    // Validate authType if provided
    if (body.authType !== undefined && body.authType !== "") {
      if (body.authType !== "apiKey" && body.authType !== "bearer") {
        return errorResponse(`Invalid auth type: ${body.authType}`);
      }
      input.authType = body.authType;
    } else if (body.authType === "") {
      input.authType = "";
    }

    if (body.apiKey !== undefined) {
      input.apiKey = body.apiKey;
    }
    if (body.model !== undefined) {
      input.model = body.model;
    }
    if (body.baseURL !== undefined) {
      input.baseURL = body.baseURL;
    }

    const db = getDb();
    const settings = await updateAiSettings(db, input);
    return jsonResponse({
      ...settings,
      apiKey: maskApiKey(settings.apiKey),
      hasApiKey: !!settings.apiKey,
    });
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Internal server error",
      500,
    );
  }
}
