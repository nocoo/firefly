import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Db } from "@/lib/db";
import { createMockDb } from "@/data/core/test-utils";
import type { McpToken } from "@/models/types";
import {
  createMcpToken,
  getMcpTokenById,
  getValidTokenByHash,
  getValidTokenByRefreshHash,
  updateLastUsed,
  revokeToken,
  revokeTokensByClientId,
  listMcpTokens,
  deleteMcpToken,
  deleteRevokedTokens,
  countRevokedTokens,
  updateTokenScope,
  sha256,
  randomHex,
  generateAccessToken,
  generateRefreshToken,
  type CreateMcpTokenInput,
} from "./mcp-tokens";

// ---------------------------------------------------------------------------
// Mock DB
// ---------------------------------------------------------------------------


const now = Math.floor(Date.now() / 1000);

const sampleToken: McpToken = {
  id: "tok-1",
  access_token_hash: "hash_at",
  access_token_preview: "firefly_at_a1b2",
  refresh_token_hash: "hash_rt",
  client_id: "firefly_mcp_01HQ",
  user_email: "admin@example.com",
  scope: "full",
  client_name: "Claude Code",
  last_used_at: null,
  revoked: 0,
  revoked_at: null,
  created_at: now,
};

// ---------------------------------------------------------------------------
// Token generation helpers
// ---------------------------------------------------------------------------

describe("randomHex", () => {
  it("generates hex string of correct length", () => {
    const hex = randomHex(24);
    expect(hex).toMatch(/^[0-9a-f]{48}$/);
  });

  it("generates different values each call", () => {
    const a = randomHex(24);
    const b = randomHex(24);
    expect(a).not.toBe(b);
  });
});

describe("sha256", () => {
  it("returns consistent hash for same input", async () => {
    const h1 = await sha256("test");
    const h2 = await sha256("test");
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
  });

  it("returns different hash for different input", async () => {
    const h1 = await sha256("a");
    const h2 = await sha256("b");
    expect(h1).not.toBe(h2);
  });
});

describe("generateAccessToken", () => {
  it("has correct prefix", () => {
    const token = generateAccessToken();
    expect(token).toMatch(/^firefly_at_[0-9a-f]{48}$/);
  });
});

describe("generateRefreshToken", () => {
  it("has correct prefix", () => {
    const token = generateRefreshToken();
    expect(token).toMatch(/^firefly_rt_[0-9a-f]{48}$/);
  });
});

// ---------------------------------------------------------------------------
// createMcpToken
// ---------------------------------------------------------------------------

describe("createMcpToken", () => {
  let db: Db;
  beforeEach(() => { db = createMockDb(); });

  it("inserts token and returns it", async () => {
    const input: CreateMcpTokenInput = {
      access_token_hash: "hash_at",
      access_token_preview: "firefly_at_a1b2",
      refresh_token_hash: "hash_rt",
      client_id: "firefly_mcp_01HQ",
      user_email: "admin@example.com",
      client_name: "Claude Code",
    };

    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 3 });
    vi.mocked(db.firstOrNull).mockResolvedValue(sampleToken);

    const result = await createMcpToken(db, input);

    expect(db.execute).toHaveBeenCalledOnce();
    const [sql, params] = vi.mocked(db.execute).mock.calls[0];
    expect(sql).toContain("INSERT INTO mcp_tokens");
    expect(params![1]).toBe("hash_at");
    expect(params![3]).toBe("hash_rt");
    expect(params![4]).toBe("firefly_mcp_01HQ");
    expect(params![5]).toBe("admin@example.com");
    expect(params![6]).toBe("full"); // default scope
    expect(result.client_name).toBe("Claude Code");
  });

  it("throws when re-read fails", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 1 });
    vi.mocked(db.firstOrNull).mockResolvedValue(null);

    await expect(
      createMcpToken(db, {
        access_token_hash: "h",
        access_token_preview: "p",
        refresh_token_hash: "r",
        client_id: "c",
        user_email: "e",
      }),
    ).rejects.toThrow("Failed to retrieve mcp_token");
  });
});

// ---------------------------------------------------------------------------
// getMcpTokenById
// ---------------------------------------------------------------------------

describe("getMcpTokenById", () => {
  let db: Db;
  beforeEach(() => { db = createMockDb(); });

  it("returns token when found", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue(sampleToken);

    const result = await getMcpTokenById(db, "tok-1");

    const [sql, params] = vi.mocked(db.firstOrNull).mock.calls[0];
    expect(sql).toContain("id = ?");
    expect(params).toEqual(["tok-1"]);
    expect(result?.id).toBe("tok-1");
  });

  it("returns null when not found", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue(null);
    const result = await getMcpTokenById(db, "missing");
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getValidTokenByHash
// ---------------------------------------------------------------------------

describe("getValidTokenByHash", () => {
  let db: Db;
  beforeEach(() => { db = createMockDb(); });

  it("returns token when valid", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue(sampleToken);

    const result = await getValidTokenByHash(db, "hash_at");

    const [sql, params] = vi.mocked(db.firstOrNull).mock.calls[0];
    expect(sql).toContain("access_token_hash = ?");
    expect(sql).toContain("revoked = 0");
    expect(sql).not.toContain("expires_at");
    expect(params).toEqual(["hash_at"]);
    expect(result?.access_token_hash).toBe("hash_at");
  });

  it("returns null for revoked/missing token", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue(null);
    const result = await getValidTokenByHash(db, "bad_hash");
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getValidTokenByRefreshHash
// ---------------------------------------------------------------------------

describe("getValidTokenByRefreshHash", () => {
  let db: Db;
  beforeEach(() => { db = createMockDb(); });

  it("returns token when refresh is valid", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue(sampleToken);

    const result = await getValidTokenByRefreshHash(db, "hash_rt");

    const [sql, params] = vi.mocked(db.firstOrNull).mock.calls[0];
    expect(sql).toContain("refresh_token_hash = ?");
    expect(sql).toContain("revoked = 0");
    expect(sql).not.toContain("refresh_expires_at");
    expect(params).toEqual(["hash_rt"]);
    expect(result?.refresh_token_hash).toBe("hash_rt");
  });

  it("returns null for invalid refresh token", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue(null);
    const result = await getValidTokenByRefreshHash(db, "bad");
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// updateLastUsed
// ---------------------------------------------------------------------------

describe("updateLastUsed", () => {
  let db: Db;
  beforeEach(() => { db = createMockDb(); });

  it("updates last_used_at timestamp", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 1 });

    await updateLastUsed(db, "tok-1");

    const [sql, params] = vi.mocked(db.execute).mock.calls[0];
    expect(sql).toContain("last_used_at = ?");
    expect(params![1]).toBe("tok-1");
  });
});

// ---------------------------------------------------------------------------
// revokeToken
// ---------------------------------------------------------------------------

describe("revokeToken", () => {
  let db: Db;
  beforeEach(() => { db = createMockDb(); });

  it("revokes active token and returns true", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 1 });

    const result = await revokeToken(db, "tok-1");

    const [sql, params] = vi.mocked(db.execute).mock.calls[0];
    expect(sql).toContain("revoked = 1");
    expect(sql).toContain("revoked = 0");
    expect(params![1]).toBe("tok-1");
    expect(result).toBe(true);
  });

  it("returns false when already revoked", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 0, duration: 1 });
    const result = await revokeToken(db, "already-revoked");
    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// revokeTokensByClientId
// ---------------------------------------------------------------------------

describe("revokeTokensByClientId", () => {
  let db: Db;
  beforeEach(() => { db = createMockDb(); });

  it("revokes all active tokens for client and returns count", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 3, duration: 2 });

    const result = await revokeTokensByClientId(db, "firefly_mcp_01HQ", "admin@example.com");

    const [sql, params] = vi.mocked(db.execute).mock.calls[0];
    expect(sql).toContain("client_id = ?");
    expect(sql).toContain("user_email = ?");
    expect(sql).toContain("revoked = 1");
    expect(params![1]).toBe("firefly_mcp_01HQ");
    expect(params![2]).toBe("admin@example.com");
    expect(result).toBe(3);
  });

  it("returns 0 when no active tokens", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 0, duration: 1 });
    const result = await revokeTokensByClientId(db, "c", "e");
    expect(result).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// listMcpTokens
// ---------------------------------------------------------------------------

describe("listMcpTokens", () => {
  let db: Db;
  beforeEach(() => { db = createMockDb(); });

  it("returns all tokens ordered by created_at DESC", async () => {
    vi.mocked(db.query).mockResolvedValue({
      results: [sampleToken],
      meta: { changes: 0, duration: 1 },
    });

    const result = await listMcpTokens(db);

    const [sql] = vi.mocked(db.query).mock.calls[0];
    expect(sql).toContain("SELECT");
    expect(sql).toContain("ORDER BY created_at DESC");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("tok-1");
  });
});

// ---------------------------------------------------------------------------
// deleteMcpToken
// ---------------------------------------------------------------------------

describe("deleteMcpToken", () => {
  let db: Db;
  beforeEach(() => { db = createMockDb(); });

  it("deletes revoked token and returns true", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 1 });

    const result = await deleteMcpToken(db, "tok-1");

    const [sql, params] = vi.mocked(db.execute).mock.calls[0];
    expect(sql).toContain("DELETE FROM mcp_tokens");
    expect(sql).toContain("revoked = 1");
    expect(params![0]).toBe("tok-1");
    expect(result).toBe(true);
  });

  it("returns false when token not found or not revoked", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 0, duration: 1 });

    const result = await deleteMcpToken(db, "tok-active");

    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// deleteRevokedTokens
// ---------------------------------------------------------------------------

describe("deleteRevokedTokens", () => {
  let db: Db;
  beforeEach(() => { db = createMockDb(); });

  it("deletes all revoked tokens and returns count", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 5, duration: 2 });

    const result = await deleteRevokedTokens(db);

    const [sql] = vi.mocked(db.execute).mock.calls[0];
    expect(sql).toContain("DELETE FROM mcp_tokens");
    expect(sql).toContain("revoked = 1");
    expect(result).toBe(5);
  });

  it("returns 0 when no revoked tokens", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 0, duration: 1 });

    const result = await deleteRevokedTokens(db);

    expect(result).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// countRevokedTokens
// ---------------------------------------------------------------------------

describe("countRevokedTokens", () => {
  let db: Db;
  beforeEach(() => { db = createMockDb(); });

  it("returns count of revoked tokens", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue({ count: 3 });

    const result = await countRevokedTokens(db);

    const [sql] = vi.mocked(db.firstOrNull).mock.calls[0];
    expect(sql).toContain("COUNT(*)");
    expect(sql).toContain("revoked = 1");
    expect(result).toBe(3);
  });

  it("returns 0 when no revoked tokens", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue({ count: 0 });

    const result = await countRevokedTokens(db);

    expect(result).toBe(0);
  });

  it("returns 0 when query returns null", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue(null);

    const result = await countRevokedTokens(db);

    expect(result).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// updateTokenScope
// ---------------------------------------------------------------------------

describe("updateTokenScope", () => {
  let db: Db;
  beforeEach(() => { db = createMockDb(); });

  it("updates scope of active token and returns true", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 1 });

    const result = await updateTokenScope(db, "tok-1", "author");

    const [sql, params] = vi.mocked(db.execute).mock.calls[0];
    expect(sql).toContain("UPDATE mcp_tokens");
    expect(sql).toContain("scope = ?");
    expect(sql).toContain("revoked = 0");
    expect(params![0]).toBe("author");
    expect(params![1]).toBe("tok-1");
    expect(result).toBe(true);
  });

  it("returns false when token is revoked or not found", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 0, duration: 1 });

    const result = await updateTokenScope(db, "revoked-tok", "full");

    expect(result).toBe(false);
  });

  it("accepts 'full' scope value", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 1 });

    const result = await updateTokenScope(db, "tok-1", "full");

    const [, params] = vi.mocked(db.execute).mock.calls[0];
    expect(params![0]).toBe("full");
    expect(result).toBe(true);
  });
});
