import { describe, expect, it } from "vitest";
import { hashNormalizedEmail } from "./human-profile";
import {
  buildAuthorProfileBrief,
  profileLookupPath,
  profileLookupUrl,
} from "./author-profile-brief";

const hash = hashNormalizedEmail("li@example.com");

describe("profileLookupUrl", () => {
  it("strips a trailing slash on the site origin", () => {
    expect(profileLookupUrl("https://lizheng.me/", hash)).toBe(
      `https://lizheng.me${profileLookupPath(hash)}`,
    );
  });
});

describe("buildAuthorProfileBrief", () => {
  it("includes the hash URL and forbids email fallback", () => {
    const brief = buildAuthorProfileBrief({
      name: "Li Zheng",
      email: "li@example.com",
      hash,
      profilePublic: true,
      siteUrl: "https://lizheng.me",
    });
    expect(brief).toContain(`GET https://lizheng.me/api/authors/profile?hash=${hash}`);
    expect(brief).toContain(hash);
    expect(brief).toContain("Do not fall back to email");
    expect(brief).toContain("profile_public`: 1");
    expect(brief).not.toContain("Live trial");
  });

  it("explains a missing email and a private profile", () => {
    const brief = buildAuthorProfileBrief({
      name: "Draft",
      email: null,
      hash: null,
      profilePublic: false,
      siteUrl: "https://lizheng.me/",
    });
    expect(brief).toContain("hash cannot be computed");
    expect(brief).toContain("profile_public`: 0");
    expect(brief).toContain("https://lizheng.me/api/authors/profile?hash=<sha256 hex>");
  });

  it("appends a live trial payload when provided", () => {
    const brief = buildAuthorProfileBrief({
      name: "Li Zheng",
      email: "li@example.com",
      hash,
      profilePublic: true,
      siteUrl: "https://lizheng.me",
      trial: { status: 200, body: { name: "Li Zheng", avatar: null } },
    });
    expect(brief).toContain("## Live trial");
    expect(brief).toContain("HTTP 200");
    expect(brief).toContain('"name": "Li Zheng"');
  });
});
