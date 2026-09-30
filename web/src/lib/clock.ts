import type { MatchMeta, PeriodMeta } from "./types";

export function periodAt(meta: MatchMeta, index: number): PeriodMeta {
  const i = Math.max(0, Math.min(meta.n_frames - 1, Math.floor(index)));
  for (const p of meta.periods) if (i >= p.start_index && i <= p.end_index) return p;
  return meta.periods[meta.periods.length - 1];
}

/** Match-clock seconds (45:00 at the start of the second half) for a playback index. */
export function clockSeconds(meta: MatchMeta, index: number): number {
  const p = periodAt(meta, index);
  return p.clock_offset_s + (index - p.start_index) / meta.fps;
}

export function formatClock(seconds: number, showTenths = false): string {
  const s = Math.max(0, seconds);
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const base = `${m}:${sec.toString().padStart(2, "0")}`;
  if (!showTenths) return base;
  const tenths = Math.floor((s * 10) % 10);
  return `${base}.${tenths}`;
}

export function formatIndexClock(meta: MatchMeta, index: number, showTenths = false): string {
  return formatClock(clockSeconds(meta, index), showTenths);
}

export function periodLabel(n: number): string {
  if (n === 1) return "1st half";
  if (n === 2) return "2nd half";
  if (n === 3) return "ET 1";
  if (n === 4) return "ET 2";
  return `Period ${n}`;
}

export function originalFrame(meta: MatchMeta, index: number): number {
  const p = periodAt(meta, index);
  return p.start_frame + (Math.floor(index) - p.start_index);
}

export function indexOfFrame(meta: MatchMeta, frame: number): number | null {
  for (const p of meta.periods) if (frame >= p.start_frame && frame <= p.end_frame) return p.start_index + (frame - p.start_frame);
  return null;
}

/** Seconds to frames at this match's rate. */
export function secondsToFrames(meta: MatchMeta, s: number): number {
  return Math.round(s * meta.fps);
}

export function clampIndex(meta: MatchMeta, index: number): number {
  return Math.max(0, Math.min(meta.n_frames - 1, index));
}
