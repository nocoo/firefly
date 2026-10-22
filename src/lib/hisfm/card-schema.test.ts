import { describe, it, expect } from "vitest";
import { parseHisFmCardPayload } from "./card-schema";
import {
  fixtureEp02Published,
  fixtureEp03Published,
  mockHisFmCardPayload,
} from "./fixtures";

describe("parseHisFmCardPayload", () => {
  it("parses live EP.02 fixture", () => {
    const card = parseHisFmCardPayload(fixtureEp02Published());
    expect(card).not.toBeNull();
    expect(card?.page_url).toContain("same-mindset");
    expect(card?.audio?.mime).toBe("audio/mpeg");
    expect(card?.cover.sizes?.length).toBeGreaterThan(0);
  });

  it("parses live EP.03 fixture", () => {
    const card = parseHisFmCardPayload(fixtureEp03Published());
    expect(card?.episode_label).toContain("EP.03");
    expect(card?.theme?.accent).toMatch(/^#/);
  });

  it("allows missing audio (link-only card)", () => {
    const card = parseHisFmCardPayload(
      mockHisFmCardPayload({ audio: undefined }),
    );
    expect(card).not.toBeNull();
    expect(card?.audio).toBeUndefined();
  });

  it("returns null for not_found or invalid payloads", () => {
    expect(
      parseHisFmCardPayload(mockHisFmCardPayload({ status: "not_found" })),
    ).toBeNull();
    expect(
      parseHisFmCardPayload(mockHisFmCardPayload({ cover: undefined })),
    ).toBeNull();
    expect(parseHisFmCardPayload({ v: 2, status: "published" })).toBeNull();
  });
});
