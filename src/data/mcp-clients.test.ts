import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Db } from "@/lib/db";
import { createMockDb } from "@/data/core/test-utils";
import type { McpClient } from "@/models/types";
import {
  createMcpClient,
  getMcpClientById,
  getMcpClientByClientId,
  type CreateMcpClientInput,
} from "./mcp-clients";

// ---------------------------------------------------------------------------
// Mock DB
// ---------------------------------------------------------------------------


const now = Math.floor(Date.now() / 1000);

const sampleClient: McpClient = {
  id: "client-1",
  client_id: "firefly_mcp_01HQ",
  client_name: "Claude Code",
  client_secret: null,
  redirect_uris: '["http://localhost:8080/callback"]',
  grant_types: '["authorization_code"]',
  created_at: now,
};

// ---------------------------------------------------------------------------
// createMcpClient
// ---------------------------------------------------------------------------

describe("createMcpClient", () => {
  let db: Db;
  beforeEach(() => { db = createMockDb(); });

  it("inserts client and returns it", async () => {
    const input: CreateMcpClientInput = {
      client_name: "Claude Code",
      redirect_uris: ["http://localhost:8080/callback"],
    };

    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 3 });
    vi.mocked(db.firstOrNull).mockResolvedValue(sampleClient);

    const result = await createMcpClient(db, input);

    expect(db.execute).toHaveBeenCalledOnce();
    const [sql, params] = vi.mocked(db.execute).mock.calls[0];
    expect(sql).toContain("INSERT INTO mcp_clients");
    expect(params![2]).toBe("Claude Code");
    expect(params![3]).toBe('["http://localhost:8080/callback"]');
    expect(params![4]).toBe('["authorization_code"]');
    expect(result.client_name).toBe("Claude Code");
  });

  it("uses custom grant_types when provided", async () => {
    const input: CreateMcpClientInput = {
      client_name: "Custom Client",
      redirect_uris: ["http://localhost:3000/cb"],
      grant_types: ["authorization_code", "refresh_token"],
    };

    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 2 });
    vi.mocked(db.firstOrNull).mockResolvedValue({
      ...sampleClient,
      client_name: "Custom Client",
      grant_types: '["authorization_code","refresh_token"]',
    });

    const result = await createMcpClient(db, input);

    const [, params] = vi.mocked(db.execute).mock.calls[0];
    expect(params![4]).toBe('["authorization_code","refresh_token"]');
    expect(result.client_name).toBe("Custom Client");
  });

  it("throws when re-read fails", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 1 });
    vi.mocked(db.firstOrNull).mockResolvedValue(null);

    await expect(
      createMcpClient(db, { client_name: "X", redirect_uris: ["http://localhost/cb"] }),
    ).rejects.toThrow("Failed to retrieve mcp_client");
  });
});

// ---------------------------------------------------------------------------
// getMcpClientById
// ---------------------------------------------------------------------------

describe("getMcpClientById", () => {
  let db: Db;
  beforeEach(() => { db = createMockDb(); });

  it("returns client when found", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue(sampleClient);

    const result = await getMcpClientById(db, "client-1");

    const [sql, params] = vi.mocked(db.firstOrNull).mock.calls[0];
    expect(sql).toContain("id = ?");
    expect(params).toEqual(["client-1"]);
    expect(result?.client_name).toBe("Claude Code");
  });

  it("returns null when not found", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue(null);
    const result = await getMcpClientById(db, "nonexistent");
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getMcpClientByClientId
// ---------------------------------------------------------------------------

describe("getMcpClientByClientId", () => {
  let db: Db;
  beforeEach(() => { db = createMockDb(); });

  it("returns client when found by client_id", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue(sampleClient);

    const result = await getMcpClientByClientId(db, "firefly_mcp_01HQ");

    const [sql, params] = vi.mocked(db.firstOrNull).mock.calls[0];
    expect(sql).toContain("client_id = ?");
    expect(params).toEqual(["firefly_mcp_01HQ"]);
    expect(result?.client_id).toBe("firefly_mcp_01HQ");
  });

  it("returns null when not found", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue(null);
    const result = await getMcpClientByClientId(db, "nonexistent");
    expect(result).toBeNull();
  });
});
