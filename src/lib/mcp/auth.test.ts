import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Db } from "@/lib/db";
import { createMockDb } from "@/data/core/test-utils";
import type { McpToken, AiAgent } from "@/models/types";
import {
  extractBearerToken,
  validateMcpToken,
  validateMcpAuth,
  validateOrigin,
} from "./auth";

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------

vi.mock("@/data/mcp-tokens", () => ({
  getValidTokenByHash: vi.fn(),
  updateLastUsed: vi.fn().mockResolvedValue(undefined),
  sha256: vi.fn().mockImplementation(async (input: string) => `hashed_${input}`),
}));

vi.mock("@/data/entities/ai-agent", () => ({
  getAiAgentByApiKey: vi.fn(),
}));

import { getValidTokenByHash, updateLastUsed } from "@/data/mcp-tokens";
import { getAiAgentByApiKey } from "@/data/entities/ai-agent";


const now = Math.floor(Date.now() / 1000);

const sampleToken: McpToken = {
  id: "tok-1",
  access_token_hash: "hashed_firefly_at_abc",
  access_token_preview: "firefly_at_abc1",
  refresh_token_hash: "hashed_rt",
  client_id: "firefly_mcp_01HQ",
  user_email: "admin@example.com",
  scope: "mcp:full",
  client_name: "Claude Code",
  last_used_at: null,
  expires_at: now + 86400,
  refresh_expires_at: now + 86400 * 90,
  revoked: 0,
  revoked_at: null,
  created_at: now,
};

const sampleAgent: AiAgent = {
  id: "agent-1",
  name: "Claude Daily",
  slug: "claude-daily",
  description: "Daily journal",
  category_id: "cat-1",
  api_key_hash: "hashed_firefly_agent_abc",
  api_key_preview: "gent_abc",
  avatar_version: null,
  is_active: 1,
  last_used_at: null,
  created_at: now,
  updated_at: now,
};

// ---------------------------------------------------------------------------
// extractBearerToken
// ---------------------------------------------------------------------------

describe("extractBearerToken", () => {
  it("extracts token from valid header", () => {
    expect(extractBearerToken("Bearer abc123")).toBe("abc123");
  });

  it("is case-insensitive for Bearer keyword", () => {
    expect(extractBearerToken("bearer abc123")).toBe("abc123");
    expect(extractBearerToken("BEARER abc123")).toBe("abc123");
  });

  it("returns null for null header", () => {
    expect(extractBearerToken(null)).toBeNull();
  });

  it("returns null for empty header", () => {
    expect(extractBearerToken("")).toBeNull();
  });

  it("returns null for non-Bearer auth", () => {
    expect(extractBearerToken("Basic abc123")).toBeNull();
  });

  it("returns null for Bearer without token", () => {
    expect(extractBearerToken("Bearer ")).toBeNull();
    expect(extractBearerToken("Bearer")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// validateMcpToken
// ---------------------------------------------------------------------------

describe("validateMcpToken", () => {
  let db: Db;
  beforeEach(() => {
    db = createMockDb();
    vi.mocked(getValidTokenByHash).mockReset();
    vi.mocked(updateLastUsed).mockReset().mockResolvedValue(undefined);
  });

  it("returns error for missing Authorization header", async () => {
    const result = await validateMcpToken(db, null);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.status).toBe(401);
      expect(result.error).toContain("Missing");
    }
  });

  it("returns error for malformed Authorization header", async () => {
    const result = await validateMcpToken(db, "Basic abc");
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.status).toBe(401);
    }
  });

  it("returns error for invalid token", async () => {
    vi.mocked(getValidTokenByHash).mockResolvedValue(null);

    const result = await validateMcpToken(db, "Bearer bad_token");
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.status).toBe(401);
      expect(result.error).toContain("Invalid");
    }
  });

  it("returns valid result with token for good bearer", async () => {
    vi.mocked(getValidTokenByHash).mockResolvedValue(sampleToken);

    const result = await validateMcpToken(db, "Bearer firefly_at_abc");
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.token.id).toBe("tok-1");
    }
  });

  it("calls updateLastUsed on valid token", async () => {
    vi.mocked(getValidTokenByHash).mockResolvedValue(sampleToken);

    await validateMcpToken(db, "Bearer firefly_at_abc");

    // Allow fire-and-forget to complete
    await new Promise((r) => setTimeout(r, 10));
    expect(updateLastUsed).toHaveBeenCalledWith(db, "tok-1");
  });

  it("hashes token before lookup", async () => {
    vi.mocked(getValidTokenByHash).mockResolvedValue(sampleToken);

    await validateMcpToken(db, "Bearer my_token");

    expect(getValidTokenByHash).toHaveBeenCalledWith(db, "hashed_my_token");
  });
});

// ---------------------------------------------------------------------------
// validateMcpAuth (unified)
// ---------------------------------------------------------------------------

describe("validateMcpAuth", () => {
  let db: Db;
  beforeEach(() => {
    db = createMockDb();
    vi.mocked(getValidTokenByHash).mockReset();
    vi.mocked(getAiAgentByApiKey).mockReset();
    vi.mocked(updateLastUsed).mockReset().mockResolvedValue(undefined);
  });

  it("returns null for missing Authorization header", async () => {
    const result = await validateMcpAuth(db, null);
    expect(result).toBeNull();
  });

  it("returns null for malformed Authorization header", async () => {
    const result = await validateMcpAuth(db, "Basic abc");
    expect(result).toBeNull();
  });

  it("routes firefly_agent_ tokens to agent validation", async () => {
    vi.mocked(getAiAgentByApiKey).mockResolvedValue(sampleAgent);

    const result = await validateMcpAuth(db, "Bearer firefly_agent_abc123");

    expect(getAiAgentByApiKey).toHaveBeenCalledWith(db, "firefly_agent_abc123");
    expect(getValidTokenByHash).not.toHaveBeenCalled();
    expect(result).toEqual({ type: "agent", agent: sampleAgent });
  });

  it("routes firefly_at_ tokens to OAuth validation", async () => {
    vi.mocked(getValidTokenByHash).mockResolvedValue(sampleToken);

    const result = await validateMcpAuth(db, "Bearer firefly_at_abc123");

    expect(getAiAgentByApiKey).not.toHaveBeenCalled();
    expect(getValidTokenByHash).toHaveBeenCalledWith(db, "hashed_firefly_at_abc123");
    expect(result).toEqual({ type: "oauth", token: sampleToken });
  });

  it("returns null for invalid agent token", async () => {
    vi.mocked(getAiAgentByApiKey).mockResolvedValue(null);

    const result = await validateMcpAuth(db, "Bearer firefly_agent_invalid");
    expect(result).toBeNull();
  });

  it("returns null for invalid OAuth token", async () => {
    vi.mocked(getValidTokenByHash).mockResolvedValue(null);

    const result = await validateMcpAuth(db, "Bearer firefly_at_invalid");
    expect(result).toBeNull();
  });

  it("returns null for unknown token prefix", async () => {
    const result = await validateMcpAuth(db, "Bearer unknown_prefix_token");
    expect(result).toBeNull();
    expect(getAiAgentByApiKey).not.toHaveBeenCalled();
    expect(getValidTokenByHash).not.toHaveBeenCalled();
  });

  it("updates last_used_at for valid OAuth token", async () => {
    vi.mocked(getValidTokenByHash).mockResolvedValue(sampleToken);

    await validateMcpAuth(db, "Bearer firefly_at_abc");

    await new Promise((r) => setTimeout(r, 10));
    expect(updateLastUsed).toHaveBeenCalledWith(db, "tok-1");
  });
});

// ---------------------------------------------------------------------------
// validateOrigin
// ---------------------------------------------------------------------------

describe("validateOrigin", () => {
  const siteUrl = "https://example.com";

  it("allows null origin (CLI clients)", () => {
    expect(validateOrigin(null, siteUrl)).toBeNull();
  });

  it("allows matching site origin", () => {
    expect(validateOrigin("https://example.com", siteUrl)).toBeNull();
  });

  it("allows localhost origin", () => {
    expect(validateOrigin("http://localhost:8080", siteUrl)).toBeNull();
    expect(validateOrigin("http://localhost", siteUrl)).toBeNull();
  });

  it("allows 127.0.0.1 origin", () => {
    expect(validateOrigin("http://127.0.0.1:3000", siteUrl)).toBeNull();
  });

  it("allows [::1] origin", () => {
    expect(validateOrigin("http://[::1]:8080", siteUrl)).toBeNull();
  });

  it("rejects unknown origin", () => {
    const result = validateOrigin("https://evil.com", siteUrl);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(403);
    expect(result!.error).toContain("Origin not allowed");
  });

  it("rejects spoofed loopback hostname (localhost.evil.com)", () => {
    const result = validateOrigin("http://localhost.evil.com", siteUrl);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(403);
  });

  it("rejects spoofed 127.0.0.1 with suffix", () => {
    const result = validateOrigin("http://127.0.0.1.evil.com", siteUrl);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(403);
  });

  it("rejects malformed origin", () => {
    const result = validateOrigin("not-a-url", siteUrl);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(403);
  });

  it("rejects https://localhost (not http)", () => {
    const result = validateOrigin("https://localhost:3000", siteUrl);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(403);
  });

  it("allows non-web protocol origins (desktop/IDE clients)", () => {
    // VSCode
    expect(validateOrigin("vscode-file://vscode-app", siteUrl)).toBeNull();
    // Electron
    expect(validateOrigin("electron://app", siteUrl)).toBeNull();
    // Tauri
    expect(validateOrigin("tauri://localhost", siteUrl)).toBeNull();
    // Custom app
    expect(validateOrigin("my-app://callback", siteUrl)).toBeNull();
  });
});
