/**
 * Landing page content. Edit this file only: names, GitHub handles, video link.
 */
export const site = {
  name: "larpers",
  tagline: "Clip tracking data like video.",
  description:
    "larpers plays a full match of SkillCorner tracking data on a 2D pitch. Scrub it like YouTube, cut any moment into a 10-second clip, tag it, and share it with one link. Built for the US Soccer x GSU ColorStack Tech League.",
  /** Full URL of the deployed site. Used for share links and metadata. */
  url: "https://larpers-drab.vercel.app",
  /** Direct MP4 of the tutorial, shown in the hero box on the landing page. */
  heroVideo: "https://e8lo91gxtp.ufs.sh/f/wTLW5tuvHS7N4UYaIHsLHJYzS5kVqBlC6MydXwFf48ZKrpW7",
  /** YouTube link or ID of the tutorial (optional alternative). */
  tutorialVideo: "",
  /** Default match to open from the "Open the app" button. */
  defaultMatch: "2006229",
  team: [
    { name: "Amani Bobo", github: "amanibobo", role: "" },
    { name: "Jeremiah", github: "jeremiah-brea23", role: "" },
    { name: "Emanuel", github: "EmanRomani", role: "" },
    { name: "Austin", github: "Final-Eclipse", role: "" },
  ],
  repo: "https://github.com/amanibobo/us-soccer",
  dataCredit: { name: "SkillCorner open data", url: "https://github.com/SkillCorner/opendata" },
};

/** Accepts a full YouTube URL, a share URL or a bare video id. */
export function youtubeEmbedUrl(input: string): string | null {
  if (!input) return null;
  const m = input.match(/(?:youtu\.be\/|v=|\/embed\/|\/shorts\/)([\w-]{6,})/);
  const id = m ? m[1] : /^[\w-]{6,}$/.test(input) ? input : null;
  return id ? `https://www.youtube-nocookie.com/embed/${id}?rel=0` : null;
}
