"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePlayback } from "@/store/playback";
import { loadMatch } from "@/lib/bundle";
import { formatIndexClock } from "@/lib/clock";
import { clipLength, type Clip } from "@/lib/clip";
import { usePlaybackLoop } from "@/hooks/usePlaybackLoop";
import { PitchCanvas } from "./PitchCanvas";
import { TeamBadge } from "./TeamBadge";
import { ExternalIcon, LinkIcon, PauseIcon, PlayIcon } from "./icons";
import { site } from "@/config/site";

export function ClipViewer({ clip }: { clip: Clip }) {
  const match = usePlayback((s) => s.match);
  const setMatch = usePlayback((s) => s.setMatch);
  const playing = usePlayback((s) => s.playing);
  const time = usePlayback((s) => s.time);
  const toggle = usePlayback((s) => s.toggle);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  usePlaybackLoop();

  useEffect(() => {
    let cancelled = false;
    setMatch(null);
    loadMatch(String(clip.match_id))
      .then((m) => {
        if (cancelled) return;
        setMatch(m);
        const s = usePlayback.getState();
        s.setLoop({ start: clip.start, end: clip.end });
        if (clip.overlays) {
          if (clip.overlays.camera != null) s.setOverlay("camera", clip.overlays.camera);
          if (clip.overlays.trails != null) s.setOverlay("trails", clip.overlays.trails);
          if (clip.overlays.focusPlayer != null) s.selectSlot(clip.overlays.focusPlayer);
        }
        s.seek(clip.start);
        s.play();
      })
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [clip, setMatch]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "k") {
        e.preventDefault();
        usePlayback.getState().toggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const meta = match?.meta;
  const seconds = meta ? clipLength(meta, clip.start, clip.end) : 0;
  const elapsed = meta ? Math.max(0, Math.min(1, (time - clip.start) / Math.max(1, clip.end - clip.start))) : 0;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col px-4 py-5">
      <div className="mb-5 flex items-center justify-between">
        <Link href="/" className="text-[13px] font-semibold tracking-tight">
          {site.name}
        </Link>
        {meta && (
          <div className="flex items-center gap-2 text-xs text-muted">
            <TeamBadge teamId={meta.home.id} name={meta.home.name} acronym={meta.home.acronym} color={meta.home.color} size={18} />
            <span>{meta.home.short_name}</span>
            <span className="rounded bg-surface-3 px-1.5 font-mono font-semibold text-text tabular-nums">
              {meta.home.score} – {meta.away.score}
            </span>
            <span>{meta.away.short_name}</span>
            <TeamBadge teamId={meta.away.id} name={meta.away.name} acronym={meta.away.acronym} color={meta.away.color} size={18} />
          </div>
        )}
      </div>

      <h1 className="text-xl font-semibold tracking-tight">{clip.title}</h1>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted">
        {meta && (
          <span className="font-mono">
            {formatIndexClock(meta, clip.start)} – {formatIndexClock(meta, clip.end)} · {seconds.toFixed(1)} s
          </span>
        )}
        {clip.author && <span>· by {clip.author}</span>}
        {clip.tags.map((t) => (
          <span key={t} className="chip">
            {t}
          </span>
        ))}
      </div>
      {clip.notes && <p className="mt-2 text-sm">{clip.notes}</p>}

      <div className="card mt-4 aspect-[105/72] w-full overflow-hidden">
        {error ? (
          <div className="flex h-full items-center justify-center p-6 text-sm text-danger">{error}</div>
        ) : !match ? (
          <div className="flex h-full items-center justify-center text-sm text-muted">Loading clip…</div>
        ) : (
          <div className="relative h-full cursor-pointer" onClick={toggle}>
            <PitchCanvas interactive={false} />
            {!playing && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="rounded-full bg-black/55 p-4 text-white shadow-lg">
                  <PlayIcon width={28} height={28} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-3">
        <div className="h-full bg-ink" style={{ width: `${elapsed * 100}%` }} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button className="btn btn-primary btn-lg" onClick={toggle} disabled={!match} title="Play or pause (Space)">
          {playing ? <PauseIcon width={16} height={16} /> : <PlayIcon width={16} height={16} />} {playing ? "Pause" : "Play"}
        </button>
        <button className="btn btn-lg" onClick={copy} title="Copy this clip's link">
          <LinkIcon width={16} height={16} /> {copied ? "Copied" : "Copy link"}
        </button>
        <Link className="btn btn-lg" href={`/match/${clip.match_id}?t=${clip.start}`} title="Open the full match at this moment">
          <ExternalIcon width={16} height={16} /> Open in full match
        </Link>
        <span className="ml-auto text-xs text-faint">Loops automatically. Faded players were off camera.</span>
      </div>
    </div>
  );
}
