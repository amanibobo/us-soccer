"""Tracking data scrubber + clipper for SkillCorner open data."""
import csv
import json
import os
import sys
import threading
import uuid
from pathlib import Path

from flask import Flask, abort, jsonify, request, send_from_directory

BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "data"
STATIC_DIR = BASE_DIR / "static"
CLIPS_FILE = BASE_DIR / "clips.json"
FPS = 10
MAX_CLIP_SECONDS = 10
CHUNK_SIZE = 600  # frames per /api/frames request (1 minute at 10 FPS)


def find_match_id():
    if len(sys.argv) > 1:
        return sys.argv[1]
    if os.environ.get("MATCH_ID"):
        return os.environ["MATCH_ID"]
    matches = sorted(p.name for p in DATA_DIR.glob("*") if p.is_dir())
    if not matches:
        sys.exit("No match found in data/. Run: python download_data.py <match_id>")
    return matches[0]


def load_match(match_id):
    match_dir = DATA_DIR / match_id
    with open(match_dir / f"{match_id}_match.json", encoding="utf-8") as f:
        match = json.load(f)

    home_id = match["home_team"]["id"]
    players = {
        p["id"]: {
            "number": p["number"],
            "name": p["short_name"],
            "team": "home" if p["team_id"] == home_id else "away",
        }
        for p in match["players"]
    }

    # Each frame is stored as a compact JSON string:
    # [timestamp, period, ball_xy, [[player_id, x, y], ...]]
    empty = json.dumps([None, None, None, []])
    frames = []
    with open(match_dir / f"{match_id}_tracking_extrapolated.jsonl", encoding="utf-8") as f:
        for line in f:
            row = json.loads(line)
            ball = row["ball_data"]
            ball_xy = [ball["x"], ball["y"]] if ball["x"] is not None else None
            people = [[p["player_id"], p["x"], p["y"]] for p in row["player_data"]]
            frame = [row["timestamp"], row["period"], ball_xy, people]
            while len(frames) < row["frame"]:  # fill any gaps so list index == frame number
                frames.append(empty)
            frames.append(json.dumps(frame, separators=(",", ":")))

    meta = {
        "match_id": match_id,
        "title": f'{match["home_team"]["short_name"]} {match["home_team_score"]} - '
                 f'{match["away_team_score"]} {match["away_team"]["short_name"]}',
        "pitch_length": match["pitch_length"],
        "pitch_width": match["pitch_width"],
        "home_color": match["home_team_kit"]["jersey_color"],
        "home_number_color": match["home_team_kit"]["number_color"],
        "away_color": match["away_team_kit"]["jersey_color"],
        "away_number_color": match["away_team_kit"]["number_color"],
        "players": players,
        "num_frames": len(frames),
        "fps": FPS,
        "chunk_size": CHUNK_SIZE,
        "max_clip_frames": MAX_CLIP_SECONDS * FPS,
        "events": load_events(match_dir / f"{match_id}_dynamic_events.csv"),
    }
    return meta, frames


def load_events(path):
    """Pick the key moments out of SkillCorner's dynamic events for the timeline.

    Returns a list of {"frame", "type", "label"}, where type is one of
    shot, goal, won (press won the ball back), lost (possession lost) or run
    (dangerous off-ball run). Returns [] if the match has no events file.
    """
    if not path.exists():
        return []
    events = []
    regains = {}  # a pressing chain lists every presser; keep one marker per regain
    with open(path, encoding="utf-8") as f:
        for row in csv.DictReader(f):
            kind, subtype = row["event_type"], row["event_subtype"]
            who = f'{row["player_name"]} ({row["team_shortname"]})'
            time = row["time_start"].split(".")[0]
            if kind == "player_possession" and row["end_type"] == "shot":
                goal = row["game_interruption_after"] == "goal_for"
                events.append({"frame": int(row["frame_end"]), "type": "goal" if goal else "shot",
                               "label": f'{"Goal" if goal else "Shot"} · {time} · {who}'})
            elif kind == "player_possession" and row["end_type"] == "possession_loss":
                events.append({"frame": int(row["frame_end"]), "type": "lost",
                               "label": f"Ball lost · {time} · {who}"})
            elif kind == "off_ball_run" and row["dangerous"] == "True":
                run = subtype.replace("_", " ")
                events.append({"frame": int(row["frame_start"]), "type": "run",
                               "label": f"Dangerous run ({run}) · {time} · {who}"})
            elif kind == "on_ball_engagement" and row["pressing_chain_end_type"] == "regain":
                frame = int(row["frame_end"])
                # Prefer the presser who actually won the ball
                if frame not in regains or row["end_type"].endswith("regain"):
                    regains[frame] = {"frame": frame, "type": "won",
                                      "label": f"Ball won by press · {time} · {who}"}
    events.extend(regains.values())
    return sorted(events, key=lambda e: e["frame"])


clips_lock = threading.Lock()


def read_clips():
    if not CLIPS_FILE.exists():
        return []
    with open(CLIPS_FILE, encoding="utf-8") as f:
        return json.load(f)


def write_clips(clips):
    with open(CLIPS_FILE, "w", encoding="utf-8") as f:
        json.dump(clips, f, indent=2)


app = Flask(__name__, static_folder=STATIC_DIR)
MATCH_ID = find_match_id()
print(f"Loading match {MATCH_ID}...")
META, FRAMES = load_match(MATCH_ID)
print(f"Loaded {len(FRAMES)} frames.")


@app.get("/")
def index():
    return send_from_directory(STATIC_DIR, "index.html")


@app.get("/api/match")
def get_match():
    return jsonify(META)


@app.get("/api/frames")
def get_frames():
    start = request.args.get("start", 0, type=int)
    start = max(0, min(start, len(FRAMES)))
    body = '{"start":%d,"frames":[%s]}' % (start, ",".join(FRAMES[start:start + CHUNK_SIZE]))
    return app.response_class(body, mimetype="application/json")


@app.get("/api/clips")
def list_clips():
    with clips_lock:
        clips = [c for c in read_clips() if c["match_id"] == MATCH_ID]
    return jsonify(clips)


@app.post("/api/clips")
def create_clip():
    body = request.get_json(force=True)
    try:
        start, end = int(body["start"]), int(body["end"])
    except (KeyError, TypeError, ValueError):
        abort(400, "start and end are required")
    if not (0 <= start < end < len(FRAMES)) or end - start > META["max_clip_frames"]:
        abort(400, f"Clip must be between 0 and {MAX_CLIP_SECONDS} seconds long")
    clip = {
        "id": uuid.uuid4().hex[:8],
        "match_id": MATCH_ID,
        "name": (body.get("name") or "").strip()[:100] or "Untitled clip",
        "start": start,
        "end": end,
    }
    with clips_lock:
        clips = read_clips()
        clips.append(clip)
        write_clips(clips)
    return jsonify(clip), 201


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))
