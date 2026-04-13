// ---------------------------------------------------------------------------
// GET /api/admin/ai-agents/[id]/prompt — Generate full MCP prompt for agent
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { errorResponse } from "@/lib/api";
import { auth } from "@/lib/auth";
import { getAiAgentById } from "@/data/entities/ai-agent";
import { getCategoryById } from "@/data/entities/category";
import { generateAgentPrompt } from "@/lib/ai-agent/prompt-generator";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return errorResponse("Unauthorized", 401);
    }

    const { id } = await context.params;
    const db = getDb();

    const agent = await getAiAgentById(db, id);
    if (!agent) {
      return errorResponse("Agent not found", 404);
    }

    const category = await getCategoryById(db, agent.category_id);

    // Build the MCP URL
    const siteUrl = process.env.AUTH_URL ?? "http://localhost:3000";
    const mcpUrl = `${siteUrl}/api/mcp`;

    const prompt = generateAgentPrompt({
      agentName: agent.name,
      agentId: agent.id,
      categoryName: category?.name ?? "Unknown",
      mcpUrl,
    });

    return NextResponse.json({ prompt });
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Failed to generate prompt",
      500,
    );
  }
}
