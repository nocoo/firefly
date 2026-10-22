import { describe, it, expect } from "vitest";
import {
  isValidPodcastEpisodeUrl,
  validatePodcastEpisodeUrl,
  PODCAST_URL_ERROR,
  HISFM_EPISODE_URL_RE,
} from "./podcast-url";

const VALID =
  "https://his.fm/episodes/manager-notes/same-mindset-makes-expansion-pointless";

describe("HISFM_EPISODE_URL_RE", () => {
  it("accepts canonical his.fm episode URLs", () => {
    const urls = [
      VALID,
      "https://his.fm/episodes/manager-notes/what-the-reorg-did-not-write",
      "https://his.fm/episodes/manager-notes/slug-with-trailing/",
    ];
    for (const url of urls) {
      expect(HISFM_EPISODE_URL_RE.test(url)).toBe(true);
      expect(validatePodcastEpisodeUrl(url)).toBeNull();
      expect(isValidPodcastEpisodeUrl(url)).toBe(true);
    }
  });

  it("rejects non-string input without throwing", () => {
    expect(validatePodcastEpisodeUrl(null)).toBe(PODCAST_URL_ERROR);
    expect(validatePodcastEpisodeUrl(undefined)).toBe(PODCAST_URL_ERROR);
    expect(validatePodcastEpisodeUrl(42)).toBe(PODCAST_URL_ERROR);
  });

  it("rejects userinfo, port, query, fragment, and traversal", () => {
    const invalid = [
      "https://user@his.fm/episodes/a/b",
      "https://his.fm:8443/episodes/a/b",
      "https://his.fm/episodes/a/b?x=1",
      "https://his.fm/episodes/a/b#frag",
      "https://his.fm/episodes/a/../b",
      "https://his.fm/episodes/a%2f../b",
      "http://his.fm/episodes/a/b",
      "https://www.his.fm/episodes/a/b",
      "https://his.fm/podcast/a/b",
      "https://his.fm/episodes/only-one",
      "https://evil.com/episodes/a/b",
      "not-a-url",
      "https://his.fm/episodes/UPPER/slug",
      "https://his.fm/episodes/col/slug_under",
    ];
    for (const url of invalid) {
      expect(validatePodcastEpisodeUrl(url)).toBe(PODCAST_URL_ERROR);
    }
  });

  it("rejects lone UTF-16 surrogate without URIError", () => {
    const bad = `https://his.fm/episodes/a/b${"\ud800"}`;
    expect(() => validatePodcastEpisodeUrl(bad)).not.toThrow();
    expect(validatePodcastEpisodeUrl(bad)).toBe(PODCAST_URL_ERROR);
  });
});
