import { describe, it, expect } from "vitest";
import { isHisFmCardMediaUrl } from "./media-url";

describe("isHisFmCardMediaUrl", () => {
  it("accepts https on f.no.mt and his.fm", () => {
    expect(
      isHisFmCardMediaUrl(
        "https://f.no.mt/productions/x/audio.mp3",
      ),
    ).toBe(true);
    expect(
      isHisFmCardMediaUrl(
        "https://his.fm/media/episode-thumbnails/x/160.webp",
      ),
    ).toBe(true);
  });

  it("rejects other schemes and hosts", () => {
    expect(isHisFmCardMediaUrl("http://f.no.mt/x")).toBe(false);
    expect(isHisFmCardMediaUrl("javascript:alert(1)")).toBe(false);
    expect(isHisFmCardMediaUrl("https://evil.com/x")).toBe(false);
    expect(isHisFmCardMediaUrl("https://f.no.mt:8443/x")).toBe(false);
    expect(isHisFmCardMediaUrl("https://f.no.mt/x?q=1")).toBe(false);
    expect(isHisFmCardMediaUrl("not-a-url")).toBe(false);
    expect(isHisFmCardMediaUrl("data:text/plain,x")).toBe(false);
  });
});
