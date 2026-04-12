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
  it("builds correct URL for a given agent ID, version, and size", () => {
    expect(getAgentAvatarUrl("01HQ1234567890", "v1", 64)).toBe(
      "https://test-cdn.example.com/uploads/firefly/agents/01HQ1234567890/v1/avatar-64.png",
    );
  });

  it("returns null when avatarVersion is null", () => {
    expect(getAgentAvatarUrl("01HQ1234567890", null, 64)).toBeNull();
  });

  it("builds correct URL for all standard sizes", () => {
    const sizes: AvatarSize[] = [32, 64, 128, 256];
    for (const size of sizes) {
      const url = getAgentAvatarUrl("agent-id-123", "ver123", size);
      expect(url).toContain(`/avatar-${size}.png`);
      expect(url).toContain("/agent-id-123/");
      expect(url).toContain("/ver123/");
      expect(url!.startsWith("https://test-cdn.example.com/")).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// getAgentAvatarR2Key
// ---------------------------------------------------------------------------

describe("getAgentAvatarR2Key", () => {
  it("builds R2 key without CDN prefix using agent ID", () => {
    expect(getAgentAvatarR2Key("01HQ1234567890", "v1", 64)).toBe(
      "uploads/firefly/agents/01HQ1234567890/v1/avatar-64.png",
    );
  });

  it("does not include protocol or domain", () => {
    const key = getAgentAvatarR2Key("agent-id-123", "ver123", 256);
    expect(key).not.toContain("https://");
    expect(key).toMatch(/^uploads\/firefly\/agents\//);
  });
});

// ---------------------------------------------------------------------------
// getAllAvatarR2Keys
// ---------------------------------------------------------------------------

describe("getAllAvatarR2Keys", () => {
  it("returns keys for all 4 avatar sizes using agent ID", () => {
    const keys = getAllAvatarR2Keys("01HQ1234567890", "v1");
    expect(keys).toHaveLength(4);
    expect(keys).toContain("uploads/firefly/agents/01HQ1234567890/v1/avatar-32.png");
    expect(keys).toContain("uploads/firefly/agents/01HQ1234567890/v1/avatar-64.png");
    expect(keys).toContain("uploads/firefly/agents/01HQ1234567890/v1/avatar-128.png");
    expect(keys).toContain("uploads/firefly/agents/01HQ1234567890/v1/avatar-256.png");
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
