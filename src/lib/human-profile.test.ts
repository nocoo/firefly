import { describe, expect, it, vi } from "vitest";
import type { Human } from "@/models/types";
import {
  findPublicProfile,
  hashNormalizedEmail,
  parseProfileQuery,
} from "./human-profile";

vi.mock("./human-avatar", () => ({
  getHumanAvatarUrl: vi.fn(
    (id: string, version: string | null) =>
      version ? `https://cdn.test/humans/${id}/${version}/avatar-80.jpg` : null,
  ),
}));

const now = 1_700_000_000;

function human(overrides: Partial<Human> = {}): Human {
  return {
    id: "human-1",
    name: "Li Zheng",
    slug: "li-zheng",
    description: null,
    email: "li@example.com",
    profile_public: 1,
    avatar_version: "v1",
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

describe("parseProfileQuery", () => {
  it("prefers hash when both email and hash are present", () => {
    const hash = "a".repeat(64);
    expect(parseProfileQuery("li@example.com", hash)).toEqual({
      kind: "hash",
      value: hash,
    });
  });

  it("treats a non-64-hex hash as missing", () => {
    expect(parseProfileQuery("li@example.com", "not-a-hash")).toEqual({
      kind: "none",
      value: null,
    });
  });

  it("treats an empty hash as invalid even when email is present", () => {
    expect(parseProfileQuery("li@example.com", "")).toEqual({
      kind: "none",
      value: null,
    });
  });

  it("normalizes email when hash is absent", () => {
    expect(parseProfileQuery("  LI@Example.COM ", null)).toEqual({
      kind: "email",
      value: "li@example.com",
    });
  });
});

describe("findPublicProfile", () => {
  it("returns name and avatar for an opted-in human", () => {
    const result = findPublicProfile([human()], {
      kind: "email",
      value: "li@example.com",
    });
    expect(result).toEqual({
      name: "Li Zheng",
      avatar: "https://cdn.test/humans/human-1/v1/avatar-80.jpg",
    });
  });

  it("returns empty payload when the human is not public", () => {
    const result = findPublicProfile([human({ profile_public: 0 })], {
      kind: "email",
      value: "li@example.com",
    });
    expect(result).toEqual({ name: null, avatar: null });
  });

  it("matches by sha256 of the normalized email", () => {
    const hash = hashNormalizedEmail("li@example.com");
    const result = findPublicProfile([human()], { kind: "hash", value: hash });
    expect(result.name).toBe("Li Zheng");
  });

  it("does not match an agent-shaped record without a public email", () => {
    const result = findPublicProfile(
      [human({ email: null, name: "Claude Daily" })],
      { kind: "email", value: "agent@example.com" },
    );
    expect(result).toEqual({ name: null, avatar: null });
  });
});
