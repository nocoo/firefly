import { describe, it, expect } from "vitest";
import { isHisFmCardMediaUrl, parseHisFmCardMediaUrl } from "./media-url";

describe("parseHisFmCardMediaUrl", () => {
  it("accepts https on f.no.mt and his.fm and returns href", () => {
    const raw = "https://f.no.mt/productions/x/audio.mp3";
    expect(parseHisFmCardMediaUrl(raw)).toBe(new URL(raw).href);
    expect(
      parseHisFmCardMediaUrl(
        "https://his.fm/media/episode-thumbnails/x/160.webp",
      ),
    ).toBe("https://his.fm/media/episode-thumbnails/x/160.webp");
    expect(isHisFmCardMediaUrl(raw)).toBe(true);
  });

  it("rejects srcset injection and other schemes", () => {
    const poisoned =
      "https://his.fm/safe.png 160w, https://outside.invalid/cover.png";
    expect(parseHisFmCardMediaUrl(poisoned)).toBeNull();
    expect(isHisFmCardMediaUrl(poisoned)).toBe(false);
    expect(isHisFmCardMediaUrl("http://f.no.mt/x")).toBe(false);
    expect(isHisFmCardMediaUrl("javascript:alert(1)")).toBe(false);
    expect(isHisFmCardMediaUrl("https://evil.com/x")).toBe(false);
    expect(isHisFmCardMediaUrl("https://f.no.mt:8443/x")).toBe(false);
    expect(isHisFmCardMediaUrl("https://f.no.mt/x?q=1")).toBe(false);
    expect(isHisFmCardMediaUrl("not-a-url")).toBe(false);
    expect(isHisFmCardMediaUrl("data:text/plain,x")).toBe(false);
  });
});
