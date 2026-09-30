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
import { Scrubber } from "./Scrubber";
import { ClipPanel } from "./ClipPanel";
import { SquadPanel } from "./SquadPanel";
import { MatchHeader } from "./MatchHeader";
import { ShortcutsHelp } from "./ShortcutsHelp";
import { PlayerAvatar } from "./PlayerAvatar";

interface Props {
  matchId: string;
  /** playback index to open at (from ?t=) */
  initialTime?: number;
}

type Tab = "clips" | "squads";

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
  const clipCount = usePlayback((s) => s.clips.length);

  const [progress, setProgress] = useState<{ loaded: number; total: number | null; label: string }>({ loaded: 0, total: null, label: "Loading" });
  const [error, setError] = useState<string | null>(null);
  const [help, setHelp] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("clips");

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
    setTab("clips");
  }, []);

  const clipEnd = useCallback(() => {
    const s = usePlayback.getState();
    if (!s.match) return;
    s.pause();
    const t = Math.round(s.time);
    if (s.draftStart == null || s.draftStart >= t) s.setDraftStart(Math.max(0, t - clipMaxFrames(s.match.meta)));
    s.setDraftEnd(t);
    setTab("clips");
  }, []);

  const clipLast10 = useCallback(() => {
    const s = usePlayback.getState();
    if (!s.match) return;
    s.pause();
    const t = Math.round(s.time);
    s.setDraftStart(Math.max(0, t - clipMaxFrames(s.match.meta)));
    s.setDraftEnd(t);
    setTab("clips");
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
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-surface-3">
            <div className="h-full bg-ink transition-[width]" style={{ width: pct != null ? `${pct}%` : "30%" }} />
          </div>
          <div className="mt-2 text-xs text-muted">{progress.total ? `${(progress.loaded / 1e6).toFixed(1)} of ${(progress.total / 1e6).toFixed(1)} MB` : "One download, then everything is instant"}</div>
        </div>
      </div>
    );
  }

  const meta = match.meta;
  const selected = selectedSlot != null ? meta.players[selectedSlot] : null;
  const selectedTeam = selected ? meta[selected.team] : null;

  return (
    <div className="flex h-screen flex-col">
      <MatchHeader meta={meta} overlays={overlays} skipGaps={skipGaps} onOverlay={setOverlay} onSkipGaps={setSkipGaps} onHelp={() => setHelp(true)} />

      <div className="flex min-h-0 flex-1 gap-3 p-3">
        <main className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="card relative min-h-0 flex-1 overflow-hidden">
            <PitchCanvas />
            {loop && (
              <div className="overlay-pill absolute top-3 left-3">
                Looping clip {formatIndexClock(meta, loop.start)} to {formatIndexClock(meta, loop.end)}
                <button onClick={() => setLoop(null)}>Exit</button>
              </div>
            )}
            {selected && selectedTeam && (
              <div className="overlay-pill absolute right-3 bottom-3 py-1 pl-1.5">
                <PlayerAvatar playerId={selected.id} name={selected.name} color={selectedTeam.color} size={26} />
                <span className="font-mono text-white/70">{selected.number}</span>
                <span className="font-medium">{selected.name}</span>
                <span className="text-white/60">{selected.position_name}</span>
                <button onClick={() => selectSlot(null)}>Stop following</button>
              </div>
            )}
          </div>
          <div className="card pb-1">
            <Controls onClipStart={clipStart} onClipEnd={clipEnd} onClipLast10={clipLast10} onPrevChance={prevChance} onNextChance={nextChance} />
            <Scrubber onPlayClip={playClip} />
          </div>
        </main>

        <aside className="card flex w-[340px] shrink-0 flex-col overflow-hidden">
          <div className="flex border-b border-border px-2 pt-2" role="tablist">
            <TabButton on={tab === "clips"} onClick={() => setTab("clips")}>
              Clips {clipCount > 0 && <span className="chip ml-1 h-5 px-1.5">{clipCount}</span>}
            </TabButton>
            <TabButton on={tab === "squads"} onClick={() => setTab("squads")}>
              Squads
            </TabButton>
          </div>
          <div className="min-h-0 flex-1">{tab === "clips" ? <ClipPanel onPlayClip={playClip} onCopied={setToast} /> : <SquadPanel />}</div>
        </aside>
      </div>

      <ShortcutsHelp open={help} onClose={() => setHelp(false)} />
      {toast && <div className="fade-up fixed bottom-5 left-1/2 z-40 -translate-x-1/2 rounded-lg bg-ink px-4 py-2 text-sm text-white shadow-lg">{toast}</div>}
    </div>
  );
}

function TabButton({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      role="tab"
      aria-selected={on}
      onClick={onClick}
      className={`-mb-px inline-flex h-9 items-center border-b-2 px-3 text-[13px] font-medium transition-colors ${on ? "border-ink text-text" : "border-transparent text-muted hover:text-text"}`}
    >
      {children}
    </button>
  );
}
