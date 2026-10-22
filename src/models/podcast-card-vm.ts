import type { HisFmPublishedCard } from "@/lib/hisfm/card-schema";

export const PLAYBACK_SPEEDS = [1, 1.5, 2] as const;
export type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number];

export interface PodcastCardViewModel {
  episodePageUrl: string;
  title: string;
  summary: string | null;
  seriesLabel: string | null;
  coverUrl: string;
  frameSvgUrl: string | null;
  accentColor: string | null;
  audioUrl: string;
  audioType: string;
  durationSeconds: number;
  durationLabel: string;
}

export function formatPlaybackTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function clampProgress(value: number, duration: number): number {
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  return Math.min(Math.max(value, 0), duration);
}

export function progressPercent(current: number, duration: number): number {
  if (duration <= 0) return 0;
  return (clampProgress(current, duration) / duration) * 100;
}

export function nextPlaybackSpeed(current: PlaybackSpeed): PlaybackSpeed {
  const idx = PLAYBACK_SPEEDS.indexOf(current);
  const next = (idx + 1) % PLAYBACK_SPEEDS.length;
  return PLAYBACK_SPEEDS[next];
}

function resolveSeriesLabel(card: HisFmPublishedCard): string | null {
  if (card.series?.trim()) return card.series.trim();
  if (card.episode_label?.trim()) return card.episode_label.trim();
  const show = (card.show ?? card.column)?.trim();
  if (!show) return null;
  if (card.episode !== undefined && card.episode !== "") {
    const ep =
      typeof card.episode === "number"
        ? String(card.episode).padStart(2, "0")
        : String(card.episode);
    return `${show} EP.${ep}`;
  }
  return show;
}

function resolveCoverUrl(card: HisFmPublishedCard): string {
  const cover = card.cover;
  return (
    cover.w400 ??
    cover.w200 ??
    cover.url ??
    cover.w1400 ??
    ""
  );
}

function resolveAccent(card: HisFmPublishedCard): string | null {
  const brand = card.brand;
  if (!brand) return null;
  return brand.accent ?? brand.accent_color ?? brand.colors?.[0] ?? null;
}

export function buildPodcastCardViewModel(
  card: HisFmPublishedCard,
): PodcastCardViewModel {
  const durationSeconds = card.duration;
  return {
    episodePageUrl: card.url,
    title: card.title,
    summary: card.summary?.trim() ? card.summary.trim() : null,
    seriesLabel: resolveSeriesLabel(card),
    coverUrl: resolveCoverUrl(card),
    frameSvgUrl: card.cover.frame_svg ?? card.cover.frame ?? null,
    accentColor: resolveAccent(card),
    audioUrl: card.audio.url,
    audioType: card.audio.type,
    durationSeconds,
    durationLabel: formatPlaybackTime(durationSeconds),
  };
}
