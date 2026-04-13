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

    // Type validation: reject non-string/non-null inputs
    if (body.name !== undefined && typeof body.name !== "string") {
      return errorResponse("name must be a string", 400);
    }
    if (body.slug !== undefined && typeof body.slug !== "string") {
      return errorResponse("slug must be a string", 400);
    }
    if (body.description !== undefined && body.description !== null && typeof body.description !== "string") {
      return errorResponse("description must be a string or null", 400);
    }
    if (body.isActive !== undefined && typeof body.isActive !== "boolean") {
      return errorResponse("isActive must be a boolean", 400);
    }

    // Normalize inputs (trim before any validation)
    const normalizedName = body.name !== undefined ? body.name.trim() : undefined;
    const normalizedSlug = body.slug !== undefined ? body.slug.trim() : undefined;
    const normalizedDescription = body.description !== undefined
      ? (body.description === null ? null : body.description.trim())
      : undefined;

    // Validate: reject empty strings after trim
    if (normalizedName !== undefined && normalizedName === "") {
      return errorResponse("name cannot be empty", 400);
    }
    if (normalizedSlug !== undefined && normalizedSlug === "") {
      return errorResponse("slug cannot be empty", 400);
    }

    // Check slug uniqueness using normalized value
    if (normalizedSlug !== undefined && normalizedSlug !== existing.slug) {
      const conflicting = await getAiAgentBySlug(db, normalizedSlug);
      if (conflicting) {
        return errorResponse("An agent with this slug already exists", 400);
      }
    }

    // Build update input with normalized values
    const updateInput: import("@/data/entities/ai-agent").UpdateAiAgentInput = {};
    if (normalizedName !== undefined) updateInput.name = normalizedName;
    if (normalizedSlug !== undefined) updateInput.slug = normalizedSlug;
    if (normalizedDescription !== undefined) updateInput.description = normalizedDescription;
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

    const result = await deleteAiAgent(db, id);

    if (!result.success) {
      if (result.postCount !== undefined && result.postCount > 0) {
        return errorResponse(
          `Cannot delete agent: ${result.postCount} post(s) still reference this agent. Reassign or delete those posts first.`,
          409, // Conflict
        );
      }
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
