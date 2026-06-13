import { getDb } from "@/lib/db";
import { jsonResponse, errorResponse } from "@/lib/api";
import { verifyPkceS256 } from "@/lib/mcp/oauth";
import { getAuthCodeByCode, consumeAuthCode } from "@/data/mcp-auth-codes";
import {
  generateAccessToken,
  generateRefreshToken,
  sha256,
  createMcpToken,
  revokeTokensByClientId,
  getValidTokenByRefreshHash,
} from "@/data/mcp-tokens";
import { getMcpClientByClientId } from "@/data/mcp-clients";
import type { McpTokenScope } from "@/models/types";

export async function POST(request: Request) {
  try {
    // Parse form-urlencoded body (OAuth spec)
    const body = await request.formData();
    const grantType = body.get("grant_type") as string | null;

    if (!grantType) {
      return oauthError("invalid_request", "grant_type is required");
    }

    if (grantType === "authorization_code") {
      return handleAuthorizationCode(body);
    }

    if (grantType === "refresh_token") {
      return handleRefreshToken(body);
    }

    return oauthError("unsupported_grant_type", `Unsupported grant_type: ${grantType}`);
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Internal server error",
      500,
    );
  }
}

// ---------------------------------------------------------------------------
// Authorization Code Exchange
// ---------------------------------------------------------------------------

async function handleAuthorizationCode(body: FormData) {
  const code = body.get("code") as string | null;
  const redirectUri = body.get("redirect_uri") as string | null;
  const clientId = body.get("client_id") as string | null;
  const codeVerifier = body.get("code_verifier") as string | null;

  if (!code || !redirectUri || !clientId || !codeVerifier) {
    return oauthError("invalid_request", "Missing required fields: code, redirect_uri, client_id, code_verifier");
  }

  const db = getDb();

  // Step 1: Look up the auth code (valid, unconsumed, not expired)
  const authCode = await getAuthCodeByCode(db, code);
  if (!authCode) {
    return oauthError("invalid_grant", "Authorization code is invalid, expired, or already consumed");
  }

  // Step 2: Validate client_id matches (validate before consuming)
  if (authCode.client_id !== clientId) {
    return oauthError("invalid_grant", "client_id does not match");
  }

  // Step 3: Validate redirect_uri matches
  if (authCode.redirect_uri !== redirectUri) {
    return oauthError("invalid_grant", "redirect_uri does not match");
  }

  // Step 4: Verify PKCE S256
  const pkceValid = await verifyPkceS256(codeVerifier, authCode.code_challenge);
  if (!pkceValid) {
    return oauthError("invalid_grant", "PKCE verification failed");
  }

  // Step 5: Atomically consume the code (only after all checks pass)
  const consumed = await consumeAuthCode(db, code);
  if (!consumed) {
    return oauthError("invalid_grant", "Authorization code already consumed (race condition)");
  }

  // user_email is always set after callback upgrade
  const userEmail = authCode.user_email ?? "";
  if (!userEmail) {
    return oauthError("server_error", "Authorization code missing user email");
  }

  // Step 6: Token rotation — revoke existing tokens for this client
  await revokeTokensByClientId(db, clientId, userEmail);

  // Step 7: Generate and store new token pair
  // Scope from auth code is validated during authorization, safe to cast
  const tokenScope = (authCode.scope === "author" ? "author" : "full") as McpTokenScope;
  return issueTokenPair(db, clientId, userEmail, tokenScope, authCode.client_id);
}

// ---------------------------------------------------------------------------
// Refresh Token Exchange
// ---------------------------------------------------------------------------

async function handleRefreshToken(body: FormData) {
  const refreshToken = body.get("refresh_token") as string | null;
  const clientId = body.get("client_id") as string | null;

  if (!refreshToken || !clientId) {
    return oauthError("invalid_request", "Missing required fields: refresh_token, client_id");
  }

  const db = getDb();

  // Look up token by refresh hash
  const refreshHash = await sha256(refreshToken);
  const existingToken = await getValidTokenByRefreshHash(db, refreshHash);
  if (!existingToken) {
    return oauthError("invalid_grant", "Refresh token is invalid or revoked");
  }

  // Verify client_id matches
  if (existingToken.client_id !== clientId) {
    return oauthError("invalid_grant", "client_id does not match");
  }

  // Token rotation — revoke all tokens for this client
  await revokeTokensByClientId(db, clientId, existingToken.user_email);

  // Issue new token pair
  return issueTokenPair(db, clientId, existingToken.user_email, existingToken.scope, existingToken.client_name);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function issueTokenPair(
  db: ReturnType<typeof getDb>,
  clientId: string,
  userEmail: string,
  scope: McpTokenScope,
  clientName: string | null | undefined,
) {
  const accessToken = generateAccessToken();
  const refreshToken = generateRefreshToken();
  const accessHash = await sha256(accessToken);
  const refreshHash = await sha256(refreshToken);

  // Look up client name if not provided
  let resolvedClientName = clientName;
  if (!resolvedClientName) {
    const client = await getMcpClientByClientId(db, clientId);
    resolvedClientName = client?.client_name;
  }

  await createMcpToken(db, {
    access_token_hash: accessHash,
    access_token_preview: accessToken.slice(0, 16),
    refresh_token_hash: refreshHash,
    client_id: clientId,
    user_email: userEmail,
    scope,
    ...(resolvedClientName ? { client_name: resolvedClientName } : {}),
  });

  return jsonResponse({
    access_token: accessToken,
    token_type: "Bearer",
    refresh_token: refreshToken,
    scope,
  });
}

function oauthError(error: string, description: string) {
  return jsonResponse({ error, error_description: description }, 400);
}
