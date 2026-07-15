import type { NextRequest } from "next/server";
import { jsonResponse, errorResponse } from "@/lib/api";
import { unfurlUrl, UnfurlError } from "@/services/unfurl";

// POST /api/unfurl — unfurl a URL and return raw OG metadata
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { url?: string };

    if (!body.url?.trim()) {
      return errorResponse("url is required");
    }

    const url = body.url.trim();

    const raw = await unfurlUrl(url);

    const title = raw.ogTitle ?? raw.pageTitle ?? new URL(url).hostname;
    const description = raw.ogDescription ?? "";
    const image = raw.ogImage ?? raw.readmeImage ?? null;

    return jsonResponse({ url, title, description, image, bodyText: raw.bodyText });
  } catch (error) {
    if (error instanceof UnfurlError) {
      return errorResponse(error.message, error.statusCode);
    }
    return errorResponse(
      error instanceof Error ? error.message : "Internal server error",
      500,
    );
  }
}
