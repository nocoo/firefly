// ---------------------------------------------------------------------------
// MCP token validation middleware
// ---------------------------------------------------------------------------

import type { Db } from "@/lib/db";
import type { McpToken, AiAgent } from "@/models/types";
import { getValidTokenByHash, updateLastUsed, sha256 } from "@/data/mcp-tokens";
import { getAiAgentByApiKey } from "@/data/entities/ai-agent";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface McpAuthResult {
  valid: true;
  token: McpToken;
}

export interface McpAuthError {
  valid: false;
  status: number;
  error: string;
}

export type McpAuthOutcome = McpAuthResult | McpAuthError;

// Unified auth result — both OAuth and Agent tokens
export type McpUnifiedAuthResult =
  | { type: "oauth"; token: McpToken }
  | { type: "agent"; agent: AiAgent }
  | null;

// ---------------------------------------------------------------------------
// extractBearerToken
// ---------------------------------------------------------------------------

/** Extract bearer token from Authorization header. Returns null if missing/malformed. */
export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(\S+)$/i);
  return match ? match[1] : null;
}

// ---------------------------------------------------------------------------
// validateMcpToken
// ---------------------------------------------------------------------------

/** Validate a bearer token from a request. Updates last_used_at on success. */
export async function validateMcpToken(
  db: Db,
  authHeader: string | null,
): Promise<McpAuthOutcome> {
  const bearerToken = extractBearerToken(authHeader);

  if (!bearerToken) {
    return {
      valid: false,
      status: 401,
      error: "Missing or malformed Authorization header",
    };
  }

  const tokenHash = await sha256(bearerToken);
  const token = await getValidTokenByHash(db, tokenHash);

  if (!token) {
    return {
      valid: false,
      status: 401,
      error: "Invalid, expired, or revoked token",
    };
  }

  // Fire-and-forget: update last_used_at
  updateLastUsed(db, token.id).catch(() => {
    // Intentionally swallow — usage tracking is non-critical
  });

  return { valid: true, token };
}

// ---------------------------------------------------------------------------
// validateMcpAuth — unified auth for both OAuth and Agent tokens
// ---------------------------------------------------------------------------

/**
 * Unified auth function that routes to the correct validator based on token prefix.
 *
 * - `firefly_agent_xxx` → Agent API key validation
 * - `firefly_at_xxx` → OAuth access token validation
 *
 * Returns null if token is missing, malformed, or invalid.
 * Agent auth updates last_used_at in the agent validation function.
 */
export async function validateMcpAuth(
  db: Db,
  authHeader: string | null,
): Promise<McpUnifiedAuthResult> {
  const bearerToken = extractBearerToken(authHeader);
  if (!bearerToken) return null;

  // Route by prefix
  if (bearerToken.startsWith("firefly_agent_")) {
    const agent = await getAiAgentByApiKey(db, bearerToken);
    return agent ? { type: "agent", agent } : null;
  }

  if (bearerToken.startsWith("firefly_at_")) {
    const tokenHash = await sha256(bearerToken);
    const token = await getValidTokenByHash(db, tokenHash);
    if (token) {
      updateLastUsed(db, token.id).catch(() => {});
      return { type: "oauth", token };
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// validateOrigin
// ---------------------------------------------------------------------------

/**
 * Validate Origin header per MCP security spec.
 *
 * The check prevents DNS-rebinding attacks from browser-based origins.
 * Non-web protocols (e.g. vscode-file://, electron://, tauri://) are
 * sent by desktop clients and are not susceptible — allow them through.
 */
export function validateOrigin(
  origin: string | null,
  siteUrl: string,
): McpAuthError | null {
  if (!origin) return null; // CLI clients don't send Origin — allow

  // Allow site origin
  try {
    const siteOrigin = new URL(siteUrl).origin;
    if (origin === siteOrigin) return null;
  } catch {
    // Invalid siteUrl — skip check
  }

  // Only enforce restrictions on http(s) web origins.
  // Non-web protocols (vscode-file://, electron://, tauri://, etc.)
  // come from desktop/IDE clients and cannot perform DNS-rebinding.
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    // Malformed origin — reject
    return {
      valid: false,
      status: 403,
      error: "Origin not allowed",
    };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return null; // Non-web protocol — allow (desktop/IDE client)
  }

  // Allow loopback origins — parse URL and compare hostname exactly
  if (
    parsed.protocol === "http:" &&
    (parsed.hostname === "localhost" ||
      parsed.hostname === "127.0.0.1" ||
      parsed.hostname === "[::1]")
  ) {
    return null;
  }

  return {
    valid: false,
    status: 403,
    error: "Origin not allowed",
  };
}
