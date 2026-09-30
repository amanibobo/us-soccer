import Link from "next/link";
import { site } from "@/config/site";
import { BallLogo } from "@/components/BallLogo";
import { ZoomImage } from "@/components/ZoomImage";
import { GithubIcon, PlayIcon } from "@/components/icons";

export default async function Landing() {
  const team = site.team.filter((t) => t.name);
  const appHref = "/matches";

  return (
    <div className="theme-dark min-h-screen bg-bg text-text">
      {/* keep overscroll dark on this page only */}
      <style>{`html, body { background: #0d0d0e; }`}</style>
      <div className="mx-auto w-full max-w-2xl px-6">
        {/* header */}
        <header className="flex items-center justify-between py-6">
          <Link href="/" className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
            <BallLogo size={20} />
            {site.name}
          </Link>
          <nav className="flex items-center gap-4 text-sm text-muted">
            <a href={site.repo} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 hover:text-text">
              <GithubIcon width={15} height={15} /> View the code
            </a>
            <Link href={appHref} className="pill pill-primary">
              <PlayIcon width={14} height={14} /> Open the app
            </Link>
          </nav>
        </header>

        {/* hero */}
        <div className="fade-up w-full overflow-hidden rounded-2xl border border-white/10 bg-[#161618] shadow-2xl shadow-black/40">
          {site.heroVideo ? (
            <video src={site.heroVideo} controls playsInline preload="metadata" className="block w-full bg-black" style={{ aspectRatio: "1660 / 1080" }} aria-label={`${site.name} tutorial video`} />
          ) : (
            <div className="aspect-[16/10] w-full" />
          )}
        </div>

        {/* letter */}
        <section className="mt-10 space-y-4 text-[15px] leading-relaxed text-muted">
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
        </section>

        {/* architecture */}
        <div className="mt-10 mb-16 overflow-hidden rounded-2xl border border-white/10 bg-[#161618] lg:-mx-40">
          <ZoomImage
            src="/architecture-dark.png"
            fullSrc="/architecture.png"
            alt="Architecture: SkillCorner files go through a Python pipeline into a compact bundle, which the Next.js app loads once and renders on a canvas; clips are encoded in their links."
          />
        </div>

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


