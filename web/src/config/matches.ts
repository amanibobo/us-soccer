/**
 * Optional extras per team and per match that are not in the SkillCorner data.
 * Everything here is optional: a team without a logo gets a monogram badge and a
 * match without links simply shows no link.
 *
 * Crests are the clubs' own marks, used here only to identify the teams.
 */

/** SkillCorner team id -> crest image in /public/logos */
const TEAM_LOGOS: Record<number, string> = {
  2380: "/logos/2380.png", // Melbourne City FC
  1804: "/logos/1804.png", // Macarthur FC
  868: "/logos/868.png", // Melbourne Victory FC
  4177: "/logos/4177.png", // Auckland FC
};

export function teamLogo(teamId: number): string | null {
  return TEAM_LOGOS[teamId] ?? null;
}

export interface MatchLinks {
  /** Official highlights video (YouTube watch URL). */
  highlights?: string;
  /** Match report or match centre page. */
  report?: string;
}

/** SkillCorner match id -> external links */
const MATCH_LINKS: Record<number, MatchLinks> = {
  2006229: {
    highlights: "https://www.youtube.com/watch?v=3qfT9jBfdZQ",
    report: "https://aleagues.com.au/news/melbourne-city-macarthur-fc-max-caputo-match-report-goals-highlights-video-aleague-men-round-22/",
  },
  2017461: {
    highlights: "https://www.youtube.com/watch?v=xgAaEqw_SK4",
    report: "https://aleagues.com.au/news/melbourne-victory-auckland-fc-rogerson-goal-semi-final-leg-one-highlights-video/",
  },
};

export function matchLinks(matchId: number): MatchLinks {
  return MATCH_LINKS[matchId] ?? {};
}
