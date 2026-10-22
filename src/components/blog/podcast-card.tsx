"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { Pause, Play } from "lucide-react";
import type { PodcastCardViewModel } from "@/models/podcast-card-vm";
import {
  formatPlaybackTime,
  nextPlaybackSpeed,
  progressPercent,
  type PlaybackSpeed,
} from "@/models/podcast-card-vm";

interface PodcastCardProps {
  model: PodcastCardViewModel;
}

export function PodcastCard({ model }: PodcastCardProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [speed, setSpeed] = useState<PlaybackSpeed>(1);

  const accentStyle = model.accentColor
    ? ({ "--podcast-accent": model.accentColor } as CSSProperties)
    : undefined;

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      void audio.play();
    } else {
      audio.pause();
    }
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onTime = () => setCurrent(audio.currentTime);
    const onEnded = () => setPlaying(false);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("ended", onEnded);
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.playbackRate = speed;
  }, [speed]);

  const onSeek = (value: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = value;
    setCurrent(value);
  };

  const stopLinkNavigation = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const pct = progressPercent(current, model.durationSeconds);

  return (
    <div
      className="podcast-card"
      data-has-accent={model.accentColor ? "true" : "false"}
      style={accentStyle}
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
      <div className="podcast-card-cover-wrap">
        <img
          src={model.coverUrl}
          alt=""
          className="podcast-card-cover"
          width={112}
          height={112}
          loading="lazy"
          decoding="async"
        />
        {model.frameSvgUrl ? (
          <img
            src={model.frameSvgUrl}
            alt=""
            className="podcast-card-cover-frame"
            aria-hidden="true"
          />
        ) : null}
      </div>
      <div className="podcast-card-body">
        {model.seriesLabel ? (
          <p className="podcast-card-series">{model.seriesLabel}</p>
        ) : null}
        <h2 className="podcast-card-title">{model.title}</h2>
        {model.summary ? (
          <p className="podcast-card-summary">{model.summary}</p>
        ) : null}
        <div
          className="podcast-card-player"
          onClick={stopLinkNavigation}
          onKeyDown={(e) => e.stopPropagation()}
          role="group"
          aria-label="播客播放器"
        >
          {/* biome-ignore lint/a11y/useMediaCaption: episode captions are not provided by the card API yet */}
          <audio
            ref={audioRef}
            preload="none"
            src={model.audioUrl}
          >
            <source src={model.audioUrl} type={model.audioType} />
          </audio>
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
          <div className="podcast-card-progress-wrap">
            <input
              type="range"
              className="podcast-card-progress"
              min={0}
              max={model.durationSeconds}
              step={0.1}
              value={current}
              onChange={(e) => onSeek(Number(e.target.value))}
              aria-label="播放进度"
              aria-valuemin={0}
              aria-valuemax={model.durationSeconds}
              aria-valuenow={current}
              style={{
                background: `linear-gradient(to right, var(--podcast-accent) ${pct}%, color-mix(in srgb, var(--blog-separator) 80%, transparent) ${pct}%)`,
              }}
            />
            <span className="podcast-card-time" aria-live="off">
              {formatPlaybackTime(current)} / {model.durationLabel}
            </span>
          </div>
          <button
            type="button"
            className="podcast-card-speed"
            onClick={() => setSpeed((s) => nextPlaybackSpeed(s))}
            aria-label={`播放速度 ${speed} 倍，点击切换`}
          >
            {speed}x
          </button>
          <span className="podcast-card-source">his.fm</span>
        </div>
      </div>
    </div>
  );
}
