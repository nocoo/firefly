import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  getDb: vi.fn(),
}));

vi.mock("@/data/entities/human", () => ({
  createHuman: vi.fn(),
  getHumanById: vi.fn(),
  getHumanBySlug: vi.fn(),
  getHumanByEmail: vi.fn(),
  updateHuman: vi.fn(),
  deleteHuman: vi.fn(),
  listHumans: vi.fn(),
}));

vi.mock("@/data/settings", () => ({
  updateDefaultHumanId: vi.fn(),
}));

import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import {
  createHuman,
  getHumanByEmail,
  getHumanBySlug,
  deleteHuman,
} from "@/data/entities/human";
import { updateDefaultHumanId } from "@/data/settings";
import { POST } from "./route";
import { PATCH, DELETE } from "./[id]/route";

const now = Math.floor(Date.now() / 1000);
const mockHuman = {
  id: "human-1",
  name: "Li Zheng",
  slug: "li-zheng",
  description: null,
  email: "li@example.com",
  profile_public: 0,
  avatar_version: null,
  created_at: now,
  updated_at: now,
};

function jsonRequest(url: string, method: string, body: unknown): NextRequest {
  return new NextRequest(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/admin/authors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({ user: { email: "a@b.com" } } as never);
    vi.mocked(getDb).mockReturnValue({} as never);
    vi.mocked(getHumanBySlug).mockResolvedValue(null);
    vi.mocked(getHumanByEmail).mockResolvedValue(null);
  });

  it("creates a human with normalized email", async () => {
    vi.mocked(createHuman).mockResolvedValue(mockHuman);
    const res = await POST(
      jsonRequest("http://localhost/api/admin/authors", "POST", {
        name: "Li Zheng",
        slug: "li-zheng",
        email: "  LI@Example.COM ",
      }),
    );
    expect(res.status).toBe(201);
    expect(createHuman).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        name: "Li Zheng",
        slug: "li-zheng",
        email: "  LI@Example.COM ",
      }),
    );
  });

  it("rejects a duplicate slug", async () => {
    vi.mocked(getHumanBySlug).mockResolvedValue(mockHuman);
    const res = await POST(
      jsonRequest("http://localhost/api/admin/authors", "POST", {
        name: "Other",
        slug: "li-zheng",
      }),
    );
    expect(res.status).toBe(400);
    expect(createHuman).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/admin/authors/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({ user: { email: "a@b.com" } } as never);
    vi.mocked(getDb).mockReturnValue({} as never);
  });

  it("sets the default human without rewriting other fields", async () => {
    const { getHumanById, updateHuman } = await import("@/data/entities/human");
    vi.mocked(getHumanById).mockResolvedValue(mockHuman);
    vi.mocked(updateHuman).mockResolvedValue(mockHuman);
    vi.mocked(updateDefaultHumanId).mockResolvedValue({} as never);

    const res = await PATCH(
      jsonRequest("http://localhost/api/admin/authors/human-1", "PATCH", {
        is_default: true,
      }),
      { params: Promise.resolve({ id: "human-1" }) },
    );
    expect(res.status).toBe(200);
    expect(updateDefaultHumanId).toHaveBeenCalledWith({}, "human-1");
  });
});

describe("DELETE /api/admin/authors/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({ user: { email: "a@b.com" } } as never);
    vi.mocked(getDb).mockReturnValue({} as never);
  });

  it("returns 409 when the human still has posts", async () => {
    vi.mocked(deleteHuman).mockResolvedValue({
      success: false,
      reason: "has_posts",
      postCount: 3,
    });
    const res = await DELETE(
      new NextRequest("http://localhost/api/admin/authors/human-1", {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: "human-1" }) },
    );
    expect(res.status).toBe(409);
  });
});
