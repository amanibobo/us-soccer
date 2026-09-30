"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePlayback } from "@/store/playback";
import { formatIndexClock, periodLabel } from "@/lib/clock";
import type { Clip } from "@/lib/clip";
import type { MatchData } from "@/lib/types";

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

export const PHASE_LABELS: Record<string, string> = {
  build_up: "Build up",
  create: "Create",
  finish: "Finish",
  transition: "Transition",
  quick_break: "Quick break",
  set_play: "Set play",
  direct: "Direct",
  chaotic: "Loose ball",
};

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

  const layers = useMemo(() => {
    if (!match) return null;
    const m = match.meta;
    return {
      gaps: m.gaps.filter(([a, b]) => b - a > m.fps * 2),
      phases: match.phases,
      periods: m.periods,
      shots: m.shots,
    };
  }, [match]);

  if (!match || !meta || !layers) return null;

  const hasDraft = draftStart != null && draftEnd != null;

  return (
    <div className="select-none px-4 pt-7 pb-2">
      <div className="flex gap-3">
        {/* lane labels */}
        <div className="flex w-14 shrink-0 flex-col text-[10px] font-medium tracking-wide text-faint uppercase">
          <div className="flex h-6 items-center">Moments</div>
          <div className="flex h-6 items-center">Clips</div>
          <div className="flex h-5 items-center">Ball</div>
          <div className="flex h-3 items-center">Phase</div>
        </div>

        {/* lanes */}
        <div
          ref={trackRef}
          className="group relative min-w-0 flex-1 cursor-crosshair"
          onPointerDown={(e) => begin("seek", e)}
          onPointerMove={(e) => setHover(indexFromEvent(e.clientX))}
          onPointerLeave={() => setHover(null)}
        >
          {/* moments */}
          <div className="relative h-6">
            {layers.shots.map((s, k) => {
              const team = s.tid === meta.home.id ? meta.home : meta.away;
              return (
                <div key={k} className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left: pct(s.i) }} title={`${s.goal ? "Goal" : "Shot"} · ${s.name ?? ""} · ${formatIndexClock(meta, s.i)}`}>
                  {s.goal ? (
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white" style={{ boxShadow: `0 0 0 2px ${tone(team.color)}` }}>
                      <span className="h-2 w-2 rounded-full bg-ink" />
                    </span>
                  ) : (
                    <span className="block h-2.5 w-[3px] rounded-full" style={{ background: tone(team.color) }} />
                  )}
                </div>
              );
            })}
          </div>

          {/* clips */}
          <div className="relative h-6">
            <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border" />
            {clips.length === 0 && draftStart == null && (
              <div className="pointer-events-none absolute inset-0 flex items-center gap-1 pl-1 text-[11px] text-faint">
                Press <span className="kbd">I</span> to start a clip
              </div>
            )}
            {clips.map((c) => (
              <button
                key={c.id}
                className="absolute top-1/2 h-3.5 -translate-y-1/2 rounded-[4px] bg-accent/85 transition-colors hover:bg-accent"
                style={{ left: pct(c.start), width: `max(6px, ${pct(c.end - c.start)})` }}
                title={`${c.title} · ${formatIndexClock(meta, c.start)}`}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onPlayClip?.(c);
                }}
              />
            ))}
            {hasDraft && <div className="absolute top-1/2 h-4 -translate-y-1/2 rounded-[4px] border-2 border-clip bg-clip/25" style={{ left: pct(draftStart), width: `max(8px, ${pct(draftEnd - draftStart)})` }} />}
            {draftStart != null && !hasDraft && <div className="absolute top-1/2 h-4 w-0.5 -translate-y-1/2 bg-clip" style={{ left: pct(draftStart) }} />}
          </div>

          {/* possession ribbon */}
          <div className="relative h-5 py-0.5">
            <PossessionRibbon match={match} gaps={layers.gaps} />
            <div className="pointer-events-none absolute inset-y-0.5 left-0 rounded-l-[5px] bg-ink/10" style={{ width: pct(time) }} />
          </div>

          {/* phase band */}
          <div className="relative h-3 py-1">
            <div className="relative h-1 overflow-hidden rounded-full bg-surface-3">
              {layers.phases.map((p) => (
                <div key={p.i} className="absolute inset-y-0" style={{ left: pct(p.i0), width: pct(p.i1 - p.i0 + 1), background: PHASE_COLORS[p.type] ?? "#e4e4e7" }} />
              ))}
            </div>
          </div>

          {/* half-time divider */}
          {layers.periods.slice(1).map((p) => (
            <div key={p.period} className="pointer-events-none absolute inset-y-0 w-px bg-border-strong" style={{ left: pct(p.start_index) }} />
          ))}

          {/* draft handles */}
          {hasDraft && (
            <>
              <Handle left={pct(draftStart)} onPointerDown={(e) => begin("start", e)} title="Drag to move the clip start" />
              <Handle left={pct(draftEnd)} onPointerDown={(e) => begin("end", e)} title="Drag to move the clip end" />
            </>
          )}

          {/* hover cursor */}
          {hover != null && !drag && (
            <div className="pointer-events-none absolute inset-y-0 w-px bg-ink/25" style={{ left: pct(hover) }}>
              <div className="absolute -top-6 -translate-x-1/2 rounded-md bg-surface px-1.5 py-0.5 font-mono text-[11px] text-muted shadow-sm ring-1 ring-border">{formatIndexClock(meta, hover)}</div>
            </div>
          )}

          {/* playhead */}
          <div className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-ink" style={{ left: pct(time) }}>
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 rounded-md bg-ink px-1.5 py-0.5 font-mono text-[11px] font-medium text-white shadow-md">{formatIndexClock(meta, time)}</div>
            <div className="absolute -bottom-1 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rounded-full border-2 border-white bg-ink shadow" />
          </div>
        </div>
      </div>

      {/* time labels */}
      <div className="relative mt-2 ml-[68px] h-4 text-[11px] text-faint">
        {layers.periods.map((p) => (
          <span key={p.period} className="absolute" style={{ left: pct(p.start_index) }}>
            {periodLabel(p.period)}
          </span>
        ))}
        <span className="absolute right-0">Full time</span>
      </div>
    </div>
  );
}

function Handle({ left, onPointerDown, title }: { left: string; onPointerDown: (e: React.PointerEvent) => void; title: string }) {
  return (
    <div className="absolute top-[26px] h-5 w-3 -translate-x-1/2 cursor-ew-resize rounded-[4px] border border-white bg-clip shadow-sm" style={{ left }} onPointerDown={onPointerDown} title={title}>
      <span className="absolute inset-y-1 left-1/2 w-px -translate-x-1/2 bg-white/70" />
    </div>
  );
}

/** Who has the ball, across the whole match, in kit colors. Drawn once per resize. */
function PossessionRibbon({ match, gaps }: { match: MatchData; gaps: [number, number][] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const draw = () => {
      const rect = parent.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.max(1, Math.floor(rect.width));
      const h = 16;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = match.meta.n_frames;
      const home = tone(match.meta.home.color);
      const away = tone(match.meta.away.color);
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#e9e9e7";
      roundRect(ctx, 0, 0, w, h, 5);
      ctx.fill();
      ctx.save();
      roundRect(ctx, 0, 0, w, h, 5);
      ctx.clip();
      // one column per pixel: majority possession in that bucket
      const step = 2;
      for (let x = 0; x < w; x += step) {
        const a = Math.floor((x / w) * n);
        const b = Math.max(a + 1, Math.floor(((x + step) / w) * n));
        let hc = 0;
        let ac = 0;
        for (let i = a; i < b; i++) {
          const g = match.frame[i * 3 + 2];
          if (g === 1) hc++;
          else if (g === 2) ac++;
        }
        if (hc === 0 && ac === 0) continue;
        ctx.fillStyle = hc >= ac ? home : away;
        ctx.fillRect(x, 0, step, h);
      }
      // stretches with no tracking: hatched
      ctx.strokeStyle = "rgba(0,0,0,0.13)";
      ctx.lineWidth = 1;
      for (const [a, b] of gaps) {
        const x0 = (a / n) * w;
        const x1 = (b / n) * w;
        ctx.fillStyle = "#e9e9e7";
        ctx.fillRect(x0, 0, x1 - x0, h);
        ctx.save();
        ctx.beginPath();
        ctx.rect(x0, 0, x1 - x0, h);
        ctx.clip();
        for (let x = x0 - h; x < x1; x += 5) {
          ctx.beginPath();
          ctx.moveTo(x, h);
          ctx.lineTo(x + h, 0);
          ctx.stroke();
        }
        ctx.restore();
      }
      ctx.restore();
    };
    const ro = new ResizeObserver(draw);
    ro.observe(parent);
    draw();
    return () => ro.disconnect();
  }, [match, gaps]);
  return <canvas ref={ref} className="block" />;
}

/** Keep very light kits visible on a light track. */
function tone(hex: string): string {
  const h = hex.replace("#", "");
  if (h.length < 6) return hex;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const l = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  if (l < 0.8) return hex;
  const k = 0.72;
  return `rgb(${Math.round(r * k)}, ${Math.round(g * k)}, ${Math.round(b * k)})`;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
