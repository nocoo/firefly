import { describe, it, expect, vi } from "vitest";

// Mock avatar module to provide stable URLs (not env-dependent)
vi.mock("./avatar", () => ({
  getAgentAvatarUrl: vi.fn(
    (agentId: string, version: string | null, size: number) =>
      version
        ? `https://test-cdn.example.com/uploads/firefly/agents/${agentId}/${version}/avatar-${size}.png`
        : null,
  ),
}));

// Mock logo module for site author avatar
vi.mock("../logo", () => ({
  getLogoUrl: vi.fn(
    (version: string, size: number) =>
      `https://test-cdn.example.com/uploads/firefly/logo/${version}/logo-${size}.png`,
  ),
}));

import { getPostAuthor, getPostAuthorForMeta } from "./author";
import { createMockPostWithAgent } from "@/data/core/test-utils";
import type { SiteSettings } from "@/data/settings";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function createMockSettings(overrides: Partial<SiteSettings> = {}): SiteSettings {
  return {
    postsPerPage: 10,
    commentsEnabled: false,
    fontStyle: "pingfang",
    siteLogoVersion: null,
    siteName: "Test Blog",
    siteTagline: "",
    siteDescription: "",
    siteAuthor: "Site Owner",
    authorEmail: "",
    twitterHandle: "",
    socialLinks: [],
    updatedAt: 0,
    ...overrides,
  };
}

const defaultSettings = createMockSettings({
  siteAuthor: "Site Owner",
  siteLogoVersion: "v1",
});

// ---------------------------------------------------------------------------
// getPostAuthor
// ---------------------------------------------------------------------------

describe("getPostAuthor", () => {
  it("returns site author when post has no ai_agent_id", () => {
    const post = createMockPostWithAgent({ ai_agent_id: null });
    const result = getPostAuthor(post, defaultSettings);

    expect(result).toEqual({
      type: "site",
      name: "Site Owner",
      url: null,
      avatarUrl: "https://test-cdn.example.com/uploads/firefly/logo/v1/logo-80.png",
    });
  });

  it("returns site author when post has ai_agent_id but no agent_name", () => {
    // Edge case: ai_agent_id set but JOINed agent_name is null (orphaned reference)
    const post = createMockPostWithAgent({
      ai_agent_id: "agent-1",
      agent_name: null,
    });
    const result = getPostAuthor(post, defaultSettings);

    expect(result.type).toBe("site");
    expect(result.name).toBe("Site Owner");
  });

  it("returns agent author when post has ai_agent_id and agent_name", () => {
    const post = createMockPostWithAgent({
      ai_agent_id: "agent-1",
      agent_name: "Claude Daily",
      agent_slug: "claude-daily",
      agent_avatar_version: "v1",
    });
    const result = getPostAuthor(post, defaultSettings);

    expect(result).toEqual({
      type: "agent",
      name: "Claude Daily",
      url: null,
      // Avatar path uses agent ID (not slug) for stability
      avatarUrl: "https://test-cdn.example.com/uploads/firefly/agents/agent-1/v1/avatar-128.png",
    });
  });

  it("returns null avatarUrl when agent has no avatar", () => {
    const post = createMockPostWithAgent({
      ai_agent_id: "agent-1",
      agent_name: "Claude Daily",
      agent_slug: "claude-daily",
      agent_avatar_version: null,
    });
    const result = getPostAuthor(post, defaultSettings);

    expect(result).toEqual({
      type: "agent",
      name: "Claude Daily",
      url: null,
      avatarUrl: null,
    });
  });

  it("returns null avatarUrl when site has no logo", () => {
    const post = createMockPostWithAgent({ ai_agent_id: null });
    const settingsWithoutLogo = createMockSettings({
      siteAuthor: "Site Owner",
      siteLogoVersion: null,
    });
    const result = getPostAuthor(post, settingsWithoutLogo);

    expect(result).toEqual({
      type: "site",
      name: "Site Owner",
      url: null,
      avatarUrl: null,
    });
  });
});

// ---------------------------------------------------------------------------
// getPostAuthorForMeta
// ---------------------------------------------------------------------------

describe("getPostAuthorForMeta", () => {
  it("returns site author when post has no agent", () => {
    const post = createMockPostWithAgent({ ai_agent_id: null });
    const result = getPostAuthorForMeta(post, defaultSettings, "https://example.com");

    expect(result).toEqual({
      name: "Site Owner",
      url: "https://example.com",
    });
  });

  it("returns agent name with site URL when post has agent", () => {
    const post = createMockPostWithAgent({
      ai_agent_id: "agent-1",
      agent_name: "Claude Daily",
    });
    const result = getPostAuthorForMeta(post, defaultSettings, "https://example.com");

    expect(result).toEqual({
      name: "Claude Daily",
      url: "https://example.com",
    });
  });

  it("uses site URL for agent author (not agent URL)", () => {
    const post = createMockPostWithAgent({
      ai_agent_id: "agent-1",
      agent_name: "Claude Daily",
    });
    const result = getPostAuthorForMeta(post, defaultSettings, "https://myblog.com");

    // Agent author uses site URL, not agent-specific URL
    expect(result.url).toBe("https://myblog.com");
    expect(result.name).toBe("Claude Daily");
  });

  it("falls back to site author when agent_name is missing", () => {
    const post = createMockPostWithAgent({
      ai_agent_id: "agent-1",
      agent_name: null,
    });
    const result = getPostAuthorForMeta(post, defaultSettings, "https://example.com");

    expect(result).toEqual({
      name: "Site Owner",
      url: "https://example.com",
    });
  });
});
