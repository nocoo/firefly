import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { jsonResponse, errorResponse } from "@/lib/api";
import { revokeToken, deleteMcpToken } from "@/data/mcp-tokens";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** Check admin auth — bypassed in E2E. */
async function requireAdmin(): Promise<boolean> {
  if (process.env.E2E_SKIP_AUTH === "true") return true;
  const session = await auth();
  return !!session?.user;
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
