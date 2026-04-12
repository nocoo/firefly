import { describe, it, expect, vi } from "vitest";

// Mock server-only (noop in test environment)
vi.mock("server-only", () => ({}));

// Mock r2-client before importing avatar
vi.mock("../r2-client", () => ({
  getR2PublicUrl: vi.fn(() => "https://test-cdn.example.com"),
}));

// Mock r2 to provide a stable key prefix for tests
vi.mock("../r2", () => ({
  getR2KeyPrefix: vi.fn(() => "uploads/firefly/"),
}));

import {
  getAgentAvatarUrl,
  getAgentAvatarR2Key,
  getAllAvatarR2Keys,
  AVATAR_SIZES,
  type AvatarSize,
} from "./avatar";

// ---------------------------------------------------------------------------
// getAgentAvatarUrl
// ---------------------------------------------------------------------------

describe("getAgentAvatarUrl", () => {
  it("builds correct URL for a given agent, version, and size", () => {
    expect(getAgentAvatarUrl("claude-daily", "v1", 64)).toBe(
      "https://test-cdn.example.com/uploads/firefly/agents/claude-daily/v1/avatar-64.png",
    );
  });

  it("returns null when avatarVersion is null", () => {
    expect(getAgentAvatarUrl("claude-daily", null, 64)).toBeNull();
  });

  it("builds correct URL for all standard sizes", () => {
    const sizes: AvatarSize[] = [32, 64, 128, 256];
    for (const size of sizes) {
      const url = getAgentAvatarUrl("test-agent", "ver123", size);
      expect(url).toContain(`/avatar-${size}.png`);
      expect(url).toContain("/test-agent/");
      expect(url).toContain("/ver123/");
      expect(url!.startsWith("https://test-cdn.example.com/")).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// getAgentAvatarR2Key
// ---------------------------------------------------------------------------

describe("getAgentAvatarR2Key", () => {
  it("builds R2 key without CDN prefix", () => {
    expect(getAgentAvatarR2Key("claude-daily", "v1", 64)).toBe(
      "uploads/firefly/agents/claude-daily/v1/avatar-64.png",
    );
  });

  it("does not include protocol or domain", () => {
    const key = getAgentAvatarR2Key("test-agent", "ver123", 256);
    expect(key).not.toContain("https://");
    expect(key).toMatch(/^uploads\/firefly\/agents\//);
  });
});

// ---------------------------------------------------------------------------
// getAllAvatarR2Keys
// ---------------------------------------------------------------------------

describe("getAllAvatarR2Keys", () => {
  it("returns keys for all 4 avatar sizes", () => {
    const keys = getAllAvatarR2Keys("claude-daily", "v1");
    expect(keys).toHaveLength(4);
    expect(keys).toContain("uploads/firefly/agents/claude-daily/v1/avatar-32.png");
    expect(keys).toContain("uploads/firefly/agents/claude-daily/v1/avatar-64.png");
    expect(keys).toContain("uploads/firefly/agents/claude-daily/v1/avatar-128.png");
    expect(keys).toContain("uploads/firefly/agents/claude-daily/v1/avatar-256.png");
  });
});

// ---------------------------------------------------------------------------
// AVATAR_SIZES
// ---------------------------------------------------------------------------

describe("AVATAR_SIZES", () => {
  it("contains all 4 standard sizes", () => {
    expect(AVATAR_SIZES).toEqual([32, 64, 128, 256]);
  });
});
