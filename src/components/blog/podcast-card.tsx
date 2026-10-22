"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useTheme } from "next-themes";
import { ExternalLink, Pause, Play } from "lucide-react";
import type { HisFmPublishedCard } from "@/lib/hisfm/card-schema";
import {
  buildPodcastCardViewModel,
  formatPlaybackTime,
  nextPlaybackSpeed,
  progressPercent,
  type PlaybackSpeed,
  type PodcastCardViewModel,
} from "@/models/podcast-card-vm";

interface PodcastCardProps {
  card: HisFmPublishedCard;
}

export function PodcastCard({ card }: PodcastCardProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === "dark";
  const model = useMemo(
    () => buildPodcastCardViewModel(card, isDark),
    [card, isDark],
  );

  const style = useMemo((): CSSProperties => {
    const vars: Record<string, string> = {};
    if (model.accentColor) vars["--podcast-accent"] = model.accentColor;
    vars["--podcast-play-fg"] = model.playButtonColor;
    if (model.cardTint) {
      vars["--podcast-tint"] = model.cardTint;
    }
    return vars as CSSProperties;
  }, [model.accentColor, model.playButtonColor, model.cardTint]);

  return (
    <div
      className="podcast-card"
      data-has-accent={model.accentColor ? "true" : "false"}
      data-has-player={model.player ? "true" : "false"}
      style={mounted ? style : undefined}
    >
      <a
        href={model.episodePageUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="podcast-card-link-hit"
        aria-label={`在 his.fm 打开：${model.title}`}
      >
        <span className="sr-only">在 his.fm 打开：{model.title}</span>
      </a>
      <PodcastCardCover model={model} />
      <div className="podcast-card-head-text">
        <PodcastCardMeta model={model} />
        <h2 className="podcast-card-title">{model.title}</h2>
      </div>
      {model.description ? (
        <p className="podcast-card-summary">{model.description}</p>
      ) : null}
      {model.player ? (
        <PodcastCardPlayer model={model} player={model.player} />
      ) : (
        <PodcastCardListenCta />
      )}
    </div>
  );
}

function PodcastCardCover({ model }: { model: PodcastCardViewModel }) {
  return (
    <div className="podcast-card-cover-wrap">
      <img
        src={model.cover.src}
        srcSet={model.cover.srcSet}
        sizes={model.cover.sizes}
        alt=""
        className="podcast-card-cover"
        width={model.cover.width}
        height={model.cover.height}
        loading="lazy"
        decoding="async"
      />
      {model.frameSvgUrl ? (
        <img
          src={model.frameSvgUrl}
          alt=""
          className="podcast-card-cover-frame"
          width={120}
          height={120}
          aria-hidden="true"
        />
      ) : null}
    </div>
  );
}

function PodcastCardMeta({ model }: { model: PodcastCardViewModel }) {
  const label = model.episodeLabel ?? model.column;
  if (!label) return null;
  return (
    <p className="podcast-card-series">
      {label}
      {model.themeName ? (
        <span className="podcast-card-theme"> · {model.themeName}</span>
      ) : null}
    </p>
  );
}

function PodcastCardListenCta() {
  return (
    <p className="podcast-card-listen" aria-hidden="true">
      <span className="podcast-card-listen-label">
        <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
        在 his.fm 收听
      </span>
    </p>
  );
}

function PodcastCardPlayer({
  model,
  player,
}: {
  model: PodcastCardViewModel;
  player: NonNullable<PodcastCardViewModel["player"]>;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(player.durationSeconds);
  const [speed, setSpeed] = useState<PlaybackSpeed>(1);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) void audio.play();
    else audio.pause();
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onTime = () => setCurrent(audio.currentTime);
    const onEnded = () => setPlaying(false);
    const onMeta = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setDuration(Math.floor(audio.duration));
      }
    };
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("loadedmetadata", onMeta);
    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("loadedmetadata", onMeta);
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.playbackRate = speed;
  }, [speed]);

  const stopLinkNavigation = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const maxDuration = duration > 0 ? duration : Math.max(current, 1);
  const pct = progressPercent(current, maxDuration);
  const totalLabel =
    duration > 0 ? formatPlaybackTime(duration) : player.durationLabel;

  return (
    <div
      className="podcast-card-player"
      onClick={stopLinkNavigation}
      onKeyDown={(e) => e.stopPropagation()}
      role="group"
      aria-label="播客播放器"
    >
      {/* biome-ignore lint/a11y/useMediaCaption: captions not in card API v1 */}
      <audio ref={audioRef} preload="none" src={player.audioUrl}>
        <source src={player.audioUrl} type={player.mime} />
      </audio>
      <div className="podcast-card-player-controls">
        <button
          type="button"
          className="podcast-card-play"
          onClick={togglePlay}
          aria-label={playing ? "暂停" : "播放"}
        >
          {playing ? (
            <Pause className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
          ) : (
            <Play className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
          )}
        </button>
        <input
          type="range"
          className="podcast-card-progress"
          min={0}
          max={maxDuration}
          step={0.1}
          value={current}
          onChange={(e) => {
            const audio = audioRef.current;
            const next = Number(e.target.value);
            if (audio) audio.currentTime = next;
            setCurrent(next);
          }}
          aria-label="播放进度"
          aria-valuemin={0}
          aria-valuemax={maxDuration}
          aria-valuenow={current}
          style={{
            background: `linear-gradient(to right, var(--podcast-accent) ${pct}%, color-mix(in srgb, var(--blog-separator) 80%, transparent) ${pct}%)`,
          }}
        />
        <span className="podcast-card-time" aria-live="off">
          {formatPlaybackTime(current)} / {totalLabel}
        </span>
        <button
          type="button"
          className="podcast-card-speed"
          onClick={() => setSpeed((s) => nextPlaybackSpeed(s))}
          aria-label={`播放速度 ${speed} 倍，点击切换`}
        >
          {speed}x
        </button>
      </div>
      <span className="podcast-card-source">{model.showName ?? "his.fm"}</span>
    </div>
  );
}
