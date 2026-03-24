/**
 * POST /api/posts/[slug]/excerpt — Generate an AI excerpt for a post.
 *
 * Reads the post content from DB and calls the configured AI provider
 * to generate a concise, human-sounding summary.
 *
 * Responses:
 *   200 { excerpt: "..." }
 *   400 AI not configured
 *   404 Post not found
 *   502 LLM call failed
 */

import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { jsonResponse, errorResponse, notFoundResponse } from "@/lib/api";
import { getPostBySlug } from "@/data/posts";
import { generateExcerpt } from "@/services/ai";

interface RouteParams {
  params: Promise<{ slug: string }>;
}

export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params;
    const db = getDb();
    const post = await getPostBySlug(db, slug);
    if (!post) return notFoundResponse("Post");

    const excerpt = await generateExcerpt(post.title, post.content);
    return jsonResponse({ excerpt });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message === "AI not configured") {
      return errorResponse(
        "AI provider not configured. Go to Settings > AI to set it up.",
        400,
      );
    }
    return errorResponse(`Excerpt generation failed: ${message}`, 502);
  }
}
