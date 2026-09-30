import { readFile } from "node:fs/promises";
import path from "node:path";
import type { MatchIndexEntry } from "./types";
import type { PreviewFrame } from "@/components/HeroPreview";

/**
 * Server-side match index. Reads web/public/data/index.json when bundles are
 * served locally, or fetches it when NEXT_PUBLIC_DATA_BASE points elsewhere.
 */
export async function loadMatchIndexServer(): Promise<MatchIndexEntry[]> {
  const base = process.env.NEXT_PUBLIC_DATA_BASE;
  try {
    if (base && /^https?:\/\//.test(base)) {
      const res = await fetch(`${base}/index.json`, { next: { revalidate: 300 } });
      if (!res.ok) return [];
      return ((await res.json()) as { matches: MatchIndexEntry[] }).matches;
    }
    const file = path.join(process.cwd(), "public", base ?? "data", "index.json");
    return (JSON.parse(await readFile(file, "utf8")) as { matches: MatchIndexEntry[] }).matches;
  } catch {
    return [];
  }
}

/** One real frame of a match for the landing page hero. */
export async function loadPreviewServer(matchId: string): Promise<PreviewFrame | null> {
  const base = process.env.NEXT_PUBLIC_DATA_BASE;
  try {
    if (base && /^https?:\/\//.test(base)) {
      const res = await fetch(`${base}/${matchId}/preview.json`, { next: { revalidate: 300 } });
      return res.ok ? ((await res.json()) as PreviewFrame) : null;
    }
    const file = path.join(process.cwd(), "public", base ?? "data", matchId, "preview.json");
    return JSON.parse(await readFile(file, "utf8")) as PreviewFrame;
  } catch {
    return null;
  }
}
