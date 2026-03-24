import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { getDb } from "@/lib/db";
import { errorResponse } from "@/lib/api";
import { auth, isEmailAllowed } from "@/lib/auth";
import { getAuthSessionByState, upgradeAuthSession } from "@/data/mcp-auth-codes";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const state = url.searchParams.get("state");

    if (!state) {
      return errorResponse("Missing state parameter");
    }

    // Verify user is authenticated via Google OAuth (Auth.js session)
    const session = await auth();
    if (!session?.user?.email) {
      return errorResponse("Authentication required", 401);
    }

    // Verify email is in the allowed whitelist
    if (!isEmailAllowed(session.user.email)) {
      return errorResponse("Email not authorized", 403);
    }

    // Look up the authorization session by state
    const db = getDb();
    const authSession = await getAuthSessionByState(db, state);
    if (!authSession) {
      return errorResponse("Invalid or expired authorization session");
    }

    // Generate random authorization code (64-char hex = 32 bytes)
    const code = randomBytes(32).toString("hex");

    // Upgrade the session with the code and user email
    const upgraded = await upgradeAuthSession(db, state, code, session.user.email);
    if (!upgraded) {
      return errorResponse("Authorization session already used or expired");
    }

    // Redirect to agent's redirect_uri with code and state
    const redirectUrl = new URL(authSession.redirect_uri);
    redirectUrl.searchParams.set("code", code);
    redirectUrl.searchParams.set("state", state);

    return NextResponse.redirect(redirectUrl.toString());
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Internal server error",
      500,
    );
  }
}
