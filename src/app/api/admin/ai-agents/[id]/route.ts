import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { jsonResponse, errorResponse, notFoundResponse } from "@/lib/api";
import {
  getAiAgentById,
  getAiAgentBySlug,
  updateAiAgent,
  deleteAiAgent,
} from "@/data/entities/ai-agent";
import { getCategoryById } from "@/data/entities/category";

type RouteContext = { params: Promise<{ id: string }> };

// ---------------------------------------------------------------------------
// GET /api/admin/ai-agents/[id] — get single agent
// ---------------------------------------------------------------------------

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return errorResponse("Unauthorized", 401);
  }

  try {
    const { id } = await params;
    const db = getDb();

    const agent = await getAiAgentById(db, id);
    if (!agent) {
      return notFoundResponse("Agent");
    }

    // Get category info
    const category = await getCategoryById(db, agent.category_id);

    return jsonResponse({
      agent: {
        ...agent,
        category_name: category?.name ?? null,
        category_slug: category?.slug ?? null,
      },
    });
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Internal server error",
      500,
    );
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/admin/ai-agents/[id] — update agent
// ---------------------------------------------------------------------------

interface UpdateAgentBody {
  name?: string;
  slug?: string;
  description?: string | null;
  isActive?: boolean;
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return errorResponse("Unauthorized", 401);
  }

  try {
    const { id } = await params;
    const body = (await request.json()) as UpdateAgentBody;
    const db = getDb();

    // Check agent exists
    const existing = await getAiAgentById(db, id);
    if (!existing) {
      return notFoundResponse("Agent");
    }

    // Check slug uniqueness if changing
    if (body.slug !== undefined && body.slug !== existing.slug) {
      const conflicting = await getAiAgentBySlug(db, body.slug);
      if (conflicting) {
        return errorResponse("An agent with this slug already exists", 400);
      }
    }

    // Update agent - only include defined fields
    const updateInput: import("@/data/entities/ai-agent").UpdateAiAgentInput = {};
    if (body.name !== undefined) updateInput.name = body.name.trim();
    if (body.slug !== undefined) updateInput.slug = body.slug.trim();
    if (body.description !== undefined) {
      updateInput.description = body.description === null ? null : body.description.trim();
    }
    if (body.isActive !== undefined) updateInput.isActive = body.isActive;

    const updated = await updateAiAgent(db, id, updateInput);

    if (!updated) {
      return notFoundResponse("Agent");
    }

    // Get category info
    const category = await getCategoryById(db, updated.category_id);

    return jsonResponse({
      agent: {
        ...updated,
        category_name: category?.name ?? null,
        category_slug: category?.slug ?? null,
      },
    });
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Internal server error",
      500,
    );
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/admin/ai-agents/[id] — delete agent
// ---------------------------------------------------------------------------

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return errorResponse("Unauthorized", 401);
  }

  try {
    const { id } = await params;
    const db = getDb();

    const deleted = await deleteAiAgent(db, id);
    if (!deleted) {
      return notFoundResponse("Agent");
    }

    return jsonResponse({ success: true });
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Internal server error",
      500,
    );
  }
}
