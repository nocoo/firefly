// ---------------------------------------------------------------------------
// MCP Token data layer — access & refresh token management
// ---------------------------------------------------------------------------

import type { Db } from "@/lib/db";
import { nowEpoch, newId } from "@/data/core/timestamps";
import type { McpToken, McpTokenScope } from "@/models/types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Access token TTL: 30 days in seconds */
export const ACCESS_TOKEN_TTL = 30 * 24 * 60 * 60;

/** Refresh token TTL: 90 days in seconds */
export const REFRESH_TOKEN_TTL = 90 * 24 * 60 * 60;

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface CreateMcpTokenInput {
  access_token_hash: string;
  access_token_preview: string;
  refresh_token_hash: string;
  client_id: string;
  user_email: string;
  scope?: McpTokenScope;
  client_name?: string;
}

// ---------------------------------------------------------------------------
// Token generation helpers
// ---------------------------------------------------------------------------

/** Generate a random hex string of given byte length. */
export function randomHex(bytes: number): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Compute SHA-256 hex hash of a string. */
export async function sha256(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input);
  const buffer = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Generate a new access token with prefix. */
export function generateAccessToken(): string {
  return `firefly_at_${randomHex(24)}`;
}

/** Generate a new refresh token with prefix. */
export function generateRefreshToken(): string {
  return `firefly_rt_${randomHex(24)}`;
}

// ---------------------------------------------------------------------------
// createMcpToken
// ---------------------------------------------------------------------------

export async function createMcpToken(
  db: Db,
  input: CreateMcpTokenInput,
): Promise<McpToken> {
  const id = newId();
  const now = nowEpoch();

  const sql = `
    INSERT INTO mcp_tokens
      (id, access_token_hash, access_token_preview, refresh_token_hash,
       client_id, user_email, scope, client_name, expires_at, refresh_expires_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  await db.execute(sql, [
    id,
    input.access_token_hash,
    input.access_token_preview,
    input.refresh_token_hash,
    input.client_id,
    input.user_email,
    input.scope ?? "full",
    input.client_name ?? null,
    now + ACCESS_TOKEN_TTL,
    now + REFRESH_TOKEN_TTL,
    now,
  ]);

  const token = await getMcpTokenById(db, id);
  if (!token) throw new Error(`Failed to retrieve mcp_token ${id} after creation`);
  return token;
}

// ---------------------------------------------------------------------------
// getMcpTokenById
// ---------------------------------------------------------------------------

export async function getMcpTokenById(
  db: Db,
  id: string,
): Promise<McpToken | null> {
  return db.firstOrNull<McpToken>(
    "SELECT * FROM mcp_tokens WHERE id = ?",
    [id],
  );
}

// ---------------------------------------------------------------------------
// getValidTokenByHash
// ---------------------------------------------------------------------------

/** Look up a valid (not revoked, not expired) token by access_token_hash. */
export async function getValidTokenByHash(
  db: Db,
  accessTokenHash: string,
): Promise<McpToken | null> {
  const now = nowEpoch();
  return db.firstOrNull<McpToken>(
    `SELECT * FROM mcp_tokens
     WHERE access_token_hash = ? AND revoked = 0 AND expires_at > ?`,
    [accessTokenHash, now],
  );
}

// ---------------------------------------------------------------------------
// getValidTokenByRefreshHash
// ---------------------------------------------------------------------------

/** Look up a valid token by refresh_token_hash (for token refresh). */
export async function getValidTokenByRefreshHash(
  db: Db,
  refreshTokenHash: string,
): Promise<McpToken | null> {
  const now = nowEpoch();
  return db.firstOrNull<McpToken>(
    `SELECT * FROM mcp_tokens
     WHERE refresh_token_hash = ? AND revoked = 0 AND refresh_expires_at > ?`,
    [refreshTokenHash, now],
  );
}

// ---------------------------------------------------------------------------
// updateLastUsed
// ---------------------------------------------------------------------------

/** Update last_used_at timestamp for a token. */
export async function updateLastUsed(
  db: Db,
  id: string,
): Promise<void> {
  const now = nowEpoch();
  await db.execute(
    "UPDATE mcp_tokens SET last_used_at = ? WHERE id = ?",
    [now, id],
  );
}

// ---------------------------------------------------------------------------
// revokeToken
// ---------------------------------------------------------------------------

/** Revoke a token by ID. */
export async function revokeToken(
  db: Db,
  id: string,
): Promise<boolean> {
  const now = nowEpoch();
  const meta = await db.execute(
    "UPDATE mcp_tokens SET revoked = 1, revoked_at = ? WHERE id = ? AND revoked = 0",
    [now, id],
  );
  return meta.changes > 0;
}

// ---------------------------------------------------------------------------
// revokeTokenByClientId
// ---------------------------------------------------------------------------

/** Revoke all tokens for a client (used during token rotation). */
export async function revokeTokensByClientId(
  db: Db,
  clientId: string,
  userEmail: string,
): Promise<number> {
  const now = nowEpoch();
  const meta = await db.execute(
    "UPDATE mcp_tokens SET revoked = 1, revoked_at = ? WHERE client_id = ? AND user_email = ? AND revoked = 0",
    [now, clientId, userEmail],
  );
  return meta.changes;
}

// ---------------------------------------------------------------------------
// listMcpTokens
// ---------------------------------------------------------------------------

/** List all tokens (for admin display). */
export async function listMcpTokens(
  db: Db,
): Promise<McpToken[]> {
  const result = await db.query<McpToken>(
    "SELECT * FROM mcp_tokens ORDER BY created_at DESC",
  );
  return result.results;
}

// ---------------------------------------------------------------------------
// updateTokenScope
// ---------------------------------------------------------------------------

/** Update the scope of an active (non-revoked) token. Returns true if updated. */
export async function updateTokenScope(
  db: Db,
  id: string,
  scope: McpTokenScope,
): Promise<boolean> {
  const meta = await db.execute(
    "UPDATE mcp_tokens SET scope = ? WHERE id = ? AND revoked = 0",
    [scope, id],
  );
  return meta.changes > 0;
}

// ---------------------------------------------------------------------------
// deleteMcpToken
// ---------------------------------------------------------------------------

/** Permanently delete a token by ID (only allowed for revoked tokens). */
export async function deleteMcpToken(
  db: Db,
  id: string,
): Promise<boolean> {
  const meta = await db.execute(
    "DELETE FROM mcp_tokens WHERE id = ? AND revoked = 1",
    [id],
  );
  return meta.changes > 0;
}

// ---------------------------------------------------------------------------
// deleteRevokedTokens
// ---------------------------------------------------------------------------

/** Permanently delete all revoked tokens. Returns number of deleted tokens. */
export async function deleteRevokedTokens(
  db: Db,
): Promise<number> {
  const meta = await db.execute(
    "DELETE FROM mcp_tokens WHERE revoked = 1",
  );
  return meta.changes;
}

// ---------------------------------------------------------------------------
// countRevokedTokens
// ---------------------------------------------------------------------------

/** Count revoked tokens. */
export async function countRevokedTokens(
  db: Db,
): Promise<number> {
  const row = await db.firstOrNull<{ count: number }>(
    "SELECT COUNT(*) as count FROM mcp_tokens WHERE revoked = 1",
  );
  return row?.count ?? 0;
}
