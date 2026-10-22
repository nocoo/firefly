import { describe, it, expect } from "vitest";
import { mockHisFmCardPayload } from "@/lib/hisfm/fixtures";
import { parseHisFmCardPayload } from "@/lib/hisfm/card-schema";
import {
  buildPodcastCardViewModel,
  formatPlaybackTime,
  nextPlaybackSpeed,
  progressPercent,
} from "./podcast-card-vm";

describe("podcast-card-vm", () => {
  it("formats playback time", () => {
    expect(formatPlaybackTime(0)).toBe("0:00");
    expect(formatPlaybackTime(65)).toBe("1:05");
    expect(formatPlaybackTime(3723)).toBe("1:02:03");
  });

  it("cycles playback speed", () => {
    expect(nextPlaybackSpeed(1)).toBe(1.5);
    expect(nextPlaybackSpeed(2)).toBe(1);
  });

  it("computes progress percent", () => {
    expect(progressPercent(30, 100)).toBe(30);
    expect(progressPercent(150, 100)).toBe(100);
  });

  it("builds view model from card payload", () => {
    const card = parseHisFmCardPayload(mockHisFmCardPayload())!;
    const vm = buildPodcastCardViewModel(card);
    expect(vm.seriesLabel).toBe("主理人手札 EP.02");
    expect(vm.coverUrl).toContain("400");
    expect(vm.durationLabel).toBe("1:02:03");
    expect(vm.accentColor).toBe("#bf5c3c");
  });

  it("builds series label from column and episode", () => {
    const card = parseHisFmCardPayload(
      mockHisFmCardPayload({
        series: undefined,
        column: "主理人手札",
        episode: 3,
      }),
    )!;
    const vm = buildPodcastCardViewModel(card);
    expect(vm.seriesLabel).toBe("主理人手札 EP.03");
  });
});
