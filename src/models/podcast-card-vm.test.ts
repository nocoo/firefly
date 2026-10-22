import { describe, it, expect } from "vitest";
import {
  fixtureEp02Published,
  fixtureEp03Published,
  mockHisFmCardPayload,
} from "@/lib/hisfm/fixtures";
import { parseHisFmCardPayload } from "@/lib/hisfm/card-schema";
import {
  buildPodcastCardViewModel,
  buildCoverSrcSet,
  formatPlaybackTime,
  nextPlaybackSpeed,
  progressPercent,
} from "./podcast-card-vm";

describe("podcast-card-vm", () => {
  it("formats playback time", () => {
    expect(formatPlaybackTime(0)).toBe("0:00");
    expect(formatPlaybackTime(65)).toBe("1:05");
    expect(formatPlaybackTime(558)).toBe("9:18");
  });

  it("cycles playback speed", () => {
    expect(nextPlaybackSpeed(1)).toBe(1.5);
    expect(nextPlaybackSpeed(2)).toBe(1);
  });

  it("computes progress percent", () => {
    expect(progressPercent(30, 100)).toBe(30);
    expect(progressPercent(150, 100)).toBe(100);
  });

  it("builds cover srcset from API sizes", () => {
    const card = fixtureEp03Published();
    const cover = buildCoverSrcSet(card.cover);
    expect(cover.srcSet).toContain("160w");
    expect(cover.src).toContain("his.fm");
  });

  it("builds view model from EP.03 fixture", () => {
    const card = parseHisFmCardPayload(fixtureEp03Published())!;
    const vm = buildPodcastCardViewModel(card, false);
    expect(vm.episodePageUrl).toContain("what-the-reorg");
    expect(vm.episodeLabel).toContain("EP.03");
    expect(vm.player?.mime).toBe("audio/mpeg");
    expect(vm.accentColor).toBeTruthy();
  });

  it("omits player when audio is missing", () => {
    const card = parseHisFmCardPayload(
      mockHisFmCardPayload({ audio: undefined }),
    )!;
    const vm = buildPodcastCardViewModel(card, false);
    expect(vm.player).toBeNull();
  });

  it("clears blank description", () => {
    const card = parseHisFmCardPayload(
      mockHisFmCardPayload({ description: "   " }),
    )!;
    expect(buildPodcastCardViewModel(card, false).description).toBeNull();
  });

  it("uses EP.02 fixture duration", () => {
    const card = parseHisFmCardPayload(fixtureEp02Published())!;
    const vm = buildPodcastCardViewModel(card, true);
    expect(vm.player?.durationLabel).toMatch(/\d+:\d+/);
  });

  it("falls back to cover.url when sizes are absent", () => {
    const cover = buildCoverSrcSet({
      url: "https://f.no.mt/cover.png",
      width: 1400,
      height: 1400,
    });
    expect(cover.src).toBe("https://f.no.mt/cover.png");
    expect(cover.srcSet).toBeUndefined();
  });

  it("applies theme tint on dark journal surface", () => {
    const card = parseHisFmCardPayload(fixtureEp03Published())!;
    const vm = buildPodcastCardViewModel(card, true);
    expect(vm.cardTint).toBeTruthy();
  });
});
