import { describe, it, expect } from "vitest";
import { readOptionalBodyString } from "./body-fields";

describe("readOptionalBodyString", () => {
  it("returns null when key is explicitly null", () => {
    expect(
      readOptionalBodyString({ podcastUrl: null }, "podcastUrl", "podcast_url"),
    ).toBeNull();
    expect(
      readOptionalBodyString(
        { podcast_url: null },
        "podcastUrl",
        "podcast_url",
      ),
    ).toBeNull();
  });

  it("returns undefined when key is absent", () => {
    expect(
      readOptionalBodyString({}, "podcastUrl", "podcast_url"),
    ).toBeUndefined();
  });

  it("returns string when present", () => {
    expect(
      readOptionalBodyString(
        { podcast_url: "https://his.fm/episodes/a/b" },
        "podcastUrl",
        "podcast_url",
      ),
    ).toBe("https://his.fm/episodes/a/b");
  });

  it("returns undefined for non-string values", () => {
    expect(
      readOptionalBodyString({ podcastUrl: 1 }, "podcastUrl", "podcast_url"),
    ).toBeUndefined();
    expect(
      readOptionalBodyString(
        { podcast_url: false },
        "podcastUrl",
        "podcast_url",
      ),
    ).toBeUndefined();
  });
});
