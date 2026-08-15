import { describe, it, expect, vi } from "vitest";

vi.mock("./avatar", () => ({
  getAgentAvatarUrl: vi.fn(
    (agentId: string, version: string | null, size: number) =>
      version
        ? `https://test-cdn.example.com/uploads/firefly/agents/${agentId}/${version}/avatar-${size}.png`
        : null,
  ),
}));

vi.mock("../human-avatar", () => ({
  getHumanAvatarUrl: vi.fn(
    (humanId: string, version: string | null, size: number) =>
      version
        ? `https://test-cdn.example.com/uploads/firefly/humans/${humanId}/${version}/avatar-${size}.jpg`
        : null,
  ),
}));

import { getPostAuthor, getPostAuthorForMeta } from "./author";
import { createMockPostWithAgent } from "@/data/core/test-utils";

describe("getPostAuthor", () => {
  it("returns human author when post has no ai_agent_id", () => {
    const post = createMockPostWithAgent({
      ai_agent_id: null,
      human_id: "human-1",
      human_name: "Li Zheng",
      human_slug: "li-zheng",
      human_avatar_version: "v9",
    });
    const result = getPostAuthor(post);

    expect(result).toEqual({
      type: "human",
      id: "human-1",
      name: "Li Zheng",
      slug: "li-zheng",
      avatarUrl:
        "https://test-cdn.example.com/uploads/firefly/humans/human-1/v9/avatar-80.jpg",
    });
    expect(result.avatarUrl).not.toContain("/logo/");
  });

  it("falls back to human when ai_agent_id is set but agent_name is missing", () => {
    const post = createMockPostWithAgent({
      ai_agent_id: "agent-1",
      agent_name: null,
      human_id: "human-1",
      human_name: "Li Zheng",
      human_slug: "li-zheng",
      human_avatar_version: null,
    });
    const result = getPostAuthor(post);
    expect(result.type).toBe("human");
    expect(result.name).toBe("Li Zheng");
    expect(result.avatarUrl).toBeNull();
  });

  it("returns agent author when post has ai_agent_id and agent_name", () => {
    const post = createMockPostWithAgent({
      ai_agent_id: "agent-1",
      agent_name: "Claude Daily",
      agent_slug: "claude-daily",
      agent_avatar_version: "v1",
    });
    expect(getPostAuthor(post)).toEqual({
      type: "agent",
      id: "agent-1",
      name: "Claude Daily",
      slug: "claude-daily",
      avatarUrl:
        "https://test-cdn.example.com/uploads/firefly/agents/agent-1/v1/avatar-128.png",
    });
  });

  it("returns null avatarUrl when agent has no avatar", () => {
    const post = createMockPostWithAgent({
      ai_agent_id: "agent-1",
      agent_name: "Claude Daily",
      agent_slug: "claude-daily",
      agent_avatar_version: null,
    });
    expect(getPostAuthor(post).avatarUrl).toBeNull();
  });
});

describe("getPostAuthorForMeta", () => {
  it("returns human name when post has no agent", () => {
    const post = createMockPostWithAgent({
      ai_agent_id: null,
      human_id: "human-1",
      human_name: "Li Zheng",
      human_slug: "li-zheng",
    });
    expect(getPostAuthorForMeta(post, "https://example.com")).toEqual({
      name: "Li Zheng",
      url: "https://example.com",
    });
  });

  it("returns agent name with site URL when post has agent", () => {
    const post = createMockPostWithAgent({
      ai_agent_id: "agent-1",
      agent_name: "Claude Daily",
    });
    expect(getPostAuthorForMeta(post, "https://example.com")).toEqual({
      name: "Claude Daily",
      url: "https://example.com",
    });
  });
});
