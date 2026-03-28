import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Db } from "@/lib/db";
import { createMockDb } from "@/data/core/test-utils";
import type { Redirect } from "@/models/types";
import { getRedirectBySource, incrementRedirectHit } from "./redirects";

// ---------------------------------------------------------------------------
// Mock DB
// ---------------------------------------------------------------------------


const sampleRedirect: Redirect = {
  id: "redir-1",
  source_path: "/old-path",
  target_path: "/new-path",
  status_code: 301,
  hit_count: 5,
  created_at: Math.floor(Date.now() / 1000),
};

// ---------------------------------------------------------------------------
// getRedirectBySource
// ---------------------------------------------------------------------------

describe("getRedirectBySource", () => {
  let db: Db;
  beforeEach(() => { db = createMockDb(); });

  it("returns redirect when found", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue(sampleRedirect);

    const result = await getRedirectBySource(db, "/old-path");

    const [sql, params] = vi.mocked(db.firstOrNull).mock.calls[0];
    expect(sql).toContain("source_path = ?");
    expect(params).toEqual(["/old-path"]);
    expect(result?.target_path).toBe("/new-path");
  });

  it("returns null when not found", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue(null);

    const result = await getRedirectBySource(db, "/nonexistent");
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// incrementRedirectHit
// ---------------------------------------------------------------------------

describe("incrementRedirectHit", () => {
  let db: Db;
  beforeEach(() => { db = createMockDb(); });

  it("executes hit count update query", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 1 });

    await incrementRedirectHit(db, "redir-1");

    const [sql, params] = vi.mocked(db.execute).mock.calls[0];
    expect(sql).toContain("UPDATE redirects");
    expect(sql).toContain("hit_count = hit_count + 1");
    expect(sql).toContain("WHERE id = ?");
    expect(params).toEqual(["redir-1"]);
  });
});
