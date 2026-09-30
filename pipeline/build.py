"""Build a Touchline bundle from the four raw SkillCorner files.

Usage: python build.py <match_id> --raw <dir with raw files> --out <bundle dir>

Nothing here is specific to one match: colors, pitch size, rosters, period
frames and attacking directions are all read from the match file.
"""

from __future__ import annotations

import argparse
import gzip
import json
import math
import shutil
import sys
from pathlib import Path

import numpy as np
import pandas as pd

from bundle import (
    FORMAT_VERSION,
    SENTINEL,
    build_periods,
    frame_to_index,
    index_to_frame,
    periods_to_json,
    read_container,
    total_frames,
    unmirror,
    write_container,
)

FPS = 10.0  # SkillCorner open data is 10 Hz; stored in meta.json, never assumed by the app
CM = 100.0
DM = 10.0
CAM_CLAMP_M = 300.0
BALL_GAP_INTERP_FRAMES = 10  # interpolate ball gaps up to 1 s; longer gaps stay empty


def log(msg: str) -> None:
    print(msg, flush=True)


# --------------------------------------------------------------------------- match info


def load_match(raw: Path, mid: str) -> dict:
    return json.loads((raw / f"{mid}_match.json").read_text())


def build_roster(match: dict) -> list[dict]:
    """One slot per rostered player, home first, both sorted by shirt number."""
    home_id = match["home_team"]["id"]
    players = []
    for p in match["players"]:
        team = "home" if p["team_id"] == home_id else "away"
        pt = (p.get("playing_time") or {}).get("total") or {}
        role = p.get("player_role") or {}
        players.append(
            {
                "id": p["id"],
                "team": team,
                "number": p.get("number"),
                "name": f"{p.get('first_name', '')} {p.get('last_name', '')}".strip(),
                "short_name": p.get("short_name") or p.get("last_name") or str(p["id"]),
                "position": role.get("acronym") or "",
                "position_name": role.get("name") or "",
                "start_frame": pt.get("start_frame"),
                "end_frame": pt.get("end_frame"),
                "goals": p.get("goal", 0),
                "yellow": p.get("yellow_card", 0),
                "red": p.get("red_card", 0),
            }
        )
    players.sort(key=lambda p: (p["team"] != "home", p["number"] if p["number"] is not None else 999))
    for i, p in enumerate(players):
        p["slot"] = i
    return players


def team_meta(match: dict, side: str) -> dict:
    t = match[f"{side}_team"]
    kit = match.get(f"{side}_team_kit") or {}
    return {
        "id": t["id"],
        "name": t.get("name"),
        "short_name": t.get("short_name") or t.get("name"),
        "acronym": t.get("acronym") or (t.get("short_name") or "")[:3].upper(),
        "color": kit.get("jersey_color") or ("#2563eb" if side == "home" else "#dc2626"),
        "number_color": kit.get("number_color") or "#ffffff",
        "score": match.get(f"{side}_team_score"),
    }


# --------------------------------------------------------------------------- tracking


def pack_tracking(raw: Path, mid: str, periods, roster: list[dict]) -> tuple[dict[str, np.ndarray], dict]:
    n = total_frames(periods)
    n_slots = len(roster)
    slot_of = {p["id"]: p["slot"] for p in roster}

    pos = np.full((n, n_slots, 2), SENTINEL, dtype=np.int16)
    flags = np.zeros((n, n_slots), dtype=np.uint8)
    ball = np.full((n, 4), SENTINEL, dtype=np.int16)  # x, y, z (cm), detected
    frame = np.full((n, 3), -1, dtype=np.int32)  # orig frame, possession slot, possession group
    cam = np.full((n, 8), SENTINEL, dtype=np.int16)  # 4 corners (dm)
    has_players = np.zeros(n, dtype=bool)

    unknown_players: set[int] = set()
    seen = 0
    cam_keys = [
        "x_top_left", "y_top_left", "x_bottom_left", "y_bottom_left",
        "x_bottom_right", "y_bottom_right", "x_top_right", "y_top_right",
    ]
    clamp = CAM_CLAMP_M * DM

    path = raw / f"{mid}_tracking_extrapolated.jsonl"
    with open(path) as f:
        for line in f:
            d = json.loads(line)
            if d.get("period") is None:
                continue
            idx = frame_to_index(periods, d["frame"])
            if idx is None:
                continue
            seen += 1
            frame[idx, 0] = d["frame"]
            poss = d.get("possession") or {}
            grp = poss.get("group")
            frame[idx, 2] = 1 if grp == "home team" else 2 if grp == "away team" else 0
            pslot = slot_of.get(poss.get("player_id"))
            frame[idx, 1] = pslot if pslot is not None else -1

            b = d.get("ball_data") or {}
            if b.get("x") is not None and b.get("y") is not None:
                ball[idx, 0] = round(b["x"] * CM)
                ball[idx, 1] = round(b["y"] * CM)
                ball[idx, 2] = round((b.get("z") or 0.0) * CM)
                ball[idx, 3] = 1 if b.get("is_detected") else 0

            c = d.get("image_corners_projection") or {}
            if c.get("x_top_left") is not None:
                for k, key in enumerate(cam_keys):
                    v = c.get(key)
                    if v is None:
                        cam[idx, k] = SENTINEL
                    else:
                        cam[idx, k] = int(max(-clamp, min(clamp, round(v * DM))))

            pd_ = d.get("player_data") or []
            if pd_:
                has_players[idx] = True
            for p in pd_:
                s = slot_of.get(p["player_id"])
                if s is None:
                    unknown_players.add(p["player_id"])
                    continue
                if p.get("x") is None or p.get("y") is None:
                    continue
                pos[idx, s, 0] = round(p["x"] * CM)
                pos[idx, s, 1] = round(p["y"] * CM)
                flags[idx, s] = 1 | (2 if p.get("is_detected") else 0)

            if seen % 10000 == 0:
                log(f"  frames packed: {seen}/{n}")

    if unknown_players:
        log(f"  warning: {len(unknown_players)} player ids in tracking not in roster: {sorted(unknown_players)[:5]}")

    # Some match files declare an end_frame one past the last tracking line.
    # Fill the frame number arithmetically and treat those frames as gaps; only
    # fail if a meaningful share of the match is missing.
    missing_idx = np.flatnonzero(frame[:, 0] < 0)
    if len(missing_idx) > 0.01 * n:
        raise SystemExit(f"{len(missing_idx)} playback frames had no tracking line; period frames are not contiguous")
    for idx in missing_idx:
        frame[idx, 0] = index_to_frame(periods, int(idx))
    if len(missing_idx):
        log(f"  note: {len(missing_idx)} in-period frame(s) absent from tracking file, treated as gaps")

    # Ball: interpolate short gaps while players are on screen.
    interp = interpolate_ball(ball, has_players)

    # Gaps: runs of playback frames with no player data (broadcast cut away).
    gaps = runs(~has_players)

    stats = {
        "frames": n,
        "frames_with_players": int(has_players.sum()),
        "gaps": len(gaps),
        "ball_interpolated_frames": interp,
    }
    return {"pos": pos, "flags": flags, "ball": ball, "frame": frame, "cam": cam}, {"gaps": gaps, "stats": stats}


def interpolate_ball(ball: np.ndarray, has_players: np.ndarray) -> int:
    present = ball[:, 0] != SENTINEL
    filled = 0
    for a, b in runs(~present):
        length = b - a + 1
        if length > BALL_GAP_INTERP_FRAMES or a == 0 or b == len(ball) - 1:
            continue
        if not has_players[a : b + 1].all():
            continue
        p0, p1 = ball[a - 1, :3].astype(np.float64), ball[b + 1, :3].astype(np.float64)
        for k, i in enumerate(range(a, b + 1), start=1):
            t = k / (length + 1)
            ball[i, :3] = np.round(p0 + (p1 - p0) * t).astype(np.int16)
            ball[i, 3] = 0
        filled += length
    return filled


def runs(mask: np.ndarray) -> list[list[int]]:
    """Inclusive [start, end] index pairs for each run of True."""
    out = []
    start = None
    for i, v in enumerate(mask):
        if v and start is None:
            start = i
        elif not v and start is not None:
            out.append([start, i - 1])
            start = None
    if start is not None:
        out.append([start, len(mask) - 1])
    return out


# --------------------------------------------------------------------------- events


def num(v):
    if v is None or (isinstance(v, float) and math.isnan(v)):
        return None
    return v


def flag(v) -> bool:
    return str(v).strip().lower() == "true"


def convert_events(raw: Path, mid: str, periods) -> list[dict]:
    df = pd.read_csv(raw / f"{mid}_dynamic_events.csv", low_memory=False)
    out = []
    for r in df.itertuples(index=False):
        i0 = frame_to_index(periods, int(r.frame_start))
        i1 = frame_to_index(periods, int(r.frame_end))
        if i0 is None or i1 is None:
            continue
        side = r.attacking_side
        x0, y0 = unmirror(num(r.x_start) or 0.0, num(r.y_start) or 0.0, side)
        x1, y1 = unmirror(num(r.x_end) or 0.0, num(r.y_end) or 0.0, side)
        e = {
            "id": str(r.event_id),
            "type": r.event_type,
            "sub": num(r.event_subtype),
            "i0": i0,
            "i1": i1,
            "f0": int(r.frame_start),
            "f1": int(r.frame_end),
            "period": int(r.period),
            "pid": int(r.player_id) if num(r.player_id) is not None else None,
            "name": num(r.player_name),
            "tid": int(r.team_id) if num(r.team_id) is not None else None,
            "x0": round(x0, 2),
            "y0": round(y0, 2),
            "x1": round(x1, 2),
            "y1": round(y1, 2),
            "end": num(r.end_type),
            "shot": flag(r.lead_to_shot),
            "goal": flag(r.lead_to_goal),
        }
        pip = num(getattr(r, "player_in_possession_id", None))
        if pip is not None:
            e["pip"] = int(pip)
        tgt = num(getattr(r, "player_targeted_id", None))
        if tgt is not None:
            e["target"] = int(tgt)
        xt = num(getattr(r, "xthreat", None))
        if xt is not None:
            e["xthreat"] = round(float(xt), 3)
        if flag(getattr(r, "dangerous", False)):
            e["dangerous"] = True
        pc = num(getattr(r, "pressing_chain", None))
        if pc is not None and flag(pc):
            e["pressing_chain"] = True
        out.append(e)
    return out


def convert_phases(raw: Path, mid: str, periods) -> list[dict]:
    df = pd.read_csv(raw / f"{mid}_phases_of_play.csv", low_memory=False)
    out = []
    for r in df.itertuples(index=False):
        i0 = frame_to_index(periods, int(r.frame_start))
        i1 = frame_to_index(periods, int(r.frame_end))
        if i0 is None or i1 is None:
            continue
        x0, y0 = unmirror(num(r.x_start) or 0.0, num(r.y_start) or 0.0, r.attacking_side)
        x1, y1 = unmirror(num(r.x_end) or 0.0, num(r.y_end) or 0.0, r.attacking_side)
        out.append(
            {
                "i": int(r.index),
                "i0": i0,
                "i1": i1,
                "f0": int(r.frame_start),
                "f1": int(r.frame_end),
                "period": int(r.period),
                "tid": int(r.team_in_possession_id),
                "type": r.team_in_possession_phase_type,
                "out_type": num(r.team_out_of_possession_phase_type),
                "shot": flag(r.team_possession_lead_to_shot),
                "goal": flag(r.team_possession_lead_to_goal),
                "x0": round(x0, 2),
                "y0": round(y0, 2),
                "x1": round(x1, 2),
                "y1": round(y1, 2),
            }
        )
    return out


# --------------------------------------------------------------------------- checks


def validate(arrays: dict[str, np.ndarray], meta: dict) -> list[str]:
    problems = []
    pos = arrays["pos"]
    flags = arrays["flags"]
    L, W = meta["pitch"]["length"], meta["pitch"]["width"]
    margin = 8.0 * CM
    present = flags & 1 == 1
    xs = pos[..., 0][present]
    ys = pos[..., 1][present]
    if xs.size:
        bad = ((np.abs(xs) > L / 2 * CM + margin) | (np.abs(ys) > W / 2 * CM + margin)).sum()
        if bad:
            problems.append(f"{bad} player positions fall outside the pitch + {margin / CM:.0f} m margin")
    home_slots = np.array([p["team"] == "home" for p in meta["players"]])
    per_home = present[:, home_slots].sum(axis=1)
    per_away = present[:, ~home_slots].sum(axis=1)
    over = int(((per_home > 11) | (per_away > 11)).sum())
    if over:
        problems.append(f"{over} frames have more than 11 players for one team")
    for p in meta["periods"]:
        if p["n_frames"] != p["end_frame"] - p["start_frame"] + 1:
            problems.append(f"period {p['period']} frame count mismatch")
    return problems


# --------------------------------------------------------------------------- preview


def build_preview(arrays: dict[str, np.ndarray], meta: dict, goals: list[dict], shots: list[dict]) -> dict:
    """One self-contained frame (just before the first goal, else first shot,
    else mid-match) so a landing page can draw a real moment without loading
    the whole bundle."""
    pos, flags, ball = arrays["pos"], arrays["flags"], arrays["ball"]
    n = pos.shape[0]
    candidates = [g["i"] - 12 for g in goals] + [s["i"] - 12 for s in shots] + [n // 2]
    idx = next((i for i in candidates if 0 <= i < n and (flags[i] & 1).any() and ball[i, 0] != SENTINEL), 0)
    players = []
    for p in meta["players"]:
        s = p["slot"]
        if not flags[idx, s] & 1:
            continue
        players.append(
            {
                "team": p["team"],
                "number": p["number"],
                "x": round(float(pos[idx, s, 0]) / CM, 2),
                "y": round(float(pos[idx, s, 1]) / CM, 2),
                "detected": bool(flags[idx, s] & 2),
            }
        )
    b = None
    if ball[idx, 0] != SENTINEL:
        b = {"x": round(float(ball[idx, 0]) / CM, 2), "y": round(float(ball[idx, 1]) / CM, 2)}
    period = next(p for p in meta["periods"] if p["start_index"] <= idx <= p["end_index"])
    secs = period["clock_offset_s"] + (idx - period["start_index"]) / meta["fps"]
    return {
        "index": int(idx),
        "clock": f"{int(secs // 60)}:{int(secs % 60):02d}",
        "pitch": meta["pitch"],
        "home": {"color": meta["home"]["color"], "number_color": meta["home"]["number_color"], "short_name": meta["home"]["short_name"], "score": meta["home"]["score"]},
        "away": {"color": meta["away"]["color"], "number_color": meta["away"]["number_color"], "short_name": meta["away"]["short_name"], "score": meta["away"]["score"]},
        "players": players,
        "ball": b,
    }


# --------------------------------------------------------------------------- index


def write_index(data_dir: Path) -> None:
    """List every bundle in the data folder so the app can offer a match picker."""
    matches = []
    for meta_path in sorted(data_dir.glob("*/meta.json")):
        m = json.loads(meta_path.read_text())
        matches.append(
            {
                "match_id": m["match_id"],
                "date": m.get("date"),
                "competition": m.get("competition"),
                "home": {"name": m["home"]["name"], "short_name": m["home"]["short_name"], "score": m["home"]["score"], "color": m["home"]["color"]},
                "away": {"name": m["away"]["name"], "short_name": m["away"]["short_name"], "score": m["away"]["score"], "color": m["away"]["color"]},
            }
        )
    (data_dir / "index.json").write_text(json.dumps({"matches": matches}, separators=(",", ":")))


# --------------------------------------------------------------------------- main


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("match_id")
    ap.add_argument("--raw", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    mid = args.match_id
    raw = Path(args.raw)
    out = Path(args.out)
    for suffix in ("match.json", "tracking_extrapolated.jsonl", "dynamic_events.csv", "phases_of_play.csv"):
        if not (raw / f"{mid}_{suffix}").exists():
            print(f"missing raw file: {raw / f'{mid}_{suffix}'}  (run `make fetch MATCH={mid}` first)", file=sys.stderr)
            return 1

    log(f"Building bundle for match {mid}")
    match = load_match(raw, mid)
    periods = build_periods(match["match_periods"])
    roster = build_roster(match)
    home, away = team_meta(match, "home"), team_meta(match, "away")

    log("  packing tracking...")
    arrays, extra = pack_tracking(raw, mid, periods, roster)
    log("  converting events...")
    events = convert_events(raw, mid, periods)
    phases = convert_phases(raw, mid, periods)

    goals = [
        {"i": e["i1"], "pid": e["pid"], "name": e["name"], "tid": e["tid"], "period": e["period"]}
        for e in events
        if e["type"] == "player_possession" and e["end"] == "shot" and e["goal"]
    ]
    shots = [
        {"i": e["i1"], "pid": e["pid"], "name": e["name"], "tid": e["tid"], "period": e["period"], "goal": e["goal"]}
        for e in events
        if e["type"] == "player_possession" and e["end"] == "shot"
    ]

    comp = match.get("competition_edition") or {}
    meta = {
        "format": FORMAT_VERSION,
        "match_id": int(mid),
        "fps": FPS,
        "date": match.get("date_time"),
        "competition": (comp.get("competition") or {}).get("name"),
        "season": (comp.get("season") or {}).get("name"),
        "stadium": (match.get("stadium") or {}).get("name"),
        "pitch": {"length": match.get("pitch_length") or 105, "width": match.get("pitch_width") or 68},
        "home": {**home, "sides": match.get("home_team_side") or []},
        "away": {**away},
        "players": roster,
        "periods": periods_to_json(periods),
        "n_frames": total_frames(periods),
        "gaps": extra["gaps"],
        "goals": goals,
        "shots": shots,
        "credit": "Tracking data: SkillCorner open data (MIT), https://github.com/SkillCorner/opendata",
    }
    # Away attacking sides are the mirror of home.
    meta["away"]["sides"] = [
        "left_to_right" if s == "right_to_left" else "right_to_left" for s in meta["home"]["sides"]
    ]

    problems = validate(arrays, meta)
    for p in problems:
        log(f"  warning: {p}")

    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)
    bin_path = out / "tracking.bin"
    write_container(str(bin_path), arrays, {"fps": FPS, "n_slots": len(roster)})
    with open(bin_path, "rb") as src, gzip.open(out / "tracking.bin.gz", "wb", compresslevel=9) as dst:
        shutil.copyfileobj(src, dst)
    raw_size = bin_path.stat().st_size
    bin_path.unlink()
    (out / "meta.json").write_text(json.dumps(meta, separators=(",", ":")))
    (out / "events.json").write_text(json.dumps({"events": events, "phases": phases}, separators=(",", ":")))

    (out / "preview.json").write_text(json.dumps(build_preview(arrays, meta, goals, shots), separators=(",", ":")))
    write_index(out.parent)

    gz_size = (out / "tracking.bin.gz").stat().st_size
    st = extra["stats"]
    log("")
    log(f"  {home['name']} {home['score']} - {away['score']} {away['name']}")
    log(f"  pitch {meta['pitch']['length']} x {meta['pitch']['width']} m, {len(roster)} players, {len(periods)} periods")
    log(f"  playback frames {st['frames']} ({st['frames'] / FPS / 60:.1f} min), with tracking {st['frames_with_players']} ({100 * st['frames_with_players'] / st['frames']:.0f}%), gaps {st['gaps']}")
    log(f"  ball frames interpolated {st['ball_interpolated_frames']}, events {len(events)}, phases {len(phases)}, shots {len(shots)}, goals {len(goals)}")
    log(f"  tracking.bin {raw_size / 1e6:.1f} MB -> gz {gz_size / 1e6:.1f} MB, events.json {(out / 'events.json').stat().st_size / 1e6:.1f} MB")
    log(f"  wrote {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
