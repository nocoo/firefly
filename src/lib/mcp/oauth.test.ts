import { describe, it, expect } from "vitest";
import {
  verifyPkceS256,
  isLoopbackRedirectUri,
  getOAuthMetadata,
} from "./oauth";

// ---------------------------------------------------------------------------
// verifyPkceS256
// ---------------------------------------------------------------------------

describe("verifyPkceS256", () => {
  it("returns true for valid verifier/challenge pair", async () => {
    // Generate a known pair: verifier → SHA256 → base64url = challenge
    const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
    // Known S256 challenge for this verifier (RFC 7636 example)
    const encoded = new TextEncoder().encode(verifier);
    const buffer = await crypto.subtle.digest("SHA-256", encoded);
    const challenge = btoa(String.fromCharCode(...new Uint8Array(buffer)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const result = await verifyPkceS256(verifier, challenge);
    expect(result).toBe(true);
  });

  it("returns false for mismatched verifier", async () => {
    const result = await verifyPkceS256("wrong-verifier", "some-challenge");
    expect(result).toBe(false);
  });

  it("handles empty strings", async () => {
    const result = await verifyPkceS256("", "not-empty");
    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isLoopbackRedirectUri
// ---------------------------------------------------------------------------

describe("isLoopbackRedirectUri", () => {
  it("allows http://localhost", () => {
    expect(isLoopbackRedirectUri("http://localhost/callback")).toBe(true);
    expect(isLoopbackRedirectUri("http://localhost:8080/callback")).toBe(true);
    expect(isLoopbackRedirectUri("http://localhost:3000")).toBe(true);
  });

  it("allows http://127.0.0.1", () => {
    expect(isLoopbackRedirectUri("http://127.0.0.1/callback")).toBe(true);
    expect(isLoopbackRedirectUri("http://127.0.0.1:9090/cb")).toBe(true);
  });

  it("allows http://[::1]", () => {
    expect(isLoopbackRedirectUri("http://[::1]/callback")).toBe(true);
    expect(isLoopbackRedirectUri("http://[::1]:8080/cb")).toBe(true);
  });

  it("rejects https://localhost", () => {
    expect(isLoopbackRedirectUri("https://localhost/callback")).toBe(false);
  });

  it("rejects external URLs", () => {
    expect(isLoopbackRedirectUri("http://evil.com/callback")).toBe(false);
    expect(isLoopbackRedirectUri("https://example.com/cb")).toBe(false);
  });

  it("rejects invalid URLs", () => {
    expect(isLoopbackRedirectUri("not-a-url")).toBe(false);
    expect(isLoopbackRedirectUri("")).toBe(false);
  });

  it("rejects custom URI schemes", () => {
    expect(isLoopbackRedirectUri("vscode://callback")).toBe(false);
    expect(isLoopbackRedirectUri("myapp://auth")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getOAuthMetadata
// ---------------------------------------------------------------------------

describe("getOAuthMetadata", () => {
  it("returns correct metadata structure", () => {
    const metadata = getOAuthMetadata("https://lizheng.me");

    expect(metadata.issuer).toBe("https://lizheng.me");
    expect(metadata.authorization_endpoint).toBe("https://lizheng.me/api/mcp/authorize");
    expect(metadata.token_endpoint).toBe("https://lizheng.me/api/mcp/token");
    expect(metadata.registration_endpoint).toBe("https://lizheng.me/api/mcp/register");
    expect(metadata.response_types_supported).toEqual(["code"]);
    expect(metadata.grant_types_supported).toEqual(["authorization_code", "refresh_token"]);
    expect(metadata.code_challenge_methods_supported).toEqual(["S256"]);
    expect(metadata.token_endpoint_auth_methods_supported).toEqual(["none"]);
    expect(metadata.scopes_supported).toEqual(["mcp:full"]);
  });

  it("uses issuer as URL base for all endpoints", () => {
    const metadata = getOAuthMetadata("https://custom.domain.com");

    expect(metadata.authorization_endpoint).toContain("https://custom.domain.com");
    expect(metadata.token_endpoint).toContain("https://custom.domain.com");
    expect(metadata.registration_endpoint).toContain("https://custom.domain.com");
  });
});
