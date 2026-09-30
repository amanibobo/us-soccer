"use client";

import { useMemo, useState } from "react";
import { usePlayback } from "@/store/playback";
import type { MatchData, PlayerMeta, TeamSide } from "@/lib/types";
import { TeamBadge } from "./TeamBadge";
import { PlayerAvatar, photoCredits } from "./PlayerAvatar";

/** Both rosters. Click a player to follow him on the pitch. */
export function SquadPanel() {
  const match = usePlayback((s) => s.match);
  const frame = usePlayback((s) => Math.floor(s.time));
  const selectedSlot = usePlayback((s) => s.selectedSlot);
  const selectSlot = usePlayback((s) => s.selectSlot);
  const [team, setTeam] = useState<TeamSide>("home");

  if (!match) return null;
  const meta = match.meta;
  const t = meta[team];
  const players = meta.players.filter((p) => p.team === team);
  const onPitch = (p: PlayerMeta) => (match.flags[frame * match.nSlots + p.slot] & 1) === 1;
  const starters = players.filter((p) => p.start_frame != null && p.start_frame <= meta.periods[0].start_frame);
  const others = players.filter((p) => !starters.includes(p));
  const credits = photoCredits(players.map((p) => p.id));

  return (
    <div className="flex h-full flex-col">
      <div className="seg m-3 grid grid-cols-2" role="tablist" aria-label="Team">
        {(["home", "away"] as TeamSide[]).map((side) => (
          <button key={side} role="tab" aria-selected={team === side} data-on={team === side} onClick={() => setTeam(side)} className="flex items-center justify-center gap-2">
            <TeamBadge teamId={meta[side].id} name={meta[side].name} acronym={meta[side].acronym} color={meta[side].color} size={16} />
            {meta[side].short_name}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        <Group label="Starting XI" players={starters} match={match} selectedSlot={selectedSlot} onPitch={onPitch} onSelect={selectSlot} color={t.color} />
        {others.length > 0 && (
          <Group label="Substitutes" players={others} match={match} selectedSlot={selectedSlot} onPitch={onPitch} onSelect={selectSlot} color={t.color} />
        )}
        <p className="mt-3 px-2 text-[11px] leading-relaxed text-faint">
          Click a player to follow him on the pitch. The dot shows who is on the pitch at this moment.
          {credits && <> Photos: {credits}.</>}
        </p>
      </div>
    </div>
  );
}

function Group({
  label,
  players,
  match,
  selectedSlot,
  onPitch,
  onSelect,
  color,
}: {
  label: string;
  players: PlayerMeta[];
  match: MatchData;
  selectedSlot: number | null;
  onPitch: (p: PlayerMeta) => boolean;
  onSelect: (slot: number | null) => void;
  color: string;
}) {
  const sorted = useMemo(() => [...players].sort((a, b) => posRank(a.position) - posRank(b.position) || (a.number ?? 99) - (b.number ?? 99)), [players]);
  const goals = useMemo(() => {
    const m = new Map<number, number>();
    for (const g of match.meta.goals) if (g.pid != null) m.set(g.pid, (m.get(g.pid) ?? 0) + 1);
    return m;
  }, [match]);

  return (
    <div className="mt-1">
      <div className="px-2 pt-2 pb-1 text-[11px] font-medium tracking-wide text-faint uppercase">{label}</div>
      <ul>
        {sorted.map((p) => {
          const active = p.slot === selectedSlot;
          const here = onPitch(p);
          return (
            <li key={p.id}>
              <button
                onClick={() => onSelect(active ? null : p.slot)}
                className={`group flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors ${active ? "bg-ink text-white" : "hover:bg-surface-2"}`}
                title={active ? "Stop following" : `Follow ${p.name}`}
              >
                <PlayerAvatar playerId={p.id} name={p.name} color={color} size={34} />
                <span className={`w-6 shrink-0 text-right font-mono text-xs tabular-nums ${active ? "text-white/70" : "text-muted"}`}>{p.number ?? ""}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium">{p.name}</span>
                  <span className={`block truncate text-[11px] ${active ? "text-white/70" : "text-muted"}`}>
                    {p.position_name && p.position_name.toLowerCase() !== "substitute" ? p.position_name : p.position || "Bench"}
                    {p.goals > 0 && <> · {p.goals} goal{p.goals > 1 ? "s" : ""}</>}
                    {p.yellow > 0 && <span className="ml-1.5 inline-block h-2.5 w-2 translate-y-px rounded-[2px] bg-yellow-400 align-baseline" title="Yellow card" />}
                    {p.red > 0 && <span className="ml-1 inline-block h-2.5 w-2 translate-y-px rounded-[2px] bg-red-500 align-baseline" title="Red card" />}
                  </span>
                </span>
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${here ? "bg-ok" : active ? "bg-white/30" : "bg-border-strong"}`}
                  title={here ? "On the pitch now" : "Not on the pitch now"}
                />
                {goals.get(p.id) ? <span className="sr-only">scored</span> : null}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function posRank(pos: string): number {
  const p = pos.toUpperCase();
  if (p === "GK") return 0;
  if (/B$/.test(p) || p === "CB" || p === "LB" || p === "RB") return 1;
  if (/M$/.test(p) || p.includes("M")) return 2;
  if (/W/.test(p)) return 3;
  if (/F$/.test(p) || p === "CF" || p === "ST") return 4;
  return 5;
}
