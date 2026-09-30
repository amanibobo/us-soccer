import type { Metadata } from "next";
import Link from "next/link";
import { loadMatchIndexServer } from "@/lib/matches-server";
import { site } from "@/config/site";
import { BallLogo } from "@/components/BallLogo";
import { TeamBadge } from "@/components/TeamBadge";
import { ArrowRightIcon } from "@/components/icons";

export const metadata: Metadata = { title: `Matches · ${site.name}` };
export const dynamic = "force-dynamic";

export default async function MatchesPage() {
  const matches = (await loadMatchIndexServer()).sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));

  return (
    <div className="min-h-screen">
      <header className="flex h-14 items-center gap-4 border-b border-border bg-surface px-4">
        <Link href="/" className="flex items-center gap-2 text-[13px] font-semibold tracking-tight">
          <BallLogo size={18} /> {site.name}
        </Link>
        <span className="h-5 w-px bg-border" />
        <span className="text-[13px] text-muted">Choose a match</span>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 py-8">
        <h1 className="text-xl font-semibold tracking-tight">Matches</h1>
        <p className="mt-1 text-[13px] text-muted">
          {matches.length} A-League match{matches.length === 1 ? "" : "es"} from the SkillCorner open dataset. Every one loads the same way: pick it and scrub.
        </p>

        {matches.length === 0 ? (
          <div className="card mt-6 p-6 text-sm text-muted">
            No bundles found. Run <code className="rounded bg-surface-3 px-1.5 py-0.5 font-mono text-xs">make data MATCH=2006229</code> and refresh.
          </div>
        ) : (
          <ul className="mt-5 space-y-2">
            {matches.map((m) => {
              const date = m.date ? new Date(m.date).toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short", year: "numeric" }) : "";
              return (
                <li key={m.match_id}>
                  <Link
                    href={`/match/${m.match_id}`}
                    className="card group flex items-center gap-4 px-4 py-3 transition-[border-color,background-color,box-shadow] hover:border-border-strong hover:bg-surface-2 hover:shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                  >
                    <div className="w-[120px] shrink-0 text-[11px] text-muted">
                      <div>{date}</div>
                      <div className="text-faint">{m.competition}</div>
                    </div>

                    <div className="flex min-w-0 flex-1 items-center justify-center gap-3">
                      <div className="flex min-w-0 flex-1 items-center justify-end gap-2.5">
                        <span className="text-right text-[14px] leading-tight font-medium">{m.home.name}</span>
                        <TeamBadge teamId={m.home.id} name={m.home.name} acronym={m.home.short_name.slice(0, 3)} color={m.home.color} size={30} />
                      </div>
                      <span className="rounded-md bg-surface-3 px-2.5 py-1 font-mono text-[15px] font-semibold tabular-nums">
                        {m.home.score} – {m.away.score}
                      </span>
                      <div className="flex min-w-0 flex-1 items-center gap-2.5">
                        <TeamBadge teamId={m.away.id} name={m.away.name} acronym={m.away.short_name.slice(0, 3)} color={m.away.color} size={30} />
                        <span className="text-[14px] leading-tight font-medium">{m.away.name}</span>
                      </div>
                    </div>

                    <span className="flex w-[150px] shrink-0 items-center justify-end gap-1.5 text-[12px] text-muted transition-colors group-hover:text-text">
                      {m.stadium && <span className="truncate text-right leading-tight text-faint group-hover:text-muted">{m.stadium}</span>}
                      <ArrowRightIcon width={16} height={16} className="shrink-0" />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        <p className="mt-8 text-xs text-faint">
          Add another match with <code className="rounded bg-surface-3 px-1.5 py-0.5 font-mono">make data MATCH=&lt;id&gt;</code>. Nothing else changes.
        </p>
      </main>
    </div>
  );
}
