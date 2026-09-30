"use client";

import { useEffect } from "react";
import { usePlayback } from "@/store/playback";

/** Drives the clock with requestAnimationFrame while playing. Mount once per page. */
export function usePlaybackLoop() {
  const playing = usePlayback((s) => s.playing);
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(100, now - last); // cap so a background tab does not leap
      last = now;
      usePlayback.getState().tick(dt);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing]);
}
