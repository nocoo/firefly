import type { HisFmPublishedCard } from "@/lib/hisfm/card-schema";

export const PLAYBACK_SPEEDS = [1, 1.5, 2] as const;
export type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number];

export interface PodcastAudioViewModel {
  audioUrl: string;
  mime: string;
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
  if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(value)) return 0;
  return Math.min(Math.max(value, 0), duration);
}

export function nextPlaybackSpeed(current: PlaybackSpeed): PlaybackSpeed {
  return PLAYBACK_SPEEDS[(PLAYBACK_SPEEDS.indexOf(current) + 1) % PLAYBACK_SPEEDS.length];
}

export function buildPodcastPlayerViewModel(card: HisFmPublishedCard) {
  const durationSeconds = card.duration ?? 0;
  const audio: PodcastAudioViewModel | null = card.audio?.url && card.audio.mime
    ? {
        audioUrl: card.audio.url,
        mime: card.audio.mime,
        durationSeconds,
        durationLabel: durationSeconds > 0 ? formatPlaybackTime(durationSeconds) : "--:--",
      }
    : null;

  return { episodePageUrl: card.page_url, title: card.title, audio };
}
