"""Generate docs/architecture.excalidraw: how larpers is built and how data flows.

Run: python docs/architecture.py
Then open the file at https://excalidraw.com (File > Open) to edit, or render it
with docs/render_architecture.js.
"""

from __future__ import annotations

import base64
import json
import random
import time
from pathlib import Path

HERE = Path(__file__).parent
LOGOS = HERE / "logos"
random.seed(7)

INK = "#1e1e1e"
MUTED = "#6b6b6b"
FONT_HAND = 5  # Excalifont
FONT_MONO = 3

elements: list[dict] = []
files: dict[str, dict] = {}
NOW = int(time.time() * 1000)


def _id() -> str:
    return "".join(random.choice("abcdefghijklmnopqrstuvwxyz0123456789") for _ in range(16))


def base(kind: str, x: float, y: float, w: float, h: float, **kw) -> dict:
    e = {
        "id": _id(),
        "type": kind,
        "x": x,
        "y": y,
        "width": w,
        "height": h,
        "angle": 0,
        "strokeColor": INK,
        "backgroundColor": "transparent",
        "fillStyle": "solid",
        "strokeWidth": 2,
        "strokeStyle": "solid",
        "roughness": 1,
        "opacity": 100,
        "groupIds": [],
        "frameId": None,
        "index": None,
        "roundness": None,
        "seed": random.randint(1, 2**31),
        "version": 1,
        "versionNonce": random.randint(1, 2**31),
        "isDeleted": False,
        "boundElements": [],
        "updated": NOW,
        "link": None,
        "locked": False,
    }
    e.update(kw)
    elements.append(e)
    return e


def text(x, y, s, size=16, color=INK, align="left", font=FONT_HAND, width=None) -> dict:
    lines = s.split("\n")
    w = width or max(len(line) for line in lines) * size * 0.55
    h = len(lines) * size * 1.25
    return base(
        "text", x, y, w, h,
        text=s, originalText=s, fontSize=size, fontFamily=font, textAlign=align, verticalAlign="top",
        strokeColor=color, lineHeight=1.25, autoResize=True, containerId=None,
    )


def box(x, y, w, h, label, fill="#ffffff", stroke=INK, size=16, dashed=False, radius=True) -> dict:
    r = base(
        "rectangle", x, y, w, h,
        backgroundColor=fill, strokeColor=stroke, strokeStyle="dashed" if dashed else "solid",
        roundness={"type": 3} if radius else None,
    )
    if label:
        t = base(
            "text", x + 8, y + h / 2 - size * 0.7, w - 16, size * 1.25 * (label.count("\n") + 1),
            text=label, originalText=label, fontSize=size, fontFamily=FONT_HAND, textAlign="center",
            verticalAlign="middle", strokeColor=stroke, lineHeight=1.25, autoResize=False, containerId=r["id"],
        )
        r["boundElements"].append({"type": "text", "id": t["id"]})
    return r


def image(name: str, x: float, y: float, size: float = 40) -> dict:
    png = (LOGOS / f"{name}.png").read_bytes()
    fid = _id()
    files[fid] = {
        "mimeType": "image/png",
        "id": fid,
        "dataURL": "data:image/png;base64," + base64.b64encode(png).decode(),
        "created": NOW,
        "lastRetrieved": NOW,
    }
    return base("image", x, y, size, size, fileId=fid, status="saved", scale=[1, 1], strokeColor="transparent")


def arrow(a: dict, b: dict, label: str | None = None, side_a="right", side_b="left", color=INK, dashed=False, via: list[tuple[float, float]] | None = None, label_dy=-20, label_dx=0) -> dict:
    def anchor(e, side):
        cx, cy = e["x"] + e["width"] / 2, e["y"] + e["height"] / 2
        return {
            "right": (e["x"] + e["width"], cy),
            "left": (e["x"], cy),
            "top": (cx, e["y"]),
            "bottom": (cx, e["y"] + e["height"]),
        }[side]

    x0, y0 = anchor(a, side_a)
    x1, y1 = anchor(b, side_b)
    pts = [[0, 0]] + [[vx - x0, vy - y0] for vx, vy in (via or [])] + [[x1 - x0, y1 - y0]]
    xs = [x0 + px for px, _ in pts]
    ys = [y0 + py for _, py in pts]
    ar = base(
        "arrow", x0, y0, max(xs) - min(xs), max(ys) - min(ys),
        points=pts,
        startBinding={"elementId": a["id"], "focus": 0, "gap": 4},
        endBinding={"elementId": b["id"], "focus": 0, "gap": 4},
        startArrowhead=None, endArrowhead="arrow", elbowed=False, strokeColor=color,
        strokeStyle="dashed" if dashed else "solid", roundness={"type": 2} if not via else None,
    )
    a["boundElements"].append({"type": "arrow", "id": ar["id"]})
    b["boundElements"].append({"type": "arrow", "id": ar["id"]})
    if label:
        # place beside the middle of the path, not on it
        mid = len(pts) // 2
        mx = x0 + (pts[mid - 1][0] + pts[mid][0]) / 2 if len(pts) > 2 else x0 + (x1 - x0) / 2
        my = y0 + (pts[mid - 1][1] + pts[mid][1]) / 2 if len(pts) > 2 else y0 + (y1 - y0) / 2
        w = len(label) * 13 * 0.55
        text(mx - w / 2 + label_dx, my + label_dy, label, size=13, color=MUTED, align="center")
    return ar


# ------------------------------------------------------------------ layout

text(40, 20, "larpers · how it works", size=30)
text(40, 62, "One-time preprocessing turns a 90 MB SkillCorner match into a 4.5 MB bundle. The browser downloads it once and never talks to a server again while scrubbing.", size=14, color=MUTED)

# --- column 1: source
c1 = box(40, 130, 260, 310, "", fill="#f5f5f5", stroke="#bdbdbd", dashed=True)
text(56, 140, "DATA SOURCE", size=12, color=MUTED)
image("github", 60, 170, 36)
text(106, 176, "SkillCorner open data", size=16)
text(60, 214, "A-League 2024/25 · MIT license\nbroadcast tracking, 10 fps", size=12, color=MUTED)
f_match = box(60, 262, 220, 34, "{id}_match.json", fill="#ffffff", size=13)
f_track = box(60, 302, 220, 34, "{id}_tracking_extrapolated.jsonl", fill="#fff7e6", size=12)
f_events = box(60, 342, 220, 34, "{id}_dynamic_events.csv", fill="#ffffff", size=13)
f_phases = box(60, 382, 220, 34, "{id}_phases_of_play.csv", fill="#ffffff", size=13)
image("gitlfs", 130, 419, 16)
text(152, 421, "tracking file is 90 MB, via Git LFS", size=11, color=MUTED)

# --- column 2: pipeline
c2 = box(360, 130, 300, 310, "", fill="#eef6ff", stroke="#8fb4e3", dashed=True)
text(376, 140, "BUILD TIME · PYTHON PIPELINE", size=12, color=MUTED)
image("python", 380, 168, 34)
image("pandas", 422, 168, 34)
image("numpy", 464, 168, 34)
text(508, 176, "uv · pandas · NumPy", size=13, color=MUTED)
p_fetch = box(380, 214, 260, 40, "fetch.py  →  download the 4 files", size=13)
p_build = box(380, 264, 260, 104, "build.py\ncontinuous playback clock across half time\nint16 positions in cm · un-mirror events\nvalidate pitch, rosters, frame counts", size=12)
p_cmd = box(380, 378, 260, 40, "make data MATCH=<id>", fill="#1e1e1e", stroke="#1e1e1e", size=14)
for t_ in elements:
    if t_.get("containerId") == p_cmd["id"]:
        t_["strokeColor"] = "#ffffff"
        t_["fontFamily"] = FONT_MONO

# --- bundle (between)
bundle = box(720, 200, 210, 160, "", fill="#fffbe6", stroke="#d4a72c")
text(736, 208, "BUNDLE  (web/public/data/{id})", size=11, color=MUTED)
b_meta = box(736, 232, 178, 30, "meta.json · teams, pitch, periods", size=11)
b_track = box(736, 268, 178, 30, "tracking.bin.gz · 4.5 MB", size=11)
b_events = box(736, 304, 178, 30, "events.json · runs, shots, phases", size=11)
text(736, 338, "swap the match = change one id", size=11, color=MUTED)

# --- column 3: app
c3 = box(1070, 130, 640, 440, "", fill="#f3fff5", stroke="#7fc48f", dashed=True)
text(1086, 140, "RUN TIME · NEXT.JS APP ON VERCEL", size=12, color=MUTED)
image("nextdotjs", 1010, 168, 34)
image("react", 1052, 168, 34)
image("typescript", 1094, 168, 34)
image("tailwindcss", 1136, 168, 34)
image("vercel", 1178, 168, 34)
text(1302, 176, "Next.js 16 · React 19 · TypeScript · Tailwind 4", size=13, color=MUTED)

loader = box(1090, 220, 280, 60, "bundle loader\ngunzip in browser → typed arrays in memory", size=12)
store = box(1090, 300, 280, 60, "playback store (zustand)\ntime, speed, loop, clip draft, overlays", size=12)
canvas = box(1090, 380, 280, 74, "Canvas 2D renderer\n60 fps interpolation between 10 fps frames\ncamera view · trails · player focus", size=12, fill="#ffffff")
image("html5", 1262, 386, 22)

editor = box(1410, 220, 280, 100, "/match/{id}  ·  Editor\nscoreboard, pitch, lanes timeline\nStart clip (I) / End clip (O), squads", size=12)
clip = box(1410, 340, 280, 56, "clip record → encoded in the URL\nstart, end, title, tags, overlays", size=12, fill="#fffbe6", stroke="#d4a72c")
viewer = box(1410, 416, 280, 60, "/clip/{code}  ·  Viewer\nloops, play button, open in full match", size=12)
landing = box(1410, 496, 280, 44, "/  ·  landing page", size=12)

# people
coach = box(1090, 500, 280, 44, "coach or scout opens the link. no login.", size=12, fill="#ffffff", stroke=MUTED, dashed=True)

# --- arrows
arrow(f_track, p_build, "read", side_a="right", side_b="left", label_dy=-34)
arrow(f_match, p_build, side_a="right", side_b="left")
arrow(f_events, p_build, side_a="right", side_b="left")
arrow(f_phases, p_build, side_a="right", side_b="left")
arrow(p_build, bundle, "writes", side_a="right", side_b="left", label_dy=-22)
arrow(bundle, loader, "one download", side_a="right", side_b="left", label_dy=-24)
arrow(loader, store, side_a="bottom", side_b="top")
arrow(store, canvas, "every frame", side_a="bottom", side_b="top", label_dy=-8, label_dx=70)
arrow(store, editor, side_a="right", side_b="left")
arrow(editor, clip, "save", side_a="bottom", side_b="top", label_dy=-8, label_dx=40)
arrow(clip, viewer, "share link", side_a="bottom", side_b="top", label_dy=-8, label_dx=60)
arrow(viewer, coach, side_a="left", side_b="right")
arrow(viewer, editor, "open in full match", side_a="right", side_b="right", color=MUTED, dashed=True, via=[(viewer["x"] + viewer["width"] + 40, viewer["y"] + viewer["height"] / 2), (editor["x"] + editor["width"] + 40, editor["y"] + editor["height"] / 2)], label_dy=-70, label_dx=70)

# footer
text(40, 600, "Only the bundle is fetched at run time. Clips need no database: the link is the record.", size=13, color=MUTED)
text(40, 622, "Logos: Simple Icons (CC0). Data: SkillCorner open data (MIT).", size=11, color=MUTED)

doc = {
    "type": "excalidraw",
    "version": 2,
    "source": "https://github.com/amanibobo/us-soccer",
    "elements": elements,
    "appState": {"gridSize": 20, "gridStep": 5, "gridModeEnabled": False, "viewBackgroundColor": "#ffffff"},
    "files": files,
}
out = HERE / "architecture.excalidraw"
out.write_text(json.dumps(doc, indent=1))
print(f"wrote {out} with {len(elements)} elements and {len(files)} images")
