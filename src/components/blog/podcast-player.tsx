"use client";

import { useRef, useState } from "react";
import { Button } from "@nocoo/basalt/components/button";
import { Slider } from "@nocoo/basalt/components/slider";
import { Pause, Play } from "lucide-react";
import type { HisFmPublishedCard } from "@/lib/hisfm/card-schema";
import { BrandSymbol, Wordmark } from "@/components/blog/hisfm-brand";
import {
  buildPodcastPlayerViewModel,
  clampProgress,
  formatPlaybackTime,
  nextPlaybackSpeed,
  type PlaybackSpeed,
  type PodcastAudioViewModel,
} from "@/models/podcast-player-vm";

export function PodcastPlayer({ card }: { card: HisFmPublishedCard }) {
  const model = buildPodcastPlayerViewModel(card);
  return (
    <div className="podcast-player" role="group" aria-label={`播客：${model.title}`}>
      {model.audio ? <PlaybackControls key={model.audio.audioUrl} audio={model.audio} /> : null}
      <a
        className="podcast-brand"
        href={model.episodePageUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`在 his.fm 收听：${model.title}`}
      >
        <Wordmark />
        <BrandSymbol />
      </a>
    </div>
  );
}

function PlaybackControls({ audio }: { audio: PodcastAudioViewModel }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(audio.durationSeconds);
  const [speed, setSpeed] = useState<PlaybackSpeed>(1);
  const [failed, setFailed] = useState(false);
  const maxDuration = duration > 0 ? duration : Math.max(current, 1);

  async function togglePlay() {
    const element = audioRef.current;
    if (!element) return;
    setFailed(false);
    if (!element.paused) {
      element.pause();
      return;
    }
    try {
      await element.play();
    } catch {
      setFailed(true);
      setPlaying(false);
    }
  }

  return (
    <>
      {/* biome-ignore lint/a11y/useMediaCaption: captions not in card API v1 */}
      <audio
        ref={audioRef}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onError={() => { setFailed(true); setPlaying(false); }}
        onTimeUpdate={(event) => setCurrent(event.currentTarget.currentTime)}
        onLoadedMetadata={(event) => {
          const value = event.currentTarget.duration;
          if (Number.isFinite(value) && value > 0) setDuration(value);
        }}
      >
        <source src={audio.audioUrl} type={audio.mime} />
      </audio>
      <Button
        variant="ghost"
        size="icon"
        className="podcast-play"
        onClick={() => void togglePlay()}
        aria-label={playing ? "暂停" : "播放"}
      >
        {playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
      </Button>
      <Slider
        className="podcast-progress"
        min={0}
        max={maxDuration}
        step={0.1}
        value={[clampProgress(current, maxDuration)]}
        onValueChange={([value]) => {
          const next = clampProgress(value ?? 0, maxDuration);
          if (audioRef.current) audioRef.current.currentTime = next;
          setCurrent(next);
        }}
        aria-label="播放进度"
      />
      <span className="podcast-time">
        {formatPlaybackTime(current)} / {duration > 0 ? formatPlaybackTime(duration) : audio.durationLabel}
      </span>
      <Button
        variant="ghost"
        size="sm"
        className="podcast-speed"
        onClick={() => {
          const next = nextPlaybackSpeed(speed);
          if (audioRef.current) audioRef.current.playbackRate = next;
          setSpeed(next);
        }}
        aria-label={`播放速度 ${speed} 倍，点击切换`}
      >
        {speed}x
      </Button>
      <span className="sr-only" role="status">
        {failed ? "音频暂时无法播放，请重试或在 his.fm 收听。" : ""}
      </span>
    </>
  );
}
