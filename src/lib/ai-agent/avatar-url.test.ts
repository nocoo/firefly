import { describe, it, expect } from "vitest";
import { buildAgentAvatarUrl, AVATAR_SIZES } from "./avatar-url";

describe("buildAgentAvatarUrl", () => {
  const cdnBase = "https://cdn.example.com";
  const keyPrefix = "uploads/firefly/";

  it("returns null when avatarVersion is null", () => {
    const result = buildAgentAvatarUrl(cdnBase, keyPrefix, "claude", null, 64);
    expect(result).toBeNull();
  });

  it("builds correct URL for valid inputs", () => {
    const result = buildAgentAvatarUrl(
      cdnBase,
      keyPrefix,
      "claude-daily",
      "abc123",
      128,
    );
    expect(result).toBe(
      "https://cdn.example.com/uploads/firefly/agents/claude-daily/abc123/avatar-128.png",
    );
  });

  it("works for all avatar sizes", () => {
    for (const size of AVATAR_SIZES) {
      const result = buildAgentAvatarUrl(cdnBase, keyPrefix, "test", "v1", size);
      expect(result).toContain(`avatar-${size}.png`);
    }
  });

  it("handles empty string avatarVersion as truthy", () => {
    // Empty string is falsy in JS, but we treat it as "no avatar"
    const result = buildAgentAvatarUrl(cdnBase, keyPrefix, "test", "", 64);
    // buildAgentAvatarUrl checks !avatarVersion, so "" returns null
    expect(result).toBeNull();
  });
});

describe("AVATAR_SIZES", () => {
  it("contains expected sizes", () => {
    expect(AVATAR_SIZES).toEqual([32, 64, 128, 256]);
  });
});
