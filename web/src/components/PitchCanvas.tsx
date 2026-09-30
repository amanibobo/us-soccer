"use client";

import { useEffect, useRef, useState } from "react";
import { usePlayback } from "@/store/playback";
import { drawScene, fitTransform, slotAt, toMetres } from "@/lib/render";

interface Props {
  /** allow clicking a player to focus him */
  interactive?: boolean;
  className?: string;
}

export function PitchCanvas({ interactive = true, className = "" }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [noTracking, setNoTracking] = useState(false);
  const noTrackingRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let dpr = 1;
    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = Math.max(1, Math.floor(rect.width));
      h = Math.max(1, Math.floor(rect.height));
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      draw();
    };

    const draw = () => {
      const s = usePlayback.getState();
      const m = s.match;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!m) {
        ctx.clearRect(0, 0, w, h);
        return;
      }
      const t = fitTransform(w, h, m.meta.pitch.length, m.meta.pitch.width);
      const r = drawScene(ctx, t, m, s.time, {
        cameraOverlay: s.overlays.camera,
        trails: s.overlays.trails,
        names: s.overlays.names,
        selectedSlot: s.selectedSlot,
      });
      if (r.noTracking !== noTrackingRef.current) {
        noTrackingRef.current = r.noTracking;
        setNoTracking(r.noTracking);
      }
    };

    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();
    // Redraw whenever anything in the store changes (time, overlays, selection).
    const unsub = usePlayback.subscribe(draw);
    return () => {
      ro.disconnect();
      unsub();
    };
  }, []);

  const onClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!interactive) return;
    const s = usePlayback.getState();
    const m = s.match;
    const canvas = canvasRef.current;
    if (!m || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const t = fitTransform(rect.width, rect.height, m.meta.pitch.length, m.meta.pitch.width);
    const [xm, ym] = toMetres(t, e.clientX - rect.left, e.clientY - rect.top);
    const slot = slotAt(m, s.time, xm, ym, 2.2);
    s.selectSlot(slot === s.selectedSlot ? null : slot);
  };

  return (
    <div ref={wrapRef} className={`relative h-full w-full overflow-hidden ${className}`}>
      <canvas ref={canvasRef} onClick={onClick} className={interactive ? "cursor-pointer" : ""} />
      {noTracking && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="rounded-lg bg-black/55 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm">
            No tracking here: the broadcast cut away from the pitch
          </div>
        </div>
      )}
    </div>
  );
}
