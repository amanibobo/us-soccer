"use client";

import Link from "next/link";
import type { MatchMeta } from "@/lib/types";
import { matchLinks } from "@/config/matches";
import { site } from "@/config/site";
import { BallLogo } from "@/components/BallLogo";
import { TeamBadge } from "./TeamBadge";
import { KeyboardIcon, YoutubeIcon } from "./icons";
import type { Overlays } from "@/store/playback";

interface Props {
  meta: MatchMeta;
  overlays: Overlays;
  skipGaps: boolean;
  onOverlay: (k: keyof Overlays, v: boolean) => void;
  onSkipGaps: (v: boolean) => void;
  onHelp: () => void;
}

export function MatchHeader({ meta, overlays, skipGaps, onOverlay, onSkipGaps, onHelp }: Props) {
  const links = matchLinks(meta.match_id);
  const date = meta.date ? new Date(meta.date).toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" }) : "";

  return (
    <header className="flex h-14 items-center gap-4 border-b border-border bg-surface px-4">
      <Link href="/" className="flex items-center gap-2 text-[13px] font-semibold tracking-tight text-text">
        <BallLogo size={18} /> {site.name}
      </Link>

      <span className="h-5 w-px bg-border" />

      {/* scoreboard */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <TeamBadge teamId={meta.home.id} name={meta.home.name} acronym={meta.home.acronym} color={meta.home.color} size={26} />
          <span className="text-[13px] font-medium">{meta.home.short_name}</span>
        </div>
        <span className="rounded-md bg-surface-3 px-2 py-0.5 font-mono text-[13px] font-semibold tabular-nums">
          {meta.home.score} – {meta.away.score}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-medium">{meta.away.short_name}</span>
          <TeamBadge teamId={meta.away.id} name={meta.away.name} acronym={meta.away.acronym} color={meta.away.color} size={26} />
        </div>
      </div>

      <div className="hidden text-xs text-muted lg:block">
        {[meta.competition, meta.stadium, date].filter(Boolean).join(" · ")}
      </div>

      <div className="ml-auto flex items-center gap-2">
        {links.highlights && (
          <a href={links.highlights} target="_blank" rel="noreferrer" className="btn btn-ghost" title="Watch the broadcast highlights on YouTube">
            <YoutubeIcon width={16} height={16} className="text-[#ff0033]" /> Highlights
          </a>
        )}
        <div className="seg" role="group" aria-label="Overlays">
          <button aria-pressed={overlays.camera} onClick={() => onOverlay("camera", !overlays.camera)} title="Shade what the broadcast camera could see">
            Camera view
          </button>
          <button aria-pressed={overlays.trails} onClick={() => onOverlay("trails", !overlays.trails)} title="Show every player's last 3 seconds">
            Trails
          </button>
          <button aria-pressed={overlays.names} onClick={() => onOverlay("names", !overlays.names)} title="Show player names">
            Names
          </button>
          <button aria-pressed={skipGaps} onClick={() => onSkipGaps(!skipGaps)} title="Jump over stretches where the broadcast cut away">
            Skip gaps
          </button>
        </div>
        <button className="btn btn-ghost btn-icon" onClick={onHelp} title="Keyboard shortcuts (?)" aria-label="Keyboard shortcuts">
          <KeyboardIcon />
        </button>
      </div>
    </header>
  );
}

