import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { jsonResponse, errorResponse } from "@/lib/api";
import { listMcpTokens, generateAccessToken, generateRefreshToken, sha256, createMcpToken, deleteRevokedTokens, countRevokedTokens } from "@/data/mcp-tokens";
import { createMcpClient } from "@/data/mcp-clients";
import type { McpTokenScope } from "@/models/types";

const E2E_EMAIL = "e2e@test.local";
const VALID_SCOPES: McpTokenScope[] = ["full", "author"];

/** Check admin auth — returns user email or null. Bypassed in E2E. */
async function requireAdmin(): Promise<{ email: string } | null> {
  if (process.env.E2E_SKIP_AUTH === "true") {
    return { email: E2E_EMAIL };
  }
  const session = await auth();
  if (!session?.user?.email) return null;
  return { email: session.user.email };
}

// GET /api/mcp/tokens — list all tokens (admin)
// Query params:
//   ?revoked_count=true — return count of revoked tokens instead of full list
export async function GET(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return errorResponse("Unauthorized", 401);
  }

  try {
    const db = getDb();
    const url = new URL(request.url);

    if (url.searchParams.get("revoked_count") === "true") {
      const count = await countRevokedTokens(db);
      return jsonResponse({ revoked_count: count });
    }

    const tokens = await listMcpTokens(db);
    return jsonResponse(tokens);
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Internal server error",
      500,
    );
  }
}

// POST /api/mcp/tokens — manually create a token for an agent (admin)
export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return errorResponse("Unauthorized", 401);
  }

  try {
    const body = (await request.json()) as { client_name?: string; scope?: string };

    if (!body.client_name || typeof body.client_name !== "string") {
      return errorResponse("client_name is required");
    }

    // Absent → default "full"; present but invalid → reject (fail-closed)
    let scope: McpTokenScope = "full";
    if (body.scope !== undefined) {
      if (!VALID_SCOPES.includes(body.scope as McpTokenScope)) {
        return errorResponse(`Invalid scope. Must be one of: ${VALID_SCOPES.join(", ")}`);
      }
      scope = body.scope as McpTokenScope;
    }

    const db = getDb();

    // Auto-create a client for this admin-created token
    const client = await createMcpClient(db, {
      client_name: body.client_name,
      redirect_uris: ["http://localhost:0/callback"],
      grant_types: ["authorization_code"],
    });

    // Generate token pair
    const accessToken = generateAccessToken();
    const refreshToken = generateRefreshToken();
    const accessHash = await sha256(accessToken);
    const refreshHash = await sha256(refreshToken);

    const token = await createMcpToken(db, {
      access_token_hash: accessHash,
      access_token_preview: accessToken.slice(0, 16),
      refresh_token_hash: refreshHash,
      client_id: client.client_id,
      user_email: admin.email,
      scope,
      client_name: body.client_name,
    });

    // Return plaintext tokens (shown only once)
    return jsonResponse({
      id: token.id,
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: "Bearer",
      expires_in: token.expires_at - Math.floor(Date.now() / 1000),
      scope: token.scope,
      client_name: token.client_name,
    }, 201);
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Internal server error",
      500,
    );
  }
}

// DELETE /api/mcp/tokens — delete all revoked tokens (admin)
export async function DELETE() {
  const admin = await requireAdmin();
  if (!admin) {
    return errorResponse("Unauthorized", 401);
  }

  try {
    const db = getDb();
    const deletedCount = await deleteRevokedTokens(db);
    return jsonResponse({ success: true, deleted: deletedCount });
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Internal server error",
      500,
    );
  }
}
