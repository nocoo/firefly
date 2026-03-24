import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { jsonResponse, errorResponse } from "@/lib/api";
import { revokeToken } from "@/data/mcp-tokens";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// DELETE /api/mcp/tokens/[id] — revoke a token (admin)
export async function DELETE(_request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
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
