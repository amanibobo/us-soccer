"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePlayback } from "@/store/playback";
import { loadMatch } from "@/lib/bundle";
import { secondsToFrames, formatIndexClock } from "@/lib/clock";
import { clipMaxFrames, type Clip } from "@/lib/clip";
import { usePlaybackLoop } from "@/hooks/usePlaybackLoop";
import { useKeyboard } from "@/hooks/useKeyboard";
import { PitchCanvas } from "./PitchCanvas";
import { Controls } from "./Controls";
import { Scrubber, PHASE_LEGEND } from "./Scrubber";
import { ClipPanel } from "./ClipPanel";
import { ShortcutsHelp } from "./ShortcutsHelp";
import { KeyboardIcon } from "./icons";

interface Props {
  matchId: string;
  /** playback index to open at (from ?t=) */
  initialTime?: number;
}

export function Editor({ matchId, initialTime }: Props) {
  const match = usePlayback((s) => s.match);
  const setMatch = usePlayback((s) => s.setMatch);
  const overlays = usePlayback((s) => s.overlays);
  const setOverlay = usePlayback((s) => s.setOverlay);
  const selectedSlot = usePlayback((s) => s.selectedSlot);
  const selectSlot = usePlayback((s) => s.selectSlot);
  const skipGaps = usePlayback((s) => s.skipGaps);
  const setSkipGaps = usePlayback((s) => s.setSkipGaps);
  const loop = usePlayback((s) => s.loop);
  const setLoop = usePlayback((s) => s.setLoop);

  const [progress, setProgress] = useState<{ loaded: number; total: number | null; label: string }>({ loaded: 0, total: null, label: "Loading" });
  const [error, setError] = useState<string | null>(null);
  const [help, setHelp] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  usePlaybackLoop();

  useEffect(() => {
    let cancelled = false;
    setMatch(null);
    loadMatch(matchId, (loaded, total, label) => !cancelled && setProgress({ loaded, total, label }))
      .then((m) => {
        if (cancelled) return;
        setMatch(m);
        if (initialTime != null) usePlayback.getState().seek(initialTime);
      })
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [matchId, initialTime, setMatch]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  // ---- clip actions
  const clipStart = useCallback(() => {
    const s = usePlayback.getState();
    if (!s.match) return;
    s.pause();
    const t = Math.round(s.time);
    s.setDraftStart(t);
    if (s.draftEnd != null && s.draftEnd <= t) s.setDraftEnd(null);
  }, []);

  const clipEnd = useCallback(() => {
    const s = usePlayback.getState();
    if (!s.match) return;
    s.pause();
    const t = Math.round(s.time);
    if (s.draftStart == null || s.draftStart >= t) {
      // No start yet: default to the 10 s before this moment.
      s.setDraftStart(Math.max(0, t - clipMaxFrames(s.match.meta)));
    }
    s.setDraftEnd(t);
  }, []);

  const clipLast10 = useCallback(() => {
    const s = usePlayback.getState();
    if (!s.match) return;
    s.pause();
    const t = Math.round(s.time);
    s.setDraftStart(Math.max(0, t - clipMaxFrames(s.match.meta)));
    s.setDraftEnd(t);
  }, []);

  const chanceIndices = useMemo(() => (match ? match.meta.shots.map((s) => s.i).sort((a, b) => a - b) : []), [match]);
  const nextChance = useCallback(() => {
    const s = usePlayback.getState();
    if (!s.match) return;
    const pre = secondsToFrames(s.match.meta, 6);
    const target = chanceIndices.find((i) => i - pre > Math.round(s.time) + 1);
    if (target != null) s.seek(target - pre);
  }, [chanceIndices]);
  const prevChance = useCallback(() => {
    const s = usePlayback.getState();
    if (!s.match) return;
    const pre = secondsToFrames(s.match.meta, 6);
    const target = [...chanceIndices].reverse().find((i) => i - pre < Math.round(s.time) - 1);
    if (target != null) s.seek(target - pre);
  }, [chanceIndices]);

  const playClip = useCallback((c: Clip) => {
    const s = usePlayback.getState();
    s.clearDraft();
    s.setLoop({ start: c.start, end: c.end });
    s.seek(c.start);
    s.play();
  }, []);

  const keyHandlers = useMemo(
    () => ({
      onClipStart: clipStart,
      onClipEnd: clipEnd,
      onNextChance: nextChance,
      onPrevChance: prevChance,
      onHelp: () => setHelp((h) => !h),
      onEscape: () => {
        setHelp(false);
        const s = usePlayback.getState();
        if (s.loop) s.setLoop(null);
        else if (s.draftStart != null) s.clearDraft();
        else s.selectSlot(null);
      },
    }),
    [clipStart, clipEnd, nextChance, prevChance],
  );
  useKeyboard(keyHandlers);

  // ---- loading and error states
  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="card max-w-md p-6">
          <h1 className="text-lg font-semibold">Could not load match {matchId}</h1>
          <p className="mt-2 text-sm text-muted">{error}</p>
          <Link href="/" className="btn mt-4">
            Back to start
          </Link>
        </div>
      </div>
    );
  }
  if (!match) {
    const pct = progress.total ? Math.round((100 * progress.loaded) / progress.total) : null;
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="w-72 text-center">
          <div className="text-sm font-medium">{progress.label}</div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-200">
            <div className="h-full bg-accent transition-[width]" style={{ width: pct != null ? `${pct}%` : "30%" }} />
          </div>
          <div className="mt-2 text-xs text-muted">{progress.total ? `${(progress.loaded / 1e6).toFixed(1)} of ${(progress.total / 1e6).toFixed(1)} MB` : "One download, then everything is instant"}</div>
        </div>
      </div>
    );
  }

  const meta = match.meta;
  const selected = selectedSlot != null ? meta.players[selectedSlot] : null;

  return (
    <div className="flex h-screen flex-col">
      {/* header */}
      <header className="flex items-center gap-3 border-b border-border bg-surface px-4 py-2">
        <Link href="/" className="text-sm font-semibold tracking-tight">
          Touchline
        </Link>
        <span className="text-faint">/</span>
        <div className="flex items-center gap-2 text-sm">
          <TeamDot color={meta.home.color} />
          <span className="font-medium">{meta.home.short_name}</span>
          <span className="font-mono text-base font-semibold tabular-nums">
            {meta.home.score} - {meta.away.score}
          </span>
          <span className="font-medium">{meta.away.short_name}</span>
          <TeamDot color={meta.away.color} />
        </div>
        <span className="hidden text-xs text-muted md:inline">
          {meta.competition} · {meta.date ? new Date(meta.date).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : ""}
        </span>

        <div className="ml-auto flex items-center gap-1.5">
          <Toggle on={overlays.camera} onChange={(v) => setOverlay("camera", v)} title="Shade what the broadcast camera could see">
            Camera view
          </Toggle>
          <Toggle on={overlays.trails} onChange={(v) => setOverlay("trails", v)} title="Show every player's last 3 seconds">
            Trails
          </Toggle>
          <Toggle on={overlays.names} onChange={(v) => setOverlay("names", v)} title="Show player names">
            Names
          </Toggle>
          <Toggle on={skipGaps} onChange={setSkipGaps} title="Jump over stretches where the broadcast cut away">
            Skip gaps
          </Toggle>
          <button className="btn btn-ghost btn-icon" onClick={() => setHelp(true)} title="Keyboard shortcuts (?)" aria-label="Keyboard shortcuts">
            <KeyboardIcon />
          </button>
        </div>
      </header>

      {/* body */}
      <div className="flex min-h-0 flex-1">
        <main className="flex min-w-0 flex-1 flex-col p-3">
          <div className="card relative min-h-0 flex-1 overflow-hidden">
            <PitchCanvas />
            {loop && (
              <div className="absolute top-3 left-3 flex items-center gap-2 rounded-lg bg-black/60 px-3 py-1.5 text-xs text-white backdrop-blur-sm">
                Looping clip {formatIndexClock(meta, loop.start)} to {formatIndexClock(meta, loop.end)}
                <button className="rounded bg-white/20 px-1.5 py-0.5 hover:bg-white/30" onClick={() => setLoop(null)}>
                  Exit
                </button>
              </div>
            )}
            {selected && (
              <div className="absolute right-3 bottom-3 flex items-center gap-2 rounded-lg bg-black/60 px-3 py-1.5 text-xs text-white backdrop-blur-sm">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: selected.team === "home" ? meta.home.color : meta.away.color }} />
                <span className="font-medium">
                  {selected.number} {selected.name}
                </span>
                <span className="text-white/70">{selected.position_name}</span>
                <button className="rounded bg-white/20 px-1.5 py-0.5 hover:bg-white/30" onClick={() => selectSlot(null)}>
                  Clear
                </button>
              </div>
            )}
          </div>
          <div className="card mt-3 px-2">
            <Controls onClipStart={clipStart} onClipEnd={clipEnd} onClipLast10={clipLast10} onPrevChance={prevChance} onNextChance={nextChance} />
            <Scrubber onPlayClip={playClip} />
            <div className="flex flex-wrap items-center gap-3 px-1 pb-2 text-[11px] text-muted">
              {PHASE_LEGEND.map(([label, color]) => (
                <span key={label} className="inline-flex items-center gap-1">
                  <span className="inline-block h-2 w-3 rounded-sm" style={{ background: color }} /> {label}
                </span>
              ))}
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-danger" /> Goal
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-2 w-[3px] rounded-sm bg-zinc-500" /> Shot
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="hatch inline-block h-2 w-3 rounded-sm bg-zinc-200" /> No tracking
              </span>
            </div>
          </div>
        </main>
        <aside className="card m-3 ml-0 flex w-[340px] shrink-0 flex-col overflow-hidden">
          <ClipPanel onPlayClip={playClip} onCopied={setToast} />
        </aside>
      </div>

      <ShortcutsHelp open={help} onClose={() => setHelp(false)} />
      {toast && <div className="fade-up fixed bottom-5 left-1/2 z-40 -translate-x-1/2 rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white shadow-lg">{toast}</div>}
    </div>
  );
}

function TeamDot({ color }: { color: string }) {
  return <span className="inline-block h-3 w-3 rounded-full border border-black/20" style={{ background: color }} />;
}

function Toggle({ on, onChange, title, children }: { on: boolean; onChange: (v: boolean) => void; title: string; children: React.ReactNode }) {
  return (
    <button className={`btn btn-sm ${on ? "btn-on" : ""}`} onClick={() => onChange(!on)} title={title} aria-pressed={on}>
      {children}
    </button>
  );
}
