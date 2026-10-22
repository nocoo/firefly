import { describe, it, expect } from "vitest";
import { fixtureEp03Published } from "@/lib/hisfm/fixtures";
import {
  buildPodcastPlayerViewModel,
  clampProgress,
  formatPlaybackTime,
  nextPlaybackSpeed,
} from "./podcast-player-vm";

describe("podcast-player-vm", () => {
  it("formats durations including hours and invalid values", () => {
    for (const [value, expected] of [
      [0, "0:00"], [65, "1:05"], [558.9, "9:18"], [3665, "1:01:05"],
      [-1, "0:00"], [Number.NaN, "0:00"], [Number.POSITIVE_INFINITY, "0:00"],
    ] as const) expect(formatPlaybackTime(value)).toBe(expected);
  });

  it("cycles all playback speeds", () => {
    expect(nextPlaybackSpeed(1)).toBe(1.5);
    expect(nextPlaybackSpeed(1.5)).toBe(2);
    expect(nextPlaybackSpeed(2)).toBe(1);
  });

  it("clamps progress to finite media bounds", () => {
    expect(clampProgress(30, 100)).toBe(30);
    expect(clampProgress(150, 100)).toBe(100);
    expect(clampProgress(-1, 100)).toBe(0);
    expect(clampProgress(1, 0)).toBe(0);
    expect(clampProgress(1, Number.POSITIVE_INFINITY)).toBe(0);
    expect(clampProgress(Number.NaN, 100)).toBe(0);
  });

  it("keeps only playback and accessible episode metadata", () => {
    const card = fixtureEp03Published();
    expect(buildPodcastPlayerViewModel(card)).toEqual({
      episodePageUrl: card.page_url,
      title: card.title,
      audio: {
        audioUrl: card.audio?.url,
        mime: "audio/mpeg",
        durationSeconds: card.duration,
        durationLabel: formatPlaybackTime(card.duration!),
      },
    });
  });

  it("retains the episode link without audio", () => {
    const { audio: _audio, ...card } = fixtureEp03Published();
    expect(buildPodcastPlayerViewModel(card).audio).toBeNull();
    expect(buildPodcastPlayerViewModel({ ...card, audio: { url: "", mime: "audio/mpeg" } }).audio).toBeNull();
    expect(buildPodcastPlayerViewModel({ ...card, audio: { url: "https://his.fm/audio.mp3", mime: "" } }).audio).toBeNull();
  });

  it("uses an unknown label until media metadata supplies the duration", () => {
    const { duration: _duration, ...card } = fixtureEp03Published();
    expect(buildPodcastPlayerViewModel(card).audio?.durationLabel).toBe("--:--");
    expect(buildPodcastPlayerViewModel({ ...card, duration: 0 }).audio?.durationSeconds).toBe(0);
  });
});
