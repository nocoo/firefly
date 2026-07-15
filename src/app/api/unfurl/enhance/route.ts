import type { NextRequest } from "next/server";
import { jsonResponse, errorResponse } from "@/lib/api";
import { summarizeUnfurl } from "@/services/ai";

// POST /api/unfurl/enhance — AI-enhance title + description from raw unfurl data
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      title?: string;
      description?: string;
      bodyText?: string;
    };

    if (!body.title && !body.description) {
      return errorResponse("title or description is required");
    }

    const result = await summarizeUnfurl(
      body.title ?? null,
      body.description ?? null,
      body.bodyText ?? "",
    );

    if (!result) {
      return errorResponse("AI enhancement failed — check AI settings", 502);
    }

    return jsonResponse(result);
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Internal server error",
      500,
    );
  }
}
