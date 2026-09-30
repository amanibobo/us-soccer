"use client";

import { create } from "zustand";
import type { MatchData } from "@/lib/types";
import { clampIndex } from "@/lib/clock";
import { type Clip, loadClips, saveClips } from "@/lib/clip";

export type Speed = 0.5 | 1 | 2;

export interface Overlays {
  camera: boolean;
  trails: boolean;
  names: boolean;
}

export interface PlaybackState {
  match: MatchData | null;
  /** playback index, fractional while playing so rendering can interpolate */
  time: number;
  playing: boolean;
  speed: Speed;
  /** loop between these indices (viewer page + clip preview) */
  loop: { start: number; end: number } | null;
  skipGaps: boolean;
  draftStart: number | null;
  draftEnd: number | null;
  selectedSlot: number | null;
  overlays: Overlays;
  clips: Clip[];

  setMatch: (m: MatchData | null) => void;
  seek: (index: number) => void;
  seekBy: (deltaFrames: number) => void;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  setSpeed: (s: Speed) => void;
  setLoop: (loop: { start: number; end: number } | null) => void;
  setSkipGaps: (v: boolean) => void;
  setDraftStart: (i: number | null) => void;
  setDraftEnd: (i: number | null) => void;
  clearDraft: () => void;
  selectSlot: (slot: number | null) => void;
  setOverlay: (k: keyof Overlays, v: boolean) => void;
  addClip: (c: Clip) => void;
  updateClip: (c: Clip) => void;
  removeClip: (id: string) => void;
  /** advance the clock by wall-clock milliseconds; called from the animation loop */
  tick: (dtMs: number) => void;
}

export const usePlayback = create<PlaybackState>((set, get) => ({
  match: null,
  time: 0,
  playing: false,
  speed: 1,
  loop: null,
  skipGaps: true,
  draftStart: null,
  draftEnd: null,
  selectedSlot: null,
  overlays: { camera: false, trails: false, names: false },
  clips: [],

  setMatch: (match) =>
    set({
      match,
      time: 0,
      playing: false,
      draftStart: null,
      draftEnd: null,
      selectedSlot: null,
      loop: null,
      clips: match ? loadClips(match.meta.match_id) : [],
    }),
  seek: (index) => {
    const m = get().match;
    if (!m) return;
    set({ time: clampIndex(m.meta, index) });
  },
  seekBy: (delta) => {
    const m = get().match;
    if (!m) return;
    set({ time: clampIndex(m.meta, Math.round(get().time) + delta) });
  },
  play: () => {
    const { match, time, loop } = get();
    if (!match) return;
    // pressing play at the very end restarts
    const end = loop ? loop.end : match.meta.n_frames - 1;
    if (time >= end - 0.001) set({ time: loop ? loop.start : 0 });
    set({ playing: true });
  },
  pause: () => set({ playing: false, time: Math.round(get().time) }),
  toggle: () => (get().playing ? get().pause() : get().play()),
  setSpeed: (speed) => set({ speed }),
  setLoop: (loop) => set({ loop }),
  setSkipGaps: (skipGaps) => set({ skipGaps }),
  setDraftStart: (i) => set({ draftStart: i }),
  setDraftEnd: (i) => set({ draftEnd: i }),
  clearDraft: () => set({ draftStart: null, draftEnd: null }),
  selectSlot: (selectedSlot) => set({ selectedSlot }),
  setOverlay: (k, v) => set({ overlays: { ...get().overlays, [k]: v } }),
  addClip: (c) => {
    const clips = [...get().clips, c];
    saveClips(c.match_id, clips);
    set({ clips });
  },
  updateClip: (c) => {
    const clips = get().clips.map((x) => (x.id === c.id ? c : x));
    saveClips(c.match_id, clips);
    set({ clips });
  },
  removeClip: (id) => {
    const m = get().match;
    const clips = get().clips.filter((x) => x.id !== id);
    if (m) saveClips(m.meta.match_id, clips);
    set({ clips });
  },

  tick: (dtMs) => {
    const { match, playing, speed, time, loop, skipGaps } = get();
    if (!match || !playing) return;
    const meta = match.meta;
    let t = time + (dtMs / 1000) * meta.fps * speed;
    const end = loop ? loop.end : meta.n_frames - 1;
    const start = loop ? loop.start : 0;

    if (skipGaps && !loop) {
      // Jump over stretches with no tracking so the viewer never watches frozen dots.
      const i = Math.floor(t);
      if (i < meta.n_frames && !match.hasPlayers[i]) {
        const gap = meta.gaps.find(([a, b]) => i >= a && i <= b);
        if (gap) t = gap[1] + 1;
      }
    }

    if (t >= end) {
      if (loop) t = start;
      else {
        set({ time: end, playing: false });
        return;
      }
    }
    set({ time: t });
  },
}));

/** Convenience selector hooks. */
export const useMatch = () => usePlayback((s) => s.match);
export const useTime = () => usePlayback((s) => s.time);
