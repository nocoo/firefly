import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock server-only (noop in test environment)
vi.mock("server-only", () => ({}));

// Mock r2-client for avatar.ts
vi.mock("../r2-client", () => ({
  getR2PublicUrl: vi.fn(() => "https://test-cdn.example.com"),
}));

// Mock r2 for avatar.ts
vi.mock("../r2", () => ({
  getR2KeyPrefix: vi.fn(() => "uploads/firefly/"),
}));

// Mock ai-agent entity
vi.mock("@/data/entities/ai-agent", () => ({
  getAiAgentByCategoryId: vi.fn(),
}));

import { getPostAuthor, getPostAuthorForMeta } from "./author";
import { getAiAgentByCategoryId } from "@/data/entities/ai-agent";
import type { Post, AiAgent } from "@/models/types";
import type { Db } from "@/lib/db";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockDb = {} as Db;

const samplePost: Post = {
  id: "post-1",
  title: "Test Post",
  slug: "test-post",
  content: "# Test",
  content_html: "<h1>Test</h1>",
  excerpt: null,
  status: "published",
  category_id: "cat-1",
  featured_image: null,
  comment_enabled: 1,
  comment_count: 0,
  view_count: 0,
  reading_time: null,
  wp_id: null,
  wp_permalink: null,
  reference_url: null,
  reference_title: null,
  reference_description: null,
  reference_image: null,
  published_at: 1700000000,
  created_at: 1700000000,
  updated_at: 1700000000,
};

const sampleAgent: AiAgent = {
  id: "agent-1",
  name: "Claude Daily",
  slug: "claude-daily",
  description: "Daily journal by Claude",
  category_id: "cat-1",
  api_key_hash: "abc123hash",
  api_key_preview: "a1b2c3d4",
  avatar_version: "v1",
  is_active: 1,
  last_used_at: null,
  created_at: 1700000000,
  updated_at: 1700000000,
};

// ---------------------------------------------------------------------------
// getPostAuthor
// ---------------------------------------------------------------------------

describe("getPostAuthor", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns null if post has no category_id", async () => {
    const postWithoutCategory = { ...samplePost, category_id: null };
    const result = await getPostAuthor(mockDb, postWithoutCategory);
    expect(result).toBeNull();
    expect(getAiAgentByCategoryId).not.toHaveBeenCalled();
  });

  it("returns null if category has no bound agent", async () => {
    vi.mocked(getAiAgentByCategoryId).mockResolvedValue(null);
    const result = await getPostAuthor(mockDb, samplePost);
    expect(result).toBeNull();
    expect(getAiAgentByCategoryId).toHaveBeenCalledWith(mockDb, "cat-1");
  });

  it("returns agent as author when category is bound to agent", async () => {
    vi.mocked(getAiAgentByCategoryId).mockResolvedValue(sampleAgent);
    const result = await getPostAuthor(mockDb, samplePost);

    expect(result).toEqual({
      type: "agent",
      name: "Claude Daily",
      url: null,
      // Avatar path uses agent ID (not slug) for stability
      avatarUrl: "https://test-cdn.example.com/uploads/firefly/agents/agent-1/v1/avatar-128.png",
    });
  });

  it("returns null avatarUrl when agent has no avatar", async () => {
    const agentWithoutAvatar = { ...sampleAgent, avatar_version: null };
    vi.mocked(getAiAgentByCategoryId).mockResolvedValue(agentWithoutAvatar);
    const result = await getPostAuthor(mockDb, samplePost);

    expect(result).toEqual({
      type: "agent",
      name: "Claude Daily",
      url: null,
      avatarUrl: null,
    });
  });
});

// ---------------------------------------------------------------------------
// getPostAuthorForMeta
// ---------------------------------------------------------------------------

describe("getPostAuthorForMeta", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns site author when post has no agent", async () => {
    vi.mocked(getAiAgentByCategoryId).mockResolvedValue(null);
    const result = await getPostAuthorForMeta(
      mockDb,
      samplePost,
      "Site Owner",
      "https://example.com",
    );

    expect(result).toEqual({
      name: "Site Owner",
      url: "https://example.com",
    });
  });

  it("returns agent name with site URL when post has agent", async () => {
    vi.mocked(getAiAgentByCategoryId).mockResolvedValue(sampleAgent);
    const result = await getPostAuthorForMeta(
      mockDb,
      samplePost,
      "Site Owner",
      "https://example.com",
    );

    expect(result).toEqual({
      name: "Claude Daily",
      url: "https://example.com",
    });
  });

  it("uses site URL for agent author (not agent URL)", async () => {
    vi.mocked(getAiAgentByCategoryId).mockResolvedValue(sampleAgent);
    const result = await getPostAuthorForMeta(
      mockDb,
      samplePost,
      "Site Owner",
      "https://myblog.com",
    );

    // Agent author uses site URL, not agent-specific URL
    expect(result.url).toBe("https://myblog.com");
    expect(result.name).toBe("Claude Daily");
  });
});
