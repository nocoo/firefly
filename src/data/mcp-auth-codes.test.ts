import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Db } from "@/lib/db";
import { createMockDb } from "@/data/core/test-utils";
import type { McpAuthCode } from "@/models/types";
import {
  createAuthSession,
  upgradeAuthSession,
  getAuthCodeByCode,
  getAuthSessionByState,
  consumeAuthCode,
  AUTH_CODE_TTL,
  type CreateMcpAuthCodeInput,
} from "./mcp-auth-codes";

// ---------------------------------------------------------------------------
// Mock DB
// ---------------------------------------------------------------------------


const now = Math.floor(Date.now() / 1000);

const sampleSession: McpAuthCode = {
  state: "random-state-123",
  code: null,
  client_id: "firefly_mcp_01HQ",
  redirect_uri: "http://localhost:8080/callback",
  code_challenge: "abc123",
  code_challenge_method: "S256",
  user_email: null,
  scope: "mcp:full",
  expires_at: now + AUTH_CODE_TTL,
  consumed: 0,
  created_at: now,
};

const sampleCodeRow: McpAuthCode = {
  ...sampleSession,
  code: "authcode123abc",
  user_email: "admin@example.com",
};

// ---------------------------------------------------------------------------
// createAuthSession
// ---------------------------------------------------------------------------

describe("createAuthSession", () => {
  let db: Db;
  beforeEach(() => { db = createMockDb(); });

  it("inserts session with all fields", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 2 });

    const input: CreateMcpAuthCodeInput = {
      state: "random-state-123",
      client_id: "firefly_mcp_01HQ",
      redirect_uri: "http://localhost:8080/callback",
      code_challenge: "abc123",
      expires_at: now + AUTH_CODE_TTL,
    };

    await createAuthSession(db, input);

    expect(db.execute).toHaveBeenCalledOnce();
    const [sql, params] = vi.mocked(db.execute).mock.calls[0];
    expect(sql).toContain("INSERT INTO mcp_auth_codes");
    expect(params![0]).toBe("random-state-123");
    expect(params![4]).toBe("S256"); // default
    expect(params![5]).toBe("mcp:full"); // default
  });

  it("uses custom scope and method when provided", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 2 });

    const input: CreateMcpAuthCodeInput = {
      state: "s1",
      client_id: "c1",
      redirect_uri: "http://localhost/cb",
      code_challenge: "ch",
      code_challenge_method: "S256",
      scope: "mcp:read",
      expires_at: now + 600,
    };

    await createAuthSession(db, input);

    const [, params] = vi.mocked(db.execute).mock.calls[0];
    expect(params![4]).toBe("S256");
    expect(params![5]).toBe("mcp:read");
  });
});

// ---------------------------------------------------------------------------
// upgradeAuthSession
// ---------------------------------------------------------------------------

describe("upgradeAuthSession", () => {
  let db: Db;
  beforeEach(() => { db = createMockDb(); });

  it("returns true when session is upgraded", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 1 });

    const result = await upgradeAuthSession(db, "random-state-123", "code-abc", "user@test.com");

    expect(result).toBe(true);
    const [sql, params] = vi.mocked(db.execute).mock.calls[0];
    expect(sql).toContain("UPDATE mcp_auth_codes");
    expect(sql).toContain("code = ?");
    expect(sql).toContain("user_email = ?");
    expect(params![0]).toBe("code-abc");
    expect(params![1]).toBe("user@test.com");
    expect(params![3]).toBe("random-state-123");
  });

  it("returns false when session not found or already upgraded", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 0, duration: 1 });

    const result = await upgradeAuthSession(db, "bad-state", "code", "user@test.com");
    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getAuthCodeByCode
// ---------------------------------------------------------------------------

describe("getAuthCodeByCode", () => {
  let db: Db;
  beforeEach(() => { db = createMockDb(); });

  it("returns auth code when found and valid", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue(sampleCodeRow);

    const result = await getAuthCodeByCode(db, "authcode123abc");

    const [sql, params] = vi.mocked(db.firstOrNull).mock.calls[0];
    expect(sql).toContain("code = ?");
    expect(sql).toContain("consumed = 0");
    expect(sql).toContain("expires_at > ?");
    expect(params![0]).toBe("authcode123abc");
    expect(result?.code).toBe("authcode123abc");
  });

  it("returns null when not found", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue(null);
    const result = await getAuthCodeByCode(db, "bad-code");
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getAuthSessionByState
// ---------------------------------------------------------------------------

describe("getAuthSessionByState", () => {
  let db: Db;
  beforeEach(() => { db = createMockDb(); });

  it("returns session when found and not expired", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue(sampleSession);

    const result = await getAuthSessionByState(db, "random-state-123");

    const [sql, params] = vi.mocked(db.firstOrNull).mock.calls[0];
    expect(sql).toContain("state = ?");
    expect(sql).toContain("expires_at > ?");
    expect(params![0]).toBe("random-state-123");
    expect(result?.state).toBe("random-state-123");
  });

  it("returns null when not found or expired", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue(null);
    const result = await getAuthSessionByState(db, "expired-state");
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// consumeAuthCode
// ---------------------------------------------------------------------------

describe("consumeAuthCode", () => {
  let db: Db;
  beforeEach(() => { db = createMockDb(); });

  it("returns true when code consumed successfully", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 1 });

    const result = await consumeAuthCode(db, "authcode123abc");

    const [sql, params] = vi.mocked(db.execute).mock.calls[0];
    expect(sql).toContain("consumed = 1");
    expect(sql).toContain("consumed = 0");
    expect(params![0]).toBe("authcode123abc");
    expect(result).toBe(true);
  });

  it("returns false when already consumed (race condition)", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 0, duration: 1 });

    const result = await consumeAuthCode(db, "already-consumed");
    expect(result).toBe(false);
  });
});
