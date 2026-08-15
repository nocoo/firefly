import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import type { Human } from "@/models/types";
import { hashNormalizedEmail } from "@/lib/human-profile";

vi.mock("@/lib/db", () => ({
  getDb: vi.fn(),
}));

vi.mock("@/data/entities/human", () => ({
  listPublicHumans: vi.fn(),
  normalizeHumanEmail: (email: string | null | undefined) => {
    if (email == null) return null;
    const trimmed = email.trim().toLowerCase();
    return trimmed.length === 0 ? null : trimmed;
  },
}));

vi.mock("@/lib/human-avatar", () => ({
  getHumanAvatarUrl: vi.fn(
    (id: string, version: string | null) =>
      version ? `https://cdn.test/humans/${id}/${version}/avatar-80.jpg` : null,
  ),
}));

import { getDb } from "@/lib/db";
import { listPublicHumans } from "@/data/entities/human";
import { GET } from "./route";

const now = 1_700_000_000;
const publicHuman: Human = {
  id: "human-1",
  name: "Li Zheng",
  slug: "li-zheng",
  description: null,
  email: "li@example.com",
  profile_public: 1,
  avatar_version: "v1",
  created_at: now,
  updated_at: now,
};

function request(query: string): NextRequest {
  return new NextRequest(`http://localhost/api/authors/profile${query}`);
}

describe("GET /api/authors/profile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getDb).mockReturnValue({} as never);
    vi.mocked(listPublicHumans).mockResolvedValue([publicHuman]);
  });

  it("returns name and avatar for an opted-in email", async () => {
    const res = await GET(request("?email=li@example.com"));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      name: "Li Zheng",
      avatar: "https://cdn.test/humans/human-1/v1/avatar-80.jpg",
    });
    expect(listPublicHumans).toHaveBeenCalled();
  });

  it("returns empty payload when the human is not public", async () => {
    vi.mocked(listPublicHumans).mockResolvedValue([]);
    const res = await GET(request("?email=li@example.com"));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ name: null, avatar: null });
  });

  it("matches by sha256 hash and ignores email when both are present", async () => {
    const hash = hashNormalizedEmail("li@example.com");
    const res = await GET(
      request(`?email=other@example.com&hash=${hash}`),
    );
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      name: "Li Zheng",
      avatar: "https://cdn.test/humans/human-1/v1/avatar-80.jpg",
    });
  });

  it("returns empty payload when hash is present but empty", async () => {
    const res = await GET(request("?email=li@example.com&hash="));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ name: null, avatar: null });
    expect(listPublicHumans).not.toHaveBeenCalled();
  });

  it("returns empty payload for a missing query", async () => {
    const res = await GET(request(""));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ name: null, avatar: null });
    expect(listPublicHumans).not.toHaveBeenCalled();
  });

  it("never queries agents", async () => {
    await GET(request("?email=li@example.com"));
    expect(listPublicHumans).toHaveBeenCalledTimes(1);
    const source = listPublicHumans.toString();
    expect(source).not.toContain("ai_agent");
  });
});
