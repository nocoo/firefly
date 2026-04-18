import { auth } from "@/lib/auth";
import { isE2EMode } from "@/lib/auth-utils";
import { getDb } from "@/lib/db";
import { jsonResponse, errorResponse } from "@/lib/api";
import { revokeToken, deleteMcpToken, updateTokenScope } from "@/data/mcp-tokens";
import type { McpTokenScope } from "@/models/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const VALID_SCOPES: McpTokenScope[] = ["full", "author"];

/** Check admin auth — bypassed in E2E. */
async function requireAdmin(): Promise<boolean> {
  if (isE2EMode()) return true;
  const session = await auth();
  return !!session?.user;
}

// PATCH /api/mcp/tokens/[id] — update token scope (admin)
export async function PATCH(request: Request, { params }: RouteParams) {
  if (!(await requireAdmin())) {
    return errorResponse("Unauthorized", 401);
  }

  try {
    const { id } = await params;
    const body = (await request.json()) as { scope?: string };

    if (!body.scope || !VALID_SCOPES.includes(body.scope as McpTokenScope)) {
      return errorResponse(`Invalid scope. Must be one of: ${VALID_SCOPES.join(", ")}`);
    }

    const db = getDb();
    const updated = await updateTokenScope(db, id, body.scope as McpTokenScope);
    if (!updated) {
      return errorResponse("Token not found or already revoked", 404);
    }
    return jsonResponse({ success: true, scope: body.scope });
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Internal server error",
      500,
    );
  }
}

// DELETE /api/mcp/tokens/[id] — revoke or delete a token (admin)
// Query params:
//   ?action=delete — permanently delete (only revoked tokens)
//   (default) — revoke the token
export async function DELETE(request: Request, { params }: RouteParams) {
  if (!(await requireAdmin())) {
    return errorResponse("Unauthorized", 401);
  }

  try {
    const { id } = await params;
    const url = new URL(request.url);
    const action = url.searchParams.get("action");
    const db = getDb();

    if (action === "delete") {
      const deleted = await deleteMcpToken(db, id);
      if (!deleted) {
        return errorResponse("Token not found or not revoked", 404);
      }
      return jsonResponse({ success: true, action: "deleted" });
    }

    // Default: revoke
    const revoked = await revokeToken(db, id);
    if (!revoked) {
      return errorResponse("Token not found or already revoked", 404);
    }
    return jsonResponse({ success: true, action: "revoked" });
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Internal server error",
      500,
    );
  }
}
