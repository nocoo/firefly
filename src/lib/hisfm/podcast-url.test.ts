import { describe, it, expect } from "vitest";
import {
  isValidPodcastEpisodeUrl,
  validatePodcastEpisodeUrl,
  PODCAST_URL_ERROR,
} from "./podcast-url";

describe("validatePodcastEpisodeUrl", () => {
  it("accepts canonical his.fm episode URLs", () => {
    const urls = [
      "https://his.fm/episodes/manager-notes/same-mindset-makes-expansion-pointless",
      "https://his.fm/episodes/manager-notes/what-the-reorg-did-not-write",
      "https://his.fm/episodes/manager-notes/slug-with-trailing/",
    ];
    for (const url of urls) {
      expect(validatePodcastEpisodeUrl(url)).toBeNull();
      expect(isValidPodcastEpisodeUrl(url)).toBe(true);
    }
  });

  it("rejects non-https, wrong host, or malformed paths", () => {
    const invalid = [
      "http://his.fm/episodes/a/b",
      "https://www.his.fm/episodes/a/b",
      "https://his.fm/podcast/a/b",
      "https://his.fm/episodes/only-one",
      "https://evil.com/episodes/a/b",
      "not-a-url",
    ];
    for (const url of invalid) {
      expect(validatePodcastEpisodeUrl(url)).toBe(PODCAST_URL_ERROR);
    }
  });
});
