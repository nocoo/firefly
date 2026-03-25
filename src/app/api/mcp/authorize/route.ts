import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { errorResponse } from "@/lib/api";
import { auth } from "@/lib/auth";
import { getMcpClientByClientId } from "@/data/mcp-clients";
import { createAuthSession, AUTH_CODE_TTL } from "@/data/mcp-auth-codes";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const params = url.searchParams;

    const responseType = params.get("response_type");
    const clientId = params.get("client_id");
    const redirectUri = params.get("redirect_uri");
    const codeChallenge = params.get("code_challenge");
    const codeChallengeMethod = params.get("code_challenge_method");
    const state = params.get("state");
    const scope = params.get("scope") ?? "mcp:full";

    // Validate required params
    if (!responseType || !clientId || !redirectUri || !codeChallenge || !codeChallengeMethod || !state) {
      return errorResponse("Missing required parameters: response_type, client_id, redirect_uri, code_challenge, code_challenge_method, state");
    }

    if (responseType !== "code") {
      return errorResponse("response_type must be 'code'");
    }

    if (codeChallengeMethod !== "S256") {
      return errorResponse("code_challenge_method must be 'S256'");
    }

    // Verify client exists
    const db = getDb();
    const client = await getMcpClientByClientId(db, clientId);
    if (!client) {
      return errorResponse("Unknown client_id", 401);
    }

    // Verify redirect_uri matches registered URIs
    const registeredUris: string[] = JSON.parse(client.redirect_uris);
    if (!registeredUris.includes(redirectUri)) {
      return errorResponse("redirect_uri does not match any registered URIs");
    }

    // Store authorization session keyed by state
    const now = Math.floor(Date.now() / 1000);
    await createAuthSession(db, {
      state,
      client_id: clientId,
      redirect_uri: redirectUri,
      code_challenge: codeChallenge,
      code_challenge_method: codeChallengeMethod,
      scope,
      expires_at: now + AUTH_CODE_TTL,
    });

    // Build the MCP callback URL
    const siteUrl = process.env.AUTH_URL ?? "http://localhost:3000";
    const callbackUrl = `${siteUrl}/api/mcp/callback?state=${encodeURIComponent(state)}`;

    // If user already has a session, go straight to callback
    const session = await auth();
    if (session?.user?.email) {
      return NextResponse.redirect(callbackUrl);
    }

    // Otherwise, redirect to login page which handles Google OAuth.
    // After login, NextAuth will redirect back to callbackUrl.
    const loginUrl = `${siteUrl}/login?callbackUrl=${encodeURIComponent(callbackUrl)}`;
    return NextResponse.redirect(loginUrl);
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Internal server error",
      500,
    );
  }
}
