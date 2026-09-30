"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePlayback } from "@/store/playback";
import { loadMatch } from "@/lib/bundle";
import { formatIndexClock } from "@/lib/clock";
import { clipLength, type Clip } from "@/lib/clip";
import { usePlaybackLoop } from "@/hooks/usePlaybackLoop";
import { PitchCanvas } from "./PitchCanvas";
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
    <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col px-4 py-6">
      <div className="mb-3 flex items-center justify-between">
        <Link href="/" className="text-sm font-semibold tracking-tight">
          {site.name}
        </Link>
        {meta && (
          <div className="text-xs text-muted">
            {meta.home.short_name} {meta.home.score} - {meta.away.score} {meta.away.short_name}
          </div>
        )}
      </div>

      <h1 className="text-xl font-semibold tracking-tight">{clip.title}</h1>
      <div className="mt-1 text-sm text-muted">
        {meta && (
          <>
            {formatIndexClock(meta, clip.start)} to {formatIndexClock(meta, clip.end)} · {seconds.toFixed(1)} s
          </>
        )}
        {clip.author && <> · by {clip.author}</>}
        {clip.tags.length > 0 && <> · {clip.tags.join(", ")}</>}
      </div>
      {clip.notes && <p className="mt-2 text-sm">{clip.notes}</p>}

      <div className="card mt-4 aspect-[105/72] w-full overflow-hidden">
        {error ? (
          <div className="flex h-full items-center justify-center p-6 text-sm text-danger">{error}</div>
        ) : !match ? (
          <div className="flex h-full items-center justify-center text-sm text-muted">Loading clip…</div>
        ) : (
          <div className="relative h-full" onClick={toggle}>
            <PitchCanvas interactive={false} />
            {!playing && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="rounded-full bg-black/55 p-4 text-white">
                  <PlayIcon width={28} height={28} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-zinc-200">
        <div className="h-full bg-accent" style={{ width: `${elapsed * 100}%` }} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button className="btn btn-primary" onClick={toggle} disabled={!match} title="Play or pause (Space)">
          {playing ? <PauseIcon /> : <PlayIcon />} {playing ? "Pause" : "Play"}
        </button>
        <button className="btn" onClick={copy} title="Copy this clip's link">
          <LinkIcon /> {copied ? "Copied" : "Copy link"}
        </button>
        <Link className="btn" href={`/match/${clip.match_id}?t=${clip.start}`} title="Open the full match at this moment">
          <ExternalIcon /> Open in full match
        </Link>
        <span className="ml-auto text-xs text-faint">Loops automatically. Faded players were off camera.</span>
      </div>
    </div>
  );
}
