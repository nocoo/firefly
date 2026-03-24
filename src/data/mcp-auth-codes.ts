// ---------------------------------------------------------------------------
// MCP Auth Code data layer — OAuth authorization sessions & codes
// ---------------------------------------------------------------------------

import type { Db } from "@/lib/db";
import type { McpAuthCode } from "@/models/types";

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface CreateMcpAuthCodeInput {
  state: string;
  client_id: string;
  redirect_uri: string;
  code_challenge: string;
  code_challenge_method?: string;
  scope?: string;
  expires_at: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Authorization code TTL in seconds (10 minutes) */
export const AUTH_CODE_TTL = 10 * 60;

// ---------------------------------------------------------------------------
// createAuthSession
// ---------------------------------------------------------------------------

/** Create an authorization session (stores authorize request params keyed by state). */
export async function createAuthSession(
  db: Db,
  input: CreateMcpAuthCodeInput,
): Promise<void> {
  const sql = `
    INSERT INTO mcp_auth_codes
      (state, client_id, redirect_uri, code_challenge, code_challenge_method, scope, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

  await db.execute(sql, [
    input.state,
    input.client_id,
    input.redirect_uri,
    input.code_challenge,
    input.code_challenge_method ?? "S256",
    input.scope ?? "mcp:full",
    input.expires_at,
  ]);
}

// ---------------------------------------------------------------------------
// upgradeAuthSession
// ---------------------------------------------------------------------------

/** Set the authorization code and user email on an existing session (after Google callback). */
export async function upgradeAuthSession(
  db: Db,
  state: string,
  code: string,
  userEmail: string,
): Promise<boolean> {
  const now = Math.floor(Date.now() / 1000);
  const meta = await db.execute(
    `UPDATE mcp_auth_codes
     SET code = ?, user_email = ?, expires_at = ?
     WHERE state = ? AND code IS NULL AND expires_at > ?`,
    [code, userEmail, now + AUTH_CODE_TTL, state, now],
  );
  return meta.changes > 0;
}

// ---------------------------------------------------------------------------
// getAuthCodeByCode
// ---------------------------------------------------------------------------

/** Look up an auth code (valid, unconsumed, not expired). */
export async function getAuthCodeByCode(
  db: Db,
  code: string,
): Promise<McpAuthCode | null> {
  const now = Math.floor(Date.now() / 1000);
  return db.firstOrNull<McpAuthCode>(
    `SELECT * FROM mcp_auth_codes
     WHERE code = ? AND consumed = 0 AND expires_at > ?`,
    [code, now],
  );
}

// ---------------------------------------------------------------------------
// getAuthSessionByState
// ---------------------------------------------------------------------------

/** Look up an auth session by state (for callback verification). */
export async function getAuthSessionByState(
  db: Db,
  state: string,
): Promise<McpAuthCode | null> {
  const now = Math.floor(Date.now() / 1000);
  return db.firstOrNull<McpAuthCode>(
    `SELECT * FROM mcp_auth_codes
     WHERE state = ? AND expires_at > ?`,
    [state, now],
  );
}

// ---------------------------------------------------------------------------
// consumeAuthCode
// ---------------------------------------------------------------------------

/** Atomically consume an auth code (set consumed = 1). Returns true if consumed. */
export async function consumeAuthCode(
  db: Db,
  code: string,
): Promise<boolean> {
  const meta = await db.execute(
    `UPDATE mcp_auth_codes SET consumed = 1
     WHERE code = ? AND consumed = 0`,
    [code],
  );
  return meta.changes > 0;
}
