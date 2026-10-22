/** Shared his.fm card v1 fixtures for tests and dev preview. */

export const FIXTURE_EPISODE_URL =
  "https://his.fm/episodes/manager-notes/same-mindset-makes-expansion-pointless";

export function mockHisFmCardPayload(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    v: 1,
    status: "published",
    url: FIXTURE_EPISODE_URL,
    title: "同一种心态，让扩张变得毫无意义",
    summary: "扩张不是解法，心态才是瓶颈。",
    series: "主理人手札 EP.02",
    duration: 3723,
    published_at: "2025-10-01T08:00:00Z",
    audio: {
      url: "https://f.no.mt/audio/ep02.mp3",
      type: "audio/mpeg",
      size: 45_000_000,
    },
    cover: {
      url: "https://f.no.mt/covers/ep02-1400.jpg",
      w400: "https://f.no.mt/covers/ep02-400.jpg",
      frame_svg: "https://his.fm/assets/frame.svg",
    },
    brand: { accent: "#bf5c3c" },
    ...overrides,
  };
}
