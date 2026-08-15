import { describe, it, expect, vi } from "vitest";

vi.mock("./r2-client", () => ({
  getR2PublicUrl: vi.fn(() => "https://test-cdn.example.com"),
}));

vi.mock("./r2", () => ({
  getR2KeyPrefix: vi.fn(() => "uploads/firefly/"),
}));

import {
  getHumanAvatarUrl,
  getHumanAvatarR2Key,
  getAllHumanAvatarR2Keys,
  HUMAN_AVATAR_SIZES,
} from "./human-avatar";

describe("getHumanAvatarUrl", () => {
  it("builds humans/ path for a versioned avatar", () => {
    expect(getHumanAvatarUrl("human-1", "v1", 80)).toBe(
      "https://test-cdn.example.com/uploads/firefly/humans/human-1/v1/avatar-80.jpg",
    );
  });

  it("returns null without a version", () => {
    expect(getHumanAvatarUrl("human-1", null, 80)).toBeNull();
  });
});

describe("getHumanAvatarR2Key", () => {
  it("omits the CDN origin", () => {
    expect(getHumanAvatarR2Key("human-1", "v1", 32)).toBe(
      "uploads/firefly/humans/human-1/v1/avatar-32.jpg",
    );
  });
});

describe("getAllHumanAvatarR2Keys", () => {
  it("covers every human avatar size", () => {
    const keys = getAllHumanAvatarR2Keys("human-1", "v1");
    expect(keys).toHaveLength(HUMAN_AVATAR_SIZES.length);
    expect(keys).toContain(
      "uploads/firefly/humans/human-1/v1/avatar-80.jpg",
    );
  });
});
