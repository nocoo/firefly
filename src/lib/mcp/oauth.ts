// ---------------------------------------------------------------------------
// MCP OAuth PKCE utilities
// ---------------------------------------------------------------------------

import { sha256 } from "@/data/mcp-tokens";

/**
 * Verify PKCE S256 code verifier against stored code challenge.
 * BASE64URL(SHA256(code_verifier)) must equal code_challenge.
 */
export async function verifyPkceS256(
  codeVerifier: string,
  codeChallenge: string,
): Promise<boolean> {
  const encoded = new TextEncoder().encode(codeVerifier);
  const buffer = await crypto.subtle.digest("SHA-256", encoded);
  const base64url = btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return base64url === codeChallenge;
}

/**
 * Validate redirect URI is a loopback address.
 * Only http://localhost, http://127.0.0.1, http://[::1] are allowed.
 */
export function isLoopbackRedirectUri(uri: string): boolean {
  try {
    const url = new URL(uri);
    if (url.protocol !== "http:") return false;
    const host = url.hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
  } catch {
    return false;
  }
}

/**
 * Generate OAuth server metadata for /.well-known/oauth-authorization-server.
 */
export function getOAuthMetadata(issuer: string) {
  return {
    issuer,
    authorization_endpoint: `${issuer}/api/mcp/authorize`,
    token_endpoint: `${issuer}/api/mcp/token`,
    registration_endpoint: `${issuer}/api/mcp/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: ["mcp:full"],
  };
}

// Re-export sha256 for convenience
export { sha256 };
