import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({ getDb: vi.fn(() => ({})) }));
vi.mock("@/services/post-service", () => ({
  PostService: { create: vi.fn() },
}));

import { PostService } from "@/services/post-service";
import { POST } from "./route";

const VALID_EPISODE =
  "https://his.fm/episodes/manager-notes/same-mindset-makes-expansion-pointless";

function fakeRequestWithBody(body: unknown) {
  return { json: vi.fn().mockResolvedValue(body) } as never;
}

function minimalCreateBody(extra: Record<string, unknown> = {}) {
  return {
    title: "Test",
    slug: "test-slug",
    content: "body",
    ...extra,
  };
}

describe("POST /api/posts — optional string fields", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(PostService.create).mockResolvedValue({ id: "new" } as never);
  });

  const wrongTypes = [false, 0, true, 1, [], {}] as const;

  it("returns 400 for wrong-type humanId (camelCase) and does not create", async () => {
    for (const bad of wrongTypes) {
      const response = await POST(
        fakeRequestWithBody(minimalCreateBody({ humanId: bad })),
      );
      expect(response.status).toBe(400);
    }
    expect(PostService.create).not.toHaveBeenCalled();
  });

  it("returns 400 for wrong-type human_id (snake_case) and does not create", async () => {
    for (const bad of wrongTypes) {
      const response = await POST(
        fakeRequestWithBody(minimalCreateBody({ human_id: bad })),
      );
      expect(response.status).toBe(400);
    }
    expect(PostService.create).not.toHaveBeenCalled();
  });

  it("returns 400 for wrong-type podcast_url and does not create", async () => {
    for (const bad of wrongTypes) {
      const response = await POST(
        fakeRequestWithBody(minimalCreateBody({ podcast_url: bad })),
      );
      expect(response.status).toBe(400);
    }
    expect(PostService.create).not.toHaveBeenCalled();
  });

  it("returns 400 for wrong-type podcastUrl (camelCase) and does not create", async () => {
    for (const bad of wrongTypes) {
      const response = await POST(
        fakeRequestWithBody(minimalCreateBody({ podcastUrl: bad })),
      );
      expect(response.status).toBe(400);
    }
    expect(PostService.create).not.toHaveBeenCalled();
  });

  it("creates when optional fields are omitted, null, or valid strings", async () => {
    const cases = [
      {},
      { humanId: null, podcastUrl: null },
      { human_id: "human-1", podcast_url: VALID_EPISODE },
    ];
    for (const extra of cases) {
      vi.mocked(PostService.create).mockClear();
      const response = await POST(
        fakeRequestWithBody(minimalCreateBody(extra)),
      );
      expect(response.status).toBe(201);
      expect(PostService.create).toHaveBeenCalledOnce();
    }
  });
});
