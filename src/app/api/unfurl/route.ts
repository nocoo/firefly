import { NextRequest } from "next/server";
import { jsonResponse, errorResponse } from "@/lib/api";
import { unfurlUrl, UnfurlError } from "@/services/unfurl";
import { summarizeUnfurl } from "@/services/ai";

// POST /api/unfurl — unfurl a URL and return metadata
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { url?: string };

    if (!body.url?.trim()) {
      return errorResponse("url is required");
    }

    const url = body.url.trim();

    // 1. Fetch + extract (required)
    const raw = await unfurlUrl(url);

    // 2. AI enhancement (optional, graceful fallback)
    const ai = await summarizeUnfurl(raw.ogTitle, raw.ogDescription, raw.bodyText);

    // 3. Assemble response
    const title = ai?.title ?? raw.ogTitle ?? raw.pageTitle ?? new URL(url).hostname;
    const description = ai?.description ?? raw.ogDescription ?? "";
    const image = raw.ogImage ?? raw.readmeImage ?? null;
    const aiEnhanced = ai !== null;

    return jsonResponse({ url, title, description, image, ai_enhanced: aiEnhanced });
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
