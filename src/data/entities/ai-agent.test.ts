import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Db } from "@/lib/db";
import { createMockDb } from "@/data/core/test-utils";
import {
  generateAgentApiKey,
  createAiAgent,
  getAiAgentById,
  getAiAgentBySlug,
  getAiAgentByApiKey,
  getAiAgentByCategoryId,
  listAiAgents,
  updateAiAgent,
  updateAvatarVersion,
  regenerateAgentApiKey,
  deleteAiAgent,
} from "./ai-agent";
import type { AiAgent, AiAgentWithCategory } from "@/models/types";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const now = Math.floor(Date.now() / 1000);

const sampleAgent: AiAgent = {
  id: "agent-1",
  name: "Claude Daily",
  slug: "claude-daily",
  description: "Daily journal by Claude",
  category_id: "cat-1",
  api_key_hash: "abc123hash",
  api_key_preview: "a1b2c3d4",
  avatar_version: null,
  is_active: 1,
  last_used_at: null,
  created_at: now,
  updated_at: now,
};

const sampleAgentWithCategory: AiAgentWithCategory = {
  ...sampleAgent,
  category_name: "AI Journal",
  category_slug: "ai-journal",
};

// ---------------------------------------------------------------------------
// generateAgentApiKey
// ---------------------------------------------------------------------------

describe("generateAgentApiKey", () => {
  it("generates key with correct prefix", async () => {
    const { plaintext, hash, preview } = await generateAgentApiKey();

    expect(plaintext).toMatch(/^firefly_agent_[0-9a-f]{48}$/);
    expect(hash).toMatch(/^[0-9a-f]{64}$/); // SHA-256
    expect(preview).toHaveLength(8);
    expect(plaintext.endsWith(preview)).toBe(true);
  });

  it("generates unique keys", async () => {
    const key1 = await generateAgentApiKey();
    const key2 = await generateAgentApiKey();

    expect(key1.plaintext).not.toBe(key2.plaintext);
    expect(key1.hash).not.toBe(key2.hash);
  });
});

// ---------------------------------------------------------------------------
// createAiAgent
// ---------------------------------------------------------------------------

describe("createAiAgent", () => {
  let db: Db;
  beforeEach(() => {
    db = createMockDb();
  });

  it("creates agent and returns plaintext key", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 3 });
    vi.mocked(db.firstOrNull).mockResolvedValue(sampleAgent);

    const result = await createAiAgent(db, {
      name: "Claude Daily",
      slug: "claude-daily",
      description: "Daily journal by Claude",
      categoryId: "cat-1",
    });

    expect(db.execute).toHaveBeenCalledOnce();
    const [sql] = vi.mocked(db.execute).mock.calls[0];
    expect(sql).toContain("INSERT INTO ai_agents");
    expect(result.agent.name).toBe("Claude Daily");
    expect(result.plaintextKey).toMatch(/^firefly_agent_[0-9a-f]{48}$/);
  });

  it("stores hash not plaintext", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 3 });
    vi.mocked(db.firstOrNull).mockResolvedValue(sampleAgent);

    const result = await createAiAgent(db, {
      name: "Test",
      slug: "test",
      categoryId: "cat-1",
    });

    const params = vi.mocked(db.execute).mock.calls[0][1]!;
    // params: [id, name, slug, description, category_id, api_key_hash, api_key_preview, now, now]
    const storedHash = params[5] as string;
    const storedPreview = params[6] as string;

    // Hash should be SHA-256 (64 hex chars)
    expect(storedHash).toMatch(/^[0-9a-f]{64}$/);
    // Plaintext key should NOT be stored
    expect(storedHash).not.toContain("firefly_agent_");
    // Preview should be last 8 chars of plaintext
    expect(result.plaintextKey.endsWith(storedPreview)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getAiAgentById
// ---------------------------------------------------------------------------

describe("getAiAgentById", () => {
  let db: Db;
  beforeEach(() => {
    db = createMockDb();
  });

  it("returns agent when found", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue(sampleAgent);
    const result = await getAiAgentById(db, "agent-1");

    const [sql, params] = vi.mocked(db.firstOrNull).mock.calls[0];
    expect(sql).toContain("id = ?");
    expect(params).toEqual(["agent-1"]);
    expect(result?.name).toBe("Claude Daily");
  });

  it("returns null when not found", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue(null);
    expect(await getAiAgentById(db, "nope")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getAiAgentBySlug
// ---------------------------------------------------------------------------

describe("getAiAgentBySlug", () => {
  let db: Db;
  beforeEach(() => {
    db = createMockDb();
  });

  it("returns agent when found", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue(sampleAgent);
    const result = await getAiAgentBySlug(db, "claude-daily");

    const [sql, params] = vi.mocked(db.firstOrNull).mock.calls[0];
    expect(sql).toContain("slug = ?");
    expect(params).toEqual(["claude-daily"]);
    expect(result?.name).toBe("Claude Daily");
  });
});

// ---------------------------------------------------------------------------
// getAiAgentByApiKey
// ---------------------------------------------------------------------------

describe("getAiAgentByApiKey", () => {
  let db: Db;
  beforeEach(() => {
    db = createMockDb();
  });

  it("returns null for invalid prefix", async () => {
    const result = await getAiAgentByApiKey(db, "invalid_token");
    expect(result).toBeNull();
    expect(db.firstOrNull).not.toHaveBeenCalled();
  });

  it("returns null for non-existent key", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue(null);
    const result = await getAiAgentByApiKey(db, "firefly_agent_abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234");
    expect(result).toBeNull();
  });

  it("returns agent and updates last_used_at on valid key", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue(sampleAgent);
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 1 });

    const result = await getAiAgentByApiKey(db, "firefly_agent_abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234");

    expect(result?.name).toBe("Claude Daily");
    expect(db.execute).toHaveBeenCalledOnce();
    const [sql] = vi.mocked(db.execute).mock.calls[0];
    expect(sql).toContain("last_used_at");
  });

  it("checks is_active = 1 in query", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue(null);
    await getAiAgentByApiKey(db, "firefly_agent_abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234");

    const [sql] = vi.mocked(db.firstOrNull).mock.calls[0];
    expect(sql).toContain("is_active = 1");
  });
});

// ---------------------------------------------------------------------------
// getAiAgentByCategoryId
// ---------------------------------------------------------------------------

describe("getAiAgentByCategoryId", () => {
  let db: Db;
  beforeEach(() => {
    db = createMockDb();
  });

  it("returns agent bound to category", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue(sampleAgent);
    const result = await getAiAgentByCategoryId(db, "cat-1");

    const [sql, params] = vi.mocked(db.firstOrNull).mock.calls[0];
    expect(sql).toContain("category_id = ?");
    expect(params).toEqual(["cat-1"]);
    expect(result?.name).toBe("Claude Daily");
  });

  it("returns null when category has no agent", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue(null);
    expect(await getAiAgentByCategoryId(db, "cat-2")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// listAiAgents
// ---------------------------------------------------------------------------

describe("listAiAgents", () => {
  let db: Db;
  beforeEach(() => {
    db = createMockDb();
  });

  it("returns agents with category info", async () => {
    vi.mocked(db.query).mockResolvedValue({
      results: [sampleAgentWithCategory],
      meta: { changes: 0, duration: 1 },
    });

    const result = await listAiAgents(db);

    const [sql] = vi.mocked(db.query).mock.calls[0];
    expect(sql).toContain("JOIN categories");
    expect(sql).toContain("category_name");
    expect(result).toHaveLength(1);
    expect(result[0].category_name).toBe("AI Journal");
  });

  it("excludes inactive by default", async () => {
    vi.mocked(db.query).mockResolvedValue({ results: [], meta: { changes: 0, duration: 1 } });

    await listAiAgents(db);

    const [sql] = vi.mocked(db.query).mock.calls[0];
    expect(sql).toContain("is_active = 1");
  });

  it("includes inactive when requested", async () => {
    vi.mocked(db.query).mockResolvedValue({ results: [], meta: { changes: 0, duration: 1 } });

    await listAiAgents(db, { includeInactive: true });

    const [sql] = vi.mocked(db.query).mock.calls[0];
    expect(sql).not.toContain("is_active = 1");
  });
});

// ---------------------------------------------------------------------------
// updateAiAgent
// ---------------------------------------------------------------------------

describe("updateAiAgent", () => {
  let db: Db;
  beforeEach(() => {
    db = createMockDb();
  });

  it("updates specified fields", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue({ ...sampleAgent, name: "Updated" });
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 2 });

    const result = await updateAiAgent(db, "agent-1", { name: "Updated" });

    const [sql, params] = vi.mocked(db.execute).mock.calls[0];
    expect(sql).toContain("UPDATE ai_agents SET");
    expect(params).toContain("Updated");
    expect(result?.name).toBe("Updated");
  });

  it("converts isActive boolean to integer", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue(sampleAgent);
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 2 });

    await updateAiAgent(db, "agent-1", { isActive: false });

    const params = vi.mocked(db.execute).mock.calls[0][1]!;
    expect(params).toContain(0);
  });

  it("returns existing when no fields provided", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue(sampleAgent);
    const result = await updateAiAgent(db, "agent-1", {});
    expect(db.execute).not.toHaveBeenCalled();
    expect(result?.name).toBe("Claude Daily");
  });

  it("sets description to null when null is passed", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue(sampleAgent);
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 2 });

    await updateAiAgent(db, "agent-1", { description: null });

    const [sql, params] = vi.mocked(db.execute).mock.calls[0];
    expect(sql).toContain("description = ?");
    expect(params).toContain(null);
  });
});

// ---------------------------------------------------------------------------
// updateAvatarVersion
// ---------------------------------------------------------------------------

describe("updateAvatarVersion", () => {
  let db: Db;
  beforeEach(() => {
    db = createMockDb();
  });

  it("updates avatar_version", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 1 });

    await updateAvatarVersion(db, "agent-1", "v1");

    const [sql, params] = vi.mocked(db.execute).mock.calls[0];
    expect(sql).toContain("avatar_version = ?");
    expect(params![0]).toBe("v1");
  });

  it("clears avatar_version when null", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 1 });

    await updateAvatarVersion(db, "agent-1", null);

    const params = vi.mocked(db.execute).mock.calls[0][1]!;
    expect(params[0]).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// regenerateAgentApiKey
// ---------------------------------------------------------------------------

describe("regenerateAgentApiKey", () => {
  let db: Db;
  beforeEach(() => {
    db = createMockDb();
  });

  it("generates new key and updates hash", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue(sampleAgent);
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 2 });

    const result = await regenerateAgentApiKey(db, "agent-1");

    expect(result).not.toBeNull();
    expect(result!.plaintextKey).toMatch(/^firefly_agent_[0-9a-f]{48}$/);
    const [sql] = vi.mocked(db.execute).mock.calls[0];
    expect(sql).toContain("api_key_hash = ?");
    expect(sql).toContain("api_key_preview = ?");
  });

  it("returns null when agent not found", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue(null);
    const result = await regenerateAgentApiKey(db, "nope");
    expect(result).toBeNull();
    expect(db.execute).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// deleteAiAgent
// ---------------------------------------------------------------------------

describe("deleteAiAgent", () => {
  let db: Db;
  beforeEach(() => {
    db = createMockDb();
  });

  it("deletes and returns true", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 2 });
    expect(await deleteAiAgent(db, "agent-1")).toBe(true);

    const [sql, params] = vi.mocked(db.execute).mock.calls[0];
    expect(sql).toContain("DELETE FROM ai_agents");
    expect(params).toEqual(["agent-1"]);
  });

  it("returns false when not found", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 0, duration: 0 });
    expect(await deleteAiAgent(db, "nope")).toBe(false);
  });
});
