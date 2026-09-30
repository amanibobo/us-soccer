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
  const draftEnd = usePlayback((s) => s.draftEnd);
  if (!match) return null;
  const meta = match.meta;
  const p = periodAt(meta, time);
  const armed = draftStart != null && draftEnd == null;

  return (
    <div className="flex flex-wrap items-center gap-3 px-3 pt-3">
      {/* transport */}
      <div className="flex items-center gap-1">
        <button className="btn btn-ghost btn-icon" onClick={onPrevChance} title="Previous chance (Shift + ←)" aria-label="Previous chance">
          <SkipBackIcon width={16} height={16} />
        </button>
        <button className="btn btn-primary btn-icon h-10 w-10 rounded-xl" onClick={toggle} title={playing ? "Pause (Space)" : "Play (Space)"} aria-label={playing ? "Pause" : "Play"}>
          {playing ? <PauseIcon width={18} height={18} /> : <PlayIcon width={18} height={18} />}
        </button>
        <button className="btn btn-ghost btn-icon" onClick={onNextChance} title="Next chance (Shift + →)" aria-label="Next chance">
          <SkipForwardIcon width={16} height={16} />
        </button>
      </div>

      {/* clock */}
      <div className="flex items-baseline gap-1.5 font-mono text-sm tabular-nums">
        <span className="text-[15px] font-semibold">{formatIndexClock(meta, time)}</span>
        <span className="text-faint">/ {formatIndexClock(meta, meta.n_frames - 1)}</span>
        <span className="ml-1 font-sans text-xs text-muted">{periodLabel(p.period)}</span>
      </div>

      {/* speed */}
      <div className="seg seg-sm" role="group" aria-label="Playback speed">
        {([0.5, 1, 2] as Speed[]).map((s) => (
          <button key={s} onClick={() => setSpeed(s)} title={`Play at ${s}x`} data-on={speed === s}>
            {s}x
          </button>
        ))}
      </div>

      {/* clip actions */}
      <div className="ml-auto flex items-center gap-2">
        <button className="btn btn-ghost" onClick={onClipLast10} title="Make a clip of the last 10 seconds">
          Clip last 10 s
        </button>
        <div className="flex items-center overflow-hidden rounded-lg border border-border shadow-[0_1px_0_rgba(0,0,0,0.03)]">
          <button
            className={`inline-flex h-9 items-center gap-2 px-3 text-[13px] font-medium transition-colors ${armed ? "bg-clip text-white" : "bg-surface hover:bg-surface-2"}`}
            onClick={onClipStart}
            title="Set the clip start at this moment (I)"
          >
            <ScissorsIcon width={15} height={15} /> Start clip <span className={`kbd ${armed ? "border-white/30 bg-white/15 text-white" : ""}`}>I</span>
          </button>
          <span className="h-9 w-px bg-border" />
          <button className="inline-flex h-9 items-center gap-2 bg-surface px-3 text-[13px] font-medium transition-colors hover:bg-surface-2" onClick={onClipEnd} title="Set the clip end at this moment (O)">
            End clip <span className="kbd">O</span>
          </button>
        </div>
      </div>
    </div>
  );
}
