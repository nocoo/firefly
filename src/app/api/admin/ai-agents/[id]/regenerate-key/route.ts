import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { jsonResponse, errorResponse, notFoundResponse } from "@/lib/api";
import { regenerateAgentApiKey } from "@/data/entities/ai-agent";
import { getCategoryById } from "@/data/entities/category";
import { generateAgentPrompt } from "@/lib/ai-agent/prompt-generator";
import { SITE_URL } from "@/lib/seo";

type RouteContext = { params: Promise<{ id: string }> };

// ---------------------------------------------------------------------------
// POST /api/admin/ai-agents/[id]/regenerate-key — regenerate API key
// ---------------------------------------------------------------------------

export async function POST(_request: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return errorResponse("Unauthorized", 401);
  }

  try {
    const { id } = await params;
    const db = getDb();

    const result = await regenerateAgentApiKey(db, id);
    if (!result) {
      return notFoundResponse("Agent");
    }

    const { agent, plaintextKey } = result;

    // Get category info for prompt
    const category = await getCategoryById(db, agent.category_id);

    // Generate new MCP connection prompt
    const mcpUrl = `${SITE_URL}/api/mcp`;
    const prompt = generateAgentPrompt({
      agentName: agent.name,
      categoryName: category?.name ?? "",
      apiKey: plaintextKey,
      mcpUrl,
    });

    return jsonResponse({
      agent: {
        ...agent,
        category_name: category?.name ?? null,
        category_slug: category?.slug ?? null,
      },
      apiKey: plaintextKey, // Only returned on regenerate
      prompt,
    });
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Internal server error",
      500,
    );
  }
}
