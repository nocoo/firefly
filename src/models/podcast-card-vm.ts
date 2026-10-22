import type { HisFmPublishedCard } from "@/lib/hisfm/card-schema";
import {
  parseHexColor,
  pickReadableOnAccent,
  resolveCardAccent,
  resolveCardTint,
} from "@/lib/hisfm/theme-colors";

export const PLAYBACK_SPEEDS = [1, 1.5, 2] as const;
export type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number];

export interface PodcastCoverViewModel {
  src: string;
  srcSet: string | undefined;
  sizes: string | undefined;
  width: number;
  height: number;
}

export interface PodcastPlayerViewModel {
  audioUrl: string;
  mime: string;
  durationSeconds: number;
  durationLabel: string;
}

export interface PodcastCardViewModel {
  episodePageUrl: string;
  title: string;
  description: string | null;
  episodeLabel: string | null;
  column: string | null;
  showName: string | null;
  themeName: string | null;
  cover: PodcastCoverViewModel;
  frameSvgUrl: string | null;
  accentColor: string | null;
  playButtonColor: string;
  cardTint: string | null;
  player: PodcastPlayerViewModel | null;
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

export function buildCoverSrcSet(
  cover: HisFmPublishedCard["cover"],
): PodcastCoverViewModel {
  const display = 112;
  const sizesList = cover.sizes;
  if (sizesList && sizesList.length > 0) {
    const sorted = [...sizesList].sort((a, b) => a.width - b.width);
    const srcSet = sorted.map((s) => `${s.url} ${s.width}w`).join(", ");
    const src =
      sorted.find((s) => s.width >= 320)?.url ??
      sorted[sorted.length - 1]?.url ??
      cover.url;
    return {
      src,
      srcSet,
      sizes: "(max-width: 640px) 88px, 112px",
      width: display,
      height: display,
    };
  }
  return {
    src: cover.url,
    srcSet: undefined,
    sizes: undefined,
    width: display,
    height: display,
  };
}

export function buildPodcastCardViewModel(
  card: HisFmPublishedCard,
  isDark: boolean,
): PodcastCardViewModel {
  const theme = card.theme ?? {};
  const accent =
    resolveCardAccent(theme, isDark) ??
    parseHexColor(theme.accent) ??
    null;
  const playButtonColor = accent
    ? pickReadableOnAccent(accent)
    : "#FFFFFF";

  const durationSeconds = card.duration ?? 0;
  const player =
    card.audio?.url && card.audio.mime
      ? {
          audioUrl: card.audio.url,
          mime: card.audio.mime,
          durationSeconds,
          durationLabel:
            durationSeconds > 0
              ? formatPlaybackTime(durationSeconds)
              : "--:--",
        }
      : null;

  return {
    episodePageUrl: card.page_url,
    title: card.title,
    description: card.description?.trim() ? card.description.trim() : null,
    episodeLabel: card.episode_label?.trim() ?? null,
    column: card.column?.trim() ?? null,
    showName: card.show?.trim() ?? null,
    themeName: theme.name?.trim() ?? null,
    cover: buildCoverSrcSet(card.cover),
    frameSvgUrl: card.cover.frame_svg ?? null,
    accentColor: accent,
    playButtonColor,
    cardTint: resolveCardTint(theme.paper, isDark),
    player,
  };
}
