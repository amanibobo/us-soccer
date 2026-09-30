"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePlayback } from "@/store/playback";
import { formatIndexClock, periodLabel } from "@/lib/clock";
import type { Clip } from "@/lib/clip";

const PHASE_COLORS: Record<string, string> = {
  build_up: "#93c5fd",
  create: "#fcd34d",
  finish: "#f87171",
  transition: "#c4b5fd",
  quick_break: "#c4b5fd",
  set_play: "#a1a1aa",
  direct: "#a7f3d0",
  chaotic: "#e4e4e7",
};

export const PHASE_LEGEND: [string, string][] = [
  ["Build up", PHASE_COLORS.build_up],
  ["Create", PHASE_COLORS.create],
  ["Finish", PHASE_COLORS.finish],
  ["Transition", PHASE_COLORS.transition],
  ["Set play", PHASE_COLORS.set_play],
];

type DragMode = "seek" | "start" | "end" | null;

interface Props {
  onPlayClip?: (c: Clip) => void;
}

export function Scrubber({ onPlayClip }: Props) {
  const match = usePlayback((s) => s.match);
  const time = usePlayback((s) => s.time);
  const draftStart = usePlayback((s) => s.draftStart);
  const draftEnd = usePlayback((s) => s.draftEnd);
  const clips = usePlayback((s) => s.clips);
  const trackRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragMode>(null);
  const wasPlaying = useRef(false);
  const [hover, setHover] = useState<number | null>(null);

  const meta = match?.meta;
  const n = meta?.n_frames ?? 1;
  const pct = useCallback((i: number) => `${(100 * i) / Math.max(1, n - 1)}%`, [n]);

  const indexFromEvent = useCallback(
    (clientX: number) => {
      const el = trackRef.current;
      if (!el) return 0;
      const r = el.getBoundingClientRect();
      const f = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
      return Math.round(f * (n - 1));
    },
    [n],
  );

  useEffect(() => {
    if (!drag) return;
    const move = (e: PointerEvent) => {
      const i = indexFromEvent(e.clientX);
      const s = usePlayback.getState();
      if (drag === "seek") s.seek(i);
      else if (drag === "start") s.setDraftStart(Math.min(i, (s.draftEnd ?? n) - 1));
      else if (drag === "end") s.setDraftEnd(Math.max(i, (s.draftStart ?? 0) + 1));
      if (drag !== "seek") s.seek(i);
    };
    const up = () => {
      setDrag(null);
      if (wasPlaying.current) usePlayback.getState().play();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [drag, indexFromEvent, n]);

  const begin = (mode: DragMode, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const s = usePlayback.getState();
    wasPlaying.current = s.playing;
    s.pause();
    if (mode === "seek") s.seek(indexFromEvent(e.clientX));
    setDrag(mode);
  };

  // Static layers are memoised: they depend on the match, not the clock.
  const layers = useMemo(() => {
    if (!match) return null;
    const m = match.meta;
    const gaps = m.gaps.filter(([a, b]) => b - a > m.fps * 2); // hide blips under 2 s
    const phases = match.phases;
    const halfBreaks = m.periods.slice(1).map((p) => p.start_index);
    return { gaps, phases, halfBreaks, shots: m.shots };
  }, [match]);

  if (!match || !meta || !layers) return null;

  const hasDraft = draftStart != null && draftEnd != null;

  return (
    <div className="select-none px-1 pt-3 pb-1">
      <div
        ref={trackRef}
        className="group relative h-10 cursor-pointer"
        onPointerDown={(e) => begin("seek", e)}
        onPointerMove={(e) => setHover(indexFromEvent(e.clientX))}
        onPointerLeave={() => setHover(null)}
      >
        {/* event markers above the bar */}
        <div className="absolute inset-x-0 top-0 h-3">
          {layers.shots.map((s, k) => (
            <div
              key={k}
              title={`${s.goal ? "Goal" : "Shot"}: ${s.name ?? ""} ${formatIndexClock(meta, s.i)}`}
              className={`absolute top-0 -translate-x-1/2 ${s.goal ? "h-3 w-3 rounded-full bg-danger ring-2 ring-white" : "h-2 w-[3px] rounded-sm bg-zinc-500/70"}`}
              style={{ left: pct(s.i) }}
            />
          ))}
        </div>

        {/* main track */}
        <div className="absolute inset-x-0 top-4 h-2.5 overflow-hidden rounded-full bg-zinc-200">
          {layers.gaps.map(([a, b], k) => (
            <div key={k} className="hatch absolute inset-y-0" style={{ left: pct(a), width: pct(b - a + 1) }} />
          ))}
          <div className="absolute inset-y-0 left-0 bg-accent/80" style={{ width: pct(time) }} />
          {hasDraft && (
            <div className="absolute inset-y-0 bg-amber-400/80" style={{ left: pct(draftStart), width: pct(draftEnd - draftStart) }} />
          )}
          {clips.map((c) => (
            <div
              key={c.id}
              className="absolute inset-y-0 bg-zinc-700/70 hover:bg-zinc-900"
              style={{ left: pct(c.start), width: `max(3px, ${pct(c.end - c.start)})` }}
              title={c.title}
              onPointerDown={(e) => {
                e.stopPropagation();
                onPlayClip?.(c);
              }}
            />
          ))}
          {layers.halfBreaks.map((i) => (
            <div key={i} className="absolute inset-y-0 w-[2px] bg-white" style={{ left: pct(i) }} />
          ))}
        </div>

        {/* phase band */}
        <div className="absolute inset-x-0 top-7 h-1.5 overflow-hidden rounded-full bg-zinc-100">
          {layers.phases.map((p) => (
            <div
              key={p.i}
              className="absolute inset-y-0"
              style={{ left: pct(p.i0), width: pct(p.i1 - p.i0 + 1), background: PHASE_COLORS[p.type] ?? "#e4e4e7" }}
            />
          ))}
        </div>

        {/* draft handles */}
        {hasDraft && (
          <>
            <div
              className="absolute top-3 h-5 w-3 -translate-x-1/2 cursor-ew-resize rounded-sm border border-white bg-amber-500 shadow"
              style={{ left: pct(draftStart) }}
              onPointerDown={(e) => begin("start", e)}
              title="Drag to move the clip start"
            />
            <div
              className="absolute top-3 h-5 w-3 -translate-x-1/2 cursor-ew-resize rounded-sm border border-white bg-amber-500 shadow"
              style={{ left: pct(draftEnd) }}
              onPointerDown={(e) => begin("end", e)}
              title="Drag to move the clip end"
            />
          </>
        )}

        {/* playhead */}
        <div
          className="pointer-events-none absolute top-[9px] h-5 w-5 -translate-x-1/2 rounded-full border-2 border-white bg-accent shadow transition-transform group-hover:scale-110"
          style={{ left: pct(time) }}
        />

        {/* hover tooltip */}
        {hover != null && !drag && (
          <div
            className="pointer-events-none absolute -top-7 -translate-x-1/2 rounded bg-zinc-900 px-1.5 py-0.5 font-mono text-[11px] text-white"
            style={{ left: pct(hover) }}
          >
            {formatIndexClock(meta, hover)}
          </div>
        )}
      </div>

      <div className="mt-1 flex items-center justify-between text-[11px] text-muted">
        <span>{periodLabel(meta.periods[0].period)}</span>
        {meta.periods.length > 1 && <span>{periodLabel(meta.periods[1].period)}</span>}
        <span>Full time</span>
      </div>
    </div>
  );
}
