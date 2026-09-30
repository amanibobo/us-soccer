"use client";

import { useEffect, useRef } from "react";
import { drawPitch, fitTransform, toPx } from "@/lib/render";
import { PlayIcon } from "./icons";

export interface PreviewFrame {
  index: number;
  clock: string;
  pitch: { length: number; width: number };
  home: { color: string; number_color: string; short_name: string; score: number | null };
  away: { color: string; number_color: string; short_name: string; score: number | null };
  players: { team: "home" | "away"; number: number | null; x: number; y: number; detected: boolean }[];
  ball: { x: number; y: number } | null;
}

function luminance(hex: string): number {
  const h = hex.replace("#", "");
  if (h.length < 6) return 0.5;
  return (0.2126 * parseInt(h.slice(0, 2), 16) + 0.7152 * parseInt(h.slice(2, 4), 16) + 0.0722 * parseInt(h.slice(4, 6), 16)) / 255;
}

/** A static, real frame of the match drawn inside a mock of the editor window. */
export function HeroPreview({ frame }: { frame: PreviewFrame | null }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap || !frame) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const draw = () => {
      const rect = wrap.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.floor(rect.width);
      const h = Math.floor(rect.height);
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const t = fitTransform(w, h, frame.pitch.length, frame.pitch.width, 3);
      drawPitch(ctx, t, frame.pitch.length, frame.pitch.width);
      const r = Math.max(6, Math.min(12, t.scale * 1.15));
      ctx.font = `600 ${Math.round(r * 1.05)}px ui-sans-serif, system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (const p of frame.players) {
        const team = p.team === "home" ? frame.home : frame.away;
        const [px, py] = toPx(t, p.x, p.y);
        const dark = luminance(team.color) < 0.45;
        ctx.globalAlpha = p.detected ? 1 : 0.5;
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fillStyle = team.color;
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = dark ? "rgba(255,255,255,0.9)" : "rgba(0,0,0,0.55)";
        ctx.stroke();
        if (p.team === "away") {
          ctx.beginPath();
          ctx.arc(px, py, r * 0.62, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.fillStyle = team.number_color;
        ctx.fillText(p.number != null ? String(p.number) : "", px, py + 0.5);
        ctx.globalAlpha = 1;
      }
      if (frame.ball) {
        const [bx, by] = toPx(t, frame.ball.x, frame.ball.y);
        ctx.beginPath();
        ctx.arc(bx, by, Math.max(4, r * 0.5), 0, Math.PI * 2);
        ctx.fillStyle = "#fff";
        ctx.fill();
        ctx.strokeStyle = "#111827";
        ctx.stroke();
      }
    };
    const ro = new ResizeObserver(draw);
    ro.observe(wrap);
    draw();
    return () => ro.disconnect();
  }, [frame]);

  if (!frame) {
    return <div className="flex aspect-[16/10] w-full items-center justify-center text-sm text-muted">Run `make data` to see a live preview here</div>;
  }

  return (
    <div className="flex flex-col select-none">
      {/* window chrome */}
      <div className="flex items-center gap-3 border-b border-white/10 px-4 py-2.5 text-xs text-zinc-300">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: frame.home.color }} />
          <span className="font-medium text-zinc-100">{frame.home.short_name}</span>
          <span className="font-mono text-zinc-100">
            {frame.home.score} - {frame.away.score}
          </span>
          <span className="font-medium text-zinc-100">{frame.away.short_name}</span>
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: frame.away.color }} />
        </div>
        <div className="ml-auto hidden gap-1.5 sm:flex">
          {["Camera view", "Trails", "Names"].map((l) => (
            <span key={l} className="rounded-md border border-white/10 px-2 py-0.5">
              {l}
            </span>
          ))}
        </div>
      </div>
      <div ref={wrapRef} className="aspect-[105/68] w-full">
        <canvas ref={ref} />
      </div>
      {/* mock control bar */}
      <div className="border-t border-white/10 px-4 py-3">
        <div className="flex items-center gap-3 text-xs text-zinc-300">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-white text-zinc-900">
            <PlayIcon width={14} height={14} />
          </span>
          <span className="font-mono text-zinc-100">{frame.clock}</span>
          <span className="font-mono text-zinc-500">/ 98:48</span>
          <span className="ml-auto rounded-md border border-white/15 px-2 py-1">Start clip</span>
          <span className="rounded-md border border-white/15 px-2 py-1">End clip</span>
        </div>
        <div className="relative mt-3 h-2 rounded-full bg-white/10">
          <div className="absolute inset-y-0 left-0 rounded-full bg-blue-500" style={{ width: "33%" }} />
          <div className="absolute inset-y-0 bg-amber-400" style={{ left: "33%", width: "3%" }} />
          <div className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-blue-500" style={{ left: "33%" }} />
        </div>
      </div>
    </div>
  );
}
