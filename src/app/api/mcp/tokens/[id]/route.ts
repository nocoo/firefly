import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { jsonResponse, errorResponse } from "@/lib/api";
import { revokeToken } from "@/data/mcp-tokens";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** Check admin auth — bypassed in E2E. */
async function requireAdmin(): Promise<boolean> {
  if (process.env.E2E_SKIP_AUTH === "true") return true;
  const session = await auth();
  return !!session?.user;
}

// DELETE /api/mcp/tokens/[id] — revoke a token (admin)
export async function DELETE(_request: Request, { params }: RouteParams) {
  if (!(await requireAdmin())) {
    return errorResponse("Unauthorized", 401);
  }

  try {
    const { id } = await params;
    const db = getDb();
    const revoked = await revokeToken(db, id);

    if (!revoked) {
      return errorResponse("Token not found or already revoked", 404);
    }

    return jsonResponse({ success: true });
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Internal server error",
      500,
    );
  }
}
