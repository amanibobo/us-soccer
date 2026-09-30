import type { MatchData, MatchEvent, MatchIndexEntry, MatchMeta, Phase } from "./types";

/** Where bundles live. Local dev serves them from web/public/data. */
export const DATA_BASE = process.env.NEXT_PUBLIC_DATA_BASE ?? "/data";

interface Section {
  name: string;
  dtype: string;
  shape: number[];
  offset: number;
  length: number;
}

interface ContainerHeader {
  format: number;
  fps: number;
  n_slots: number;
  sections: Section[];
}

export type Progress = (loadedBytes: number, totalBytes: number | null, label: string) => void;

async function fetchBytes(url: string, onProgress?: Progress, label = ""): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`Could not load ${url} (${res.status})`);
  const total = Number(res.headers.get("content-length")) || null;
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    onProgress?.(loaded, total, label);
  }
  const out = new Uint8Array(loaded);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}

async function gunzip(bytes: Uint8Array): Promise<Uint8Array> {
  // Some hosts transparently decode .gz; detect the magic number first.
  if (!(bytes[0] === 0x1f && bytes[1] === 0x8b)) return bytes;
  const ds = new DecompressionStream("gzip");
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(ds);
  const buf = await new Response(stream).arrayBuffer();
  return new Uint8Array(buf);
}

function parseContainer(bytes: Uint8Array): { header: ContainerHeader; body: DataView; base: number } {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const hlen = dv.getUint32(0, true);
  const header = JSON.parse(new TextDecoder().decode(bytes.subarray(4, 4 + hlen))) as ContainerHeader;
  return { header, body: dv, base: bytes.byteOffset + 4 + hlen };
}

function section<T extends Int16Array | Uint8Array | Int32Array>(
  bytes: Uint8Array,
  base: number,
  header: ContainerHeader,
  name: string,
  ctor: new (buffer: ArrayBufferLike, byteOffset: number, length: number) => T,
  bytesPer: number,
): T {
  const s = header.sections.find((x) => x.name === name);
  if (!s) throw new Error(`bundle is missing section ${name}`);
  const start = base + s.offset;
  // Typed arrays need aligned offsets; copy if the underlying buffer is not aligned.
  if (start % bytesPer !== 0) {
    const copy = bytes.slice(start, start + s.length);
    return new ctor(copy.buffer, 0, s.length / bytesPer);
  }
  return new ctor(bytes.buffer, start, s.length / bytesPer);
}

export async function loadMatchIndex(): Promise<MatchIndexEntry[]> {
  const res = await fetch(`${DATA_BASE}/index.json`, { cache: "no-store" });
  if (!res.ok) return [];
  const j = (await res.json()) as { matches: MatchIndexEntry[] };
  return j.matches;
}

export async function loadMatch(matchId: string, onProgress?: Progress): Promise<MatchData> {
  const base = `${DATA_BASE}/${matchId}`;
  onProgress?.(0, null, "Loading match info");
  const metaRes = await fetch(`${base}/meta.json`);
  if (!metaRes.ok) throw new Error(`No bundle found for match ${matchId}. Run: make data MATCH=${matchId}`);
  const meta = (await metaRes.json()) as MatchMeta;

  const [evBytes, trBytes] = await Promise.all([
    fetchBytes(`${base}/events.json`, undefined, "events"),
    fetchBytes(`${base}/tracking.bin.gz`, onProgress, "Loading tracking data"),
  ]);
  onProgress?.(1, 1, "Unpacking");
  const ev = JSON.parse(new TextDecoder().decode(evBytes)) as { events: MatchEvent[]; phases: Phase[] };
  const raw = await gunzip(trBytes);
  const { header, base: off } = parseContainer(raw);

  const pos = section(raw, off, header, "pos", Int16Array, 2);
  const flags = section(raw, off, header, "flags", Uint8Array, 1);
  const ball = section(raw, off, header, "ball", Int16Array, 2);
  const frame = section(raw, off, header, "frame", Int32Array, 4);
  const cam = section(raw, off, header, "cam", Int16Array, 2);

  const n = meta.n_frames;
  const nSlots = header.n_slots;
  const hasPlayers = new Uint8Array(n).fill(1);
  for (const [a, b] of meta.gaps) hasPlayers.fill(0, a, b + 1);

  return { meta, events: ev.events, phases: ev.phases, nSlots, pos, flags, ball, frame, cam, hasPlayers };
}
