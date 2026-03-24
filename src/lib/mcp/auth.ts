// ---------------------------------------------------------------------------
// MCP token validation middleware
// ---------------------------------------------------------------------------

import type { Db } from "@/lib/db";
import type { McpToken } from "@/models/types";
import { getValidTokenByHash, updateLastUsed, sha256 } from "@/data/mcp-tokens";

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
// validateOrigin
// ---------------------------------------------------------------------------

/** Validate Origin header per MCP security spec. */
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

  // Allow loopback origins
  if (
    origin.startsWith("http://localhost") ||
    origin.startsWith("http://127.0.0.1") ||
    origin.startsWith("http://[::1]")
  ) {
    return null;
  }

  return {
    valid: false,
    status: 403,
    error: "Origin not allowed",
  };
}
