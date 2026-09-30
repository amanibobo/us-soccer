import Link from "next/link";
import { site, youtubeEmbedUrl } from "@/config/site";
import { loadMatchIndexServer, loadPreviewServer } from "@/lib/matches-server";
import { HeroPreview } from "@/components/HeroPreview";
import { ArrowRightIcon, GithubIcon, PlayIcon } from "@/components/icons";

export default async function Landing() {
  const [matches, preview] = await Promise.all([loadMatchIndexServer(), loadPreviewServer(site.defaultMatch)]);
  const video = youtubeEmbedUrl(site.tutorialVideo);
  const team = site.team.filter((t) => t.name);
  const appHref = `/match/${site.defaultMatch}`;

  return (
    <div className="theme-dark min-h-screen bg-bg text-text">
      <div className="mx-auto w-full max-w-3xl px-6">
        {/* header */}
        <header className="flex items-center justify-between py-8">
          <Link href="/" className="flex items-center gap-2.5 text-lg font-semibold tracking-tight">
            <Logo />
            {site.name}
          </Link>
          <nav className="flex items-center gap-5 text-[15px] text-muted">
            <a href="#tutorial" className="hover:text-text">
              Tutorial
            </a>
            <Link href={appHref} className="pill pill-primary">
              <PlayIcon width={14} height={14} /> Open the app
            </Link>
          </nav>
        </header>

        {/* hero */}
        <div className="fade-up overflow-hidden rounded-2xl border border-white/10 bg-[#161618] shadow-2xl shadow-black/40">
          <HeroPreview frame={preview} />
        </div>

        {/* letter */}
        <section className="mt-14 space-y-6 text-[19px] leading-relaxed text-muted">
          <p className="font-medium text-text">{site.tagline}</p>
          <p>Hi there,</p>
          <p>
            We are{" "}
            {team.map((t, i) => (
              <span key={t.name}>
                {i > 0 && (i === team.length - 1 ? " and " : ", ")}
                <PersonLink name={t.name.split(" ")[0]} github={t.github} />
              </span>
            ))}
            . We built {site.name} for the US Soccer x GSU ColorStack Tech League.
          </p>
          <p>
            Video shows what the camera followed. Tracking data shows all 22 players, ten times a second, for the whole match. Analysts clip and tag video every
            day, but tracking data has been stuck in notebooks and spreadsheets.
          </p>
          <p>
            {site.name} plays a match of SkillCorner tracking data on a 2D pitch. You scrub it like a YouTube video, press <b className="text-text">Start clip</b>{" "}
            and <b className="text-text">End clip</b> around any moment up to ten seconds, give it a title and tags, and share it with one link. A coach opens
            the link and it just plays.
          </p>
          <p>
            One more thing, on purpose: any SkillCorner match loads by changing a single match ID. No code changes. The tool is about the data format, not
            one game.
          </p>
          <p>That&apos;s all. We hope you like it.</p>
        </section>

        {/* buttons */}
        <div className="mt-10 flex flex-wrap gap-3">
          <Link href={appHref} className="pill pill-primary text-base">
            <PlayIcon width={16} height={16} /> Open the app
          </Link>
          <a href={site.repo} target="_blank" rel="noreferrer" className="pill text-base">
            <GithubIcon width={16} height={16} /> View the code
          </a>
        </div>

        {/* tutorial */}
        <section id="tutorial" className="mt-20 scroll-mt-8">
          <h2 className="text-[19px] font-medium text-text">How to use it</h2>
          <p className="mt-1 text-[15px] text-muted">A short walkthrough for first-time users.</p>
          <div className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-[#161618]">
            {video ? (
              <iframe
                src={video}
                title={`${site.name} tutorial`}
                className="aspect-video w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <div className="flex aspect-video w-full items-center justify-center text-sm text-muted">Tutorial video coming soon</div>
            )}
          </div>
        </section>

        {/* team */}
        <section id="team" className="mt-20 scroll-mt-8">
          <h2 className="text-[19px] font-medium text-text">The team</h2>
          <ul className="mt-5 divide-y divide-white/10 border-y border-white/10">
            {team.map((t) => (
              <li key={t.name}>
                <a
                  href={t.github ? `https://github.com/${t.github}` : "#"}
                  target={t.github ? "_blank" : undefined}
                  rel="noreferrer"
                  className="flex items-center gap-4 py-3.5 text-[15px] transition-colors hover:text-text"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-xs font-semibold">{initials(t.name)}</span>
                  <span className="font-medium text-text">{t.name}</span>
                  {t.role && <span className="text-muted">{t.role}</span>}
                  <span className="ml-auto inline-flex items-center gap-1.5 text-muted">
                    <GithubIcon width={15} height={15} /> {t.github ? `@${t.github}` : "GitHub"}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>

        {/* matches */}
        {matches.length > 0 && (
          <section className="mt-20">
            <h2 className="text-[19px] font-medium text-text">Matches loaded</h2>
            <ul className="mt-5 divide-y divide-white/10 border-y border-white/10">
              {matches.map((m) => (
                <li key={m.match_id}>
                  <Link href={`/match/${m.match_id}`} className="flex items-center gap-4 py-3.5 text-[15px] text-muted transition-colors hover:text-text">
                    <span className="flex gap-1">
                      <span className="h-3.5 w-3.5 rounded-full border border-white/20" style={{ background: m.home.color }} />
                      <span className="h-3.5 w-3.5 rounded-full border border-white/20" style={{ background: m.away.color }} />
                    </span>
                    <span className="text-text">
                      {m.home.short_name}{" "}
                      <span className="font-mono">
                        {m.home.score} - {m.away.score}
                      </span>{" "}
                      {m.away.short_name}
                    </span>
                    <span className="ml-auto text-sm">{m.date ? new Date(m.date).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" }) : ""}</span>
                    <ArrowRightIcon width={16} height={16} />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <footer className="mt-20 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 py-8 text-sm text-muted">
          <span>
            Tracking data by{" "}
            <a href={site.dataCredit.url} target="_blank" rel="noreferrer" className="underline decoration-white/30 underline-offset-4 hover:text-text">
              {site.dataCredit.name}
            </a>
            , MIT licensed.
          </span>
          <span>{site.name}</span>
        </footer>
      </div>
    </div>
  );
}

function PersonLink({ name, github }: { name: string; github: string }) {
  if (!github) return <span className="text-text">{name}</span>;
  return (
    <a href={`https://github.com/${github}`} target="_blank" rel="noreferrer" className="text-text underline decoration-white/40 underline-offset-4 hover:decoration-white">
      {name}
    </a>
  );
}

function Logo() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden>
      <rect x="1.5" y="4" width="23" height="18" rx="3" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M13 4v18" stroke="currentColor" strokeWidth="2" />
      <circle cx="13" cy="13" r="3.5" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
