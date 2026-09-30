/**
 * Landing page content. Edit this file only: names, GitHub handles, video link.
 */
export const site = {
  name: "Touchline",
  tagline: "Clip tracking data like video.",
  description:
    "Touchline plays a full match of SkillCorner tracking data on a 2D pitch. Scrub it like YouTube, cut any moment into a 10-second clip, tag it, and share it with one link. Built for the US Soccer x GSU ColorStack Tech League.",
  /** Full URL of the deployed site. Used for share links and metadata. */
  url: "https://touchline.vercel.app",
  /** YouTube link or ID of the tutorial. Leave empty to hide the video block. */
  tutorialVideo: "",
  /** Default match to open from the "Open the app" button. */
  defaultMatch: "2006229",
  team: [
    { name: "Amani Bobo", github: "amanibobo", role: "" },
    { name: "Teammate 2", github: "", role: "" },
    { name: "Teammate 3", github: "", role: "" },
    { name: "Teammate 4", github: "", role: "" },
    { name: "Teammate 5", github: "", role: "" },
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
