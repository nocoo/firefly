import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { jsonResponse, errorResponse } from "@/lib/api";
import {
  listAiAgents,
  createAiAgent,
  getAiAgentBySlug,
} from "@/data/entities/ai-agent";
import { getCategoryById } from "@/data/entities/category";
import { generateAgentPrompt } from "@/lib/ai-agent/prompt-generator";
import { SITE_URL } from "@/lib/seo";

// ---------------------------------------------------------------------------
// GET /api/admin/ai-agents — list all agents
// ---------------------------------------------------------------------------

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return errorResponse("Unauthorized", 401);
  }

  try {
    const db = getDb();
    const agents = await listAiAgents(db, { includeInactive: true });
    return jsonResponse({ agents });
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Internal server error",
      500,
    );
  }
}

// ---------------------------------------------------------------------------
// POST /api/admin/ai-agents — create new agent
// ---------------------------------------------------------------------------

interface CreateAgentBody {
  name: string;
  slug: string;
  description?: string;
  categoryId: string;
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return errorResponse("Unauthorized", 401);
  }

  try {
    const body = (await request.json()) as CreateAgentBody;
    const { name, slug, description, categoryId } = body;

    // Normalize first
    const normalizedName = typeof name === "string" ? name.trim() : "";
    const normalizedSlug = typeof slug === "string" ? slug.trim() : "";
    const normalizedDescription = typeof description === "string" ? description.trim() : null;

    // Validate required fields (after normalization)
    if (!normalizedName) {
      return errorResponse("name is required", 400);
    }
    if (!normalizedSlug) {
      return errorResponse("slug is required", 400);
    }
    if (!categoryId || typeof categoryId !== "string") {
      return errorResponse("categoryId is required", 400);
    }

    const db = getDb();

    // Check slug uniqueness (using normalized value)
    const existingBySlug = await getAiAgentBySlug(db, normalizedSlug);
    if (existingBySlug) {
      return errorResponse("An agent with this slug already exists", 400);
    }

    // Check category exists
    const category = await getCategoryById(db, categoryId);
    if (!category) {
      return errorResponse("Category not found", 400);
    }

    // Create agent (using normalized values)
    const { agent, plaintextKey } = await createAiAgent(db, {
      name: normalizedName,
      slug: normalizedSlug,
      description: normalizedDescription,
      categoryId,
    });

    // Generate MCP connection prompt
    const mcpUrl = `${SITE_URL}/api/mcp`;
    const prompt = generateAgentPrompt({
      agentName: agent.name,
      categoryName: category.name,
      apiKey: plaintextKey,
      mcpUrl,
    });

    return jsonResponse(
      {
        agent: {
          ...agent,
          category_name: category.name,
          category_slug: category.slug,
        },
        apiKey: plaintextKey, // Only returned on create
        prompt,
      },
      201,
    );
  } catch (error) {
    // Handle unique constraint violation (slug)
    if (error instanceof Error && error.message.includes("UNIQUE constraint")) {
      return errorResponse("Agent slug already in use", 400);
    }
    return errorResponse(
      error instanceof Error ? error.message : "Internal server error",
      500,
    );
  }
}
