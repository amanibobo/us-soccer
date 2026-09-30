import type { MatchMeta } from "./types";

export const CLIP_MAX_SECONDS = 10;

export interface Drawing {
  kind: "arrow" | "line" | "zone" | "free";
  color: string;
  /** points in pitch metres */
  points: [number, number][];
}

export interface Overlays {
  camera?: boolean;
  trails?: boolean;
  focusPlayer?: number | null;
}

export interface Clip {
  id: string;
  match_id: number;
  start: number; // playback index
  end: number; // playback index, inclusive
  title: string;
  tags: string[];
  author: string;
  notes?: string;
  drawings?: Drawing[];
  overlays?: Overlays;
  created_at: string;
}

export function clipMaxFrames(meta: MatchMeta): number {
  return Math.round(CLIP_MAX_SECONDS * meta.fps);
}

export function clipLength(meta: MatchMeta, start: number, end: number): number {
  return (end - start) / meta.fps;
}

/** Returns a user-facing problem with the range, or null when it is valid. */
export function clipProblem(meta: MatchMeta, start: number | null, end: number | null): string | null {
  if (start == null || end == null) return null;
  if (end <= start) return "The end must come after the start.";
  if (end - start > clipMaxFrames(meta)) return `Clips can be up to ${CLIP_MAX_SECONDS} seconds. Drag the end handle left.`;
  const p0 = meta.periods.find((p) => start >= p.start_index && start <= p.end_index);
  const p1 = meta.periods.find((p) => end >= p.start_index && end <= p.end_index);
  if (p0 && p1 && p0 !== p1) return "A clip cannot cross half time.";
  return null;
}

export function newClipId(): string {
  const alphabet = "abcdefghijkmnpqrstuvwxyz23456789";
  let s = "";
  const bytes = new Uint8Array(7);
  crypto.getRandomValues(bytes);
  for (const b of bytes) s += alphabet[b % alphabet.length];
  return s;
}

// --------------------------------------------------------------------- URL encoding
// A clip is small enough to live in its own link, so a shared link still opens
// with no database at all. Keys are short to keep URLs short.

interface Packed {
  v: 1;
  i: string;
  m: number;
  s: number;
  e: number;
  t: string;
  g?: string[];
  a?: string;
  n?: string;
  d?: Drawing[];
  o?: Overlays;
  c: string;
}

function toBase64Url(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): string {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4);
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export function encodeClip(c: Clip): string {
  const p: Packed = { v: 1, i: c.id, m: c.match_id, s: c.start, e: c.end, t: c.title, c: c.created_at };
  if (c.tags.length) p.g = c.tags;
  if (c.author) p.a = c.author;
  if (c.notes) p.n = c.notes;
  if (c.drawings?.length) p.d = c.drawings;
  if (c.overlays && Object.keys(c.overlays).length) p.o = c.overlays;
  return toBase64Url(JSON.stringify(p));
}

export function decodeClip(code: string): Clip | null {
  try {
    const p = JSON.parse(fromBase64Url(code)) as Packed;
    if (p.v !== 1 || typeof p.m !== "number") return null;
    return {
      id: p.i,
      match_id: p.m,
      start: p.s,
      end: p.e,
      title: p.t ?? "Clip",
      tags: p.g ?? [],
      author: p.a ?? "",
      notes: p.n,
      drawings: p.d,
      overlays: p.o,
      created_at: p.c ?? new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function clipPath(c: Clip): string {
  return `/clip/${encodeClip(c)}`;
}

// --------------------------------------------------------------------- local storage
// Phase 1 keeps clips in the browser. A server store can be layered on later
// without changing the clip shape.

const KEY = (matchId: number) => `larpers:clips:${matchId}`;

export function loadClips(matchId: number): Clip[] {
  try {
    const raw = localStorage.getItem(KEY(matchId));
    return raw ? (JSON.parse(raw) as Clip[]) : [];
  } catch {
    return [];
  }
}

export function saveClips(matchId: number, clips: Clip[]): void {
  try {
    localStorage.setItem(KEY(matchId), JSON.stringify(clips));
  } catch {
    /* private mode or full storage: the clip still works through its link */
  }
}
