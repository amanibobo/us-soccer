"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePlayback } from "@/store/playback";
import { formatIndexClock } from "@/lib/clock";
import { CLIP_MAX_SECONDS, type Clip, clipLength, clipPath, clipProblem, newClipId } from "@/lib/clip";
import { ExternalIcon, LinkIcon, PlayIcon, TrashIcon } from "./icons";

interface Props {
  onPlayClip: (c: Clip) => void;
  onCopied: (msg: string) => void;
}

const AUTHOR_KEY = "larpers:author";

export function ClipPanel({ onPlayClip, onCopied }: Props) {
  const match = usePlayback((s) => s.match);
  const draftStart = usePlayback((s) => s.draftStart);
  const draftEnd = usePlayback((s) => s.draftEnd);
  const clearDraft = usePlayback((s) => s.clearDraft);
  const clips = usePlayback((s) => s.clips);
  const addClip = usePlayback((s) => s.addClip);
  const removeClip = usePlayback((s) => s.removeClip);
  const selectedSlot = usePlayback((s) => s.selectedSlot);
  const overlays = usePlayback((s) => s.overlays);
  const loop = usePlayback((s) => s.loop);

  const [title, setTitle] = useState("");
  const [tags, setTags] = useState("");
  const [author, setAuthor] = useState(() => {
    try {
      return localStorage.getItem(AUTHOR_KEY) ?? "";
    } catch {
      return "";
    }
  });
  const [filter, setFilter] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);

  const hasRange = draftStart != null && draftEnd != null;
  useEffect(() => {
    // Focus after the keypress that created the range has finished, so the
    // "O" key does not get typed into the title.
    if (!hasRange) return;
    const id = requestAnimationFrame(() => titleRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [hasRange]);

  const meta = match?.meta;
  const problem = meta ? clipProblem(meta, draftStart, draftEnd) : null;
  const seconds = meta && hasRange ? clipLength(meta, draftStart, draftEnd) : 0;

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return clips;
    return clips.filter((c) => c.title.toLowerCase().includes(q) || c.tags.some((t) => t.toLowerCase().includes(q)));
  }, [clips, filter]);

  if (!match || !meta) return null;

  const copyLink = async (c: Clip) => {
    const url = `${window.location.origin}${clipPath(c)}`;
    try {
      await navigator.clipboard.writeText(url);
      onCopied("Link copied. Anyone can open it.");
    } catch {
      onCopied(url);
    }
  };

  const save = async () => {
    if (!hasRange || problem) return;
    const clip: Clip = {
      id: newClipId(),
      match_id: meta.match_id,
      start: draftStart,
      end: draftEnd,
      title: title.trim() || `Clip at ${formatIndexClock(meta, draftStart)}`,
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      author: author.trim(),
      overlays: { camera: overlays.camera, trails: overlays.trails, focusPlayer: selectedSlot },
      created_at: new Date().toISOString(),
    };
    try {
      localStorage.setItem(AUTHOR_KEY, clip.author);
    } catch {}
    addClip(clip);
    clearDraft();
    setTitle("");
    setTags("");
    await copyLink(clip);
  };

  const steps = [
    <>
      Pause on the moment and press <b className="font-medium text-text">Start clip</b> <span className="kbd">I</span>
    </>,
    <>
      Move forward and press <b className="font-medium text-text">End clip</b> <span className="kbd">O</span>
    </>,
    <>Give it a title and save. The link is copied for you.</>,
  ];

  return (
    <div className="flex h-full flex-col">
      {/* draft */}
      <div className="border-b border-border p-3">
        {!hasRange ? (
          <div className="text-[13px] text-muted">
            <div className="font-medium text-text">Make a clip</div>
            <ol className="mt-2 space-y-1.5">
              {steps.map((step, i) => (
                <li key={i} className="flex gap-2.5">
                  <span className="mt-px flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-surface-3 font-mono text-[10px] text-muted">{i + 1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
            {draftStart != null && (
              <div className="mt-3 rounded-lg bg-clip-soft px-2.5 py-2 text-xs text-amber-900">
                Start set at <b className="font-medium">{formatIndexClock(meta, draftStart)}</b>. Now play or drag forward and press <b className="font-medium">End clip</b>.
              </div>
            )}
          </div>
        ) : (
          <div className="fade-up space-y-2">
            <div className="flex items-baseline justify-between">
              <div className="text-[13px] font-medium">New clip</div>
              <div className={`font-mono text-xs tabular-nums ${problem ? "text-danger" : "text-muted"}`}>
                {seconds.toFixed(1)} s of {CLIP_MAX_SECONDS} s
              </div>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-surface-3">
              <div className={`h-full ${problem ? "bg-danger" : "bg-clip"}`} style={{ width: `${Math.min(100, (100 * seconds) / CLIP_MAX_SECONDS)}%` }} />
            </div>
            <div className="font-mono text-[11px] text-muted">
              {formatIndexClock(meta, draftStart, true)} → {formatIndexClock(meta, draftEnd, true)}
            </div>
            {problem && <div className="rounded-lg bg-danger-soft px-2.5 py-2 text-xs text-danger">{problem}</div>}
            <input
              className="input"
              placeholder={`Title (default: Clip at ${formatIndexClock(meta, draftStart)})`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && save()}
              ref={titleRef}
            />
            <input className="input" placeholder="Tags, comma separated (pressing, build-up, #17)" value={tags} onChange={(e) => setTags(e.target.value)} />
            <input className="input" placeholder="Your name (optional)" value={author} onChange={(e) => setAuthor(e.target.value)} />
            <div className="flex gap-2 pt-1">
              <button className="btn btn-primary flex-1" onClick={save} disabled={!!problem} title="Save the clip and copy its link">
                Save and copy link
              </button>
              <button className="btn" onClick={clearDraft} title="Discard this clip">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* list */}
      <div className="flex h-11 items-center gap-2 border-b border-border px-3">
        <div className="text-xs font-medium text-muted">
          {clips.length} clip{clips.length === 1 ? "" : "s"}
        </div>
        {clips.length > 0 && <input className="input ml-auto h-7 max-w-[170px] text-xs" placeholder="Filter by title or tag" value={filter} onChange={(e) => setFilter(e.target.value)} />}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="p-6 text-center text-xs text-faint">{clips.length ? "No clips match that filter." : "Saved clips appear here and as markers on the timeline."}</div>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((c) => {
              const active = loop?.start === c.start && loop?.end === c.end;
              return (
                <li key={c.id} className={`group px-3 py-2.5 transition-colors ${active ? "bg-surface-2" : "hover:bg-surface-2"}`}>
                  <div className="flex items-start gap-2.5">
                    <button className="btn btn-sm btn-icon mt-0.5 shrink-0" onClick={() => onPlayClip(c)} title="Play this clip" aria-label="Play clip">
                      <PlayIcon width={13} height={13} />
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-medium">{c.title}</div>
                      <div className="mt-0.5 font-mono text-[11px] text-muted">
                        {formatIndexClock(meta, c.start)} – {formatIndexClock(meta, c.end)} · {clipLength(meta, c.start, c.end).toFixed(1)} s
                        {c.author && <span className="font-sans"> · {c.author}</span>}
                      </div>
                      {c.tags.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {c.tags.map((t) => (
                            <button key={t} onClick={() => setFilter(t)} className="chip hover:bg-border">
                              {t}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                      <button className="btn btn-ghost btn-sm btn-icon" onClick={() => copyLink(c)} title="Copy link" aria-label="Copy link">
                        <LinkIcon width={14} height={14} />
                      </button>
                      <a className="btn btn-ghost btn-sm btn-icon" href={clipPath(c)} target="_blank" rel="noreferrer" title="Open the clip page" aria-label="Open clip page">
                        <ExternalIcon width={14} height={14} />
                      </a>
                      <button className="btn btn-ghost btn-sm btn-icon hover:text-danger" onClick={() => removeClip(c.id)} title="Delete clip" aria-label="Delete clip">
                        <TrashIcon width={14} height={14} />
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
