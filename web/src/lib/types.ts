export type TeamSide = "home" | "away";

export interface TeamMeta {
  id: number;
  name: string;
  short_name: string;
  acronym: string;
  color: string;
  number_color: string;
  score: number | null;
  sides: ("left_to_right" | "right_to_left")[];
}

export interface PlayerMeta {
  slot: number;
  id: number;
  team: TeamSide;
  number: number | null;
  name: string;
  short_name: string;
  position: string;
  position_name: string;
  start_frame: number | null;
  end_frame: number | null;
  goals: number;
  yellow: number;
  red: number;
}

export interface PeriodMeta {
  period: number;
  start_frame: number;
  end_frame: number;
  start_index: number;
  end_index: number;
  n_frames: number;
  clock_offset_s: number;
}

export interface GoalMeta {
  i: number;
  pid: number | null;
  name: string | null;
  tid: number | null;
  period: number;
  goal?: boolean;
}

export interface MatchMeta {
  format: number;
  match_id: number;
  fps: number;
  date: string | null;
  competition: string | null;
  season: string | null;
  stadium: string | null;
  pitch: { length: number; width: number };
  home: TeamMeta;
  away: TeamMeta;
  players: PlayerMeta[];
  periods: PeriodMeta[];
  n_frames: number;
  gaps: [number, number][];
  goals: GoalMeta[];
  shots: GoalMeta[];
  credit: string;
}

export interface MatchEvent {
  id: string;
  type: "player_possession" | "passing_option" | "off_ball_run" | "on_ball_engagement";
  sub: string | null;
  i0: number;
  i1: number;
  f0: number;
  f1: number;
  period: number;
  pid: number | null;
  name: string | null;
  tid: number | null;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  end: string | null;
  shot: boolean;
  goal: boolean;
  pip?: number;
  target?: number;
  xthreat?: number;
  dangerous?: boolean;
  pressing_chain?: boolean;
}

export interface Phase {
  i: number;
  i0: number;
  i1: number;
  f0: number;
  f1: number;
  period: number;
  tid: number;
  type: string;
  out_type: string | null;
  shot: boolean;
  goal: boolean;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface MatchIndexTeam {
  id: number;
  name: string;
  short_name: string;
  score: number | null;
  color: string;
}

export interface MatchIndexEntry {
  match_id: number;
  date: string | null;
  competition: string | null;
  stadium?: string | null;
  home: MatchIndexTeam;
  away: MatchIndexTeam;
}

/** Everything the editor needs for one match, held in memory. */
export interface MatchData {
  meta: MatchMeta;
  events: MatchEvent[];
  phases: Phase[];
  nSlots: number;
  /** [n_frames, n_slots, 2] int16 centimetres, SENTINEL when absent */
  pos: Int16Array;
  /** [n_frames, n_slots] bit0 present, bit1 detected */
  flags: Uint8Array;
  /** [n_frames, 4] x y z (cm) + detected flag */
  ball: Int16Array;
  /** [n_frames, 3] original frame, possession slot, possession group */
  frame: Int32Array;
  /** [n_frames, 8] camera corners in decimetres */
  cam: Int16Array;
  /** true when a playback index has player data */
  hasPlayers: Uint8Array;
}

export const SENTINEL = -32768;
