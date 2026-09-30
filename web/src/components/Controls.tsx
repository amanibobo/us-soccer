"use client";

import { usePlayback, type Speed } from "@/store/playback";
import { formatIndexClock, periodAt, periodLabel } from "@/lib/clock";
import { PauseIcon, PlayIcon, ScissorsIcon, SkipBackIcon, SkipForwardIcon } from "./icons";

interface Props {
  onClipStart: () => void;
  onClipEnd: () => void;
  onClipLast10: () => void;
  onPrevChance: () => void;
  onNextChance: () => void;
}

export function Controls({ onClipStart, onClipEnd, onClipLast10, onPrevChance, onNextChance }: Props) {
  const match = usePlayback((s) => s.match);
  const time = usePlayback((s) => s.time);
  const playing = usePlayback((s) => s.playing);
  const speed = usePlayback((s) => s.speed);
  const toggle = usePlayback((s) => s.toggle);
  const setSpeed = usePlayback((s) => s.setSpeed);
  const draftStart = usePlayback((s) => s.draftStart);
  if (!match) return null;
  const meta = match.meta;
  const p = periodAt(meta, time);

  return (
    <div className="flex flex-wrap items-center gap-2 px-1 py-2">
      <button className="btn btn-icon" onClick={onPrevChance} title="Previous chance (Shift + ←)" aria-label="Previous chance">
        <SkipBackIcon />
      </button>
      <button className="btn btn-primary btn-icon" onClick={toggle} title={playing ? "Pause (Space)" : "Play (Space)"} aria-label={playing ? "Pause" : "Play"}>
        {playing ? <PauseIcon /> : <PlayIcon />}
      </button>
      <button className="btn btn-icon" onClick={onNextChance} title="Next chance (Shift + →)" aria-label="Next chance">
        <SkipForwardIcon />
      </button>

      <div className="ml-1 font-mono text-sm tabular-nums">
        <span className="font-semibold">{formatIndexClock(meta, time)}</span>
        <span className="text-faint"> / {formatIndexClock(meta, meta.n_frames - 1)}</span>
        <span className="ml-2 text-xs text-muted">{periodLabel(p.period)}</span>
      </div>

      <div className="ml-1 flex overflow-hidden rounded-lg border border-border" role="group" aria-label="Speed">
        {([0.5, 1, 2] as Speed[]).map((s) => (
          <button
            key={s}
            onClick={() => setSpeed(s)}
            title={`Play at ${s}x`}
            className={`px-2.5 py-1 text-xs font-medium transition-colors ${speed === s ? "bg-zinc-900 text-white" : "bg-surface text-muted hover:bg-surface-2"}`}
          >
            {s}x
          </button>
        ))}
      </div>

      <div className="ml-auto flex items-center gap-2">
        <button className={`btn ${draftStart != null ? "btn-on" : ""}`} onClick={onClipStart} title="Set clip start at this moment (I)">
          <ScissorsIcon width={15} height={15} /> Start clip <span className="kbd">I</span>
        </button>
        <button className="btn" onClick={onClipEnd} title="Set clip end at this moment (O)">
          End clip <span className="kbd">O</span>
        </button>
        <button className="btn btn-ghost" onClick={onClipLast10} title="Make a clip of the last 10 seconds">
          Clip last 10 s
        </button>
      </div>
    </div>
  );
}
