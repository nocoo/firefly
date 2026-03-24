import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { jsonResponse, errorResponse } from "@/lib/api";
import { listMcpTokens, generateAccessToken, generateRefreshToken, sha256, createMcpToken } from "@/data/mcp-tokens";
import { createMcpClient } from "@/data/mcp-clients";

const E2E_EMAIL = "e2e@test.local";

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
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return errorResponse("Unauthorized", 401);
  }

  try {
    const db = getDb();
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
    const body = (await request.json()) as { client_name?: string };

    if (!body.client_name || typeof body.client_name !== "string") {
      return errorResponse("client_name is required");
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
      scope: "mcp:full",
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
