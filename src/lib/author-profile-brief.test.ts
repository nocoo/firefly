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
  it("explains hash, URL, and expected JSON", () => {
    const brief = buildAuthorProfileBrief({
      name: "Li Zheng",
      email: "li@example.com",
      hash,
      profilePublic: true,
      siteUrl: "https://lizheng.me",
    });
    expect(brief).toContain("email.trim().toLowerCase()");
    expect(brief).toContain(`GET https://lizheng.me/api/authors/profile?hash=${hash}`);
    expect(brief).toContain(hash);
    expect(brief).toContain('{ "name": "Li Zheng", "avatar":');
    expect(brief).toContain('{ "name": null, "avatar": null }');
    expect(brief).not.toMatch(/agent/i);
  });

  it("explains a missing email and a private profile", () => {
    const brief = buildAuthorProfileBrief({
      name: "Draft",
      email: null,
      hash: null,
      profilePublic: false,
      siteUrl: "https://lizheng.me/",
    });
    expect(brief).toContain("未填写，无法计算 hash");
    expect(brief).toContain("未公开时返回空结果");
    expect(brief).toContain(
      "https://lizheng.me/api/authors/profile?hash=<64-char-hex>",
    );
    expect(brief).not.toMatch(/agent/i);
  });
});
