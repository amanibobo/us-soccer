# Tracking Data Viewer

A web app for watching one game of [SkillCorner open data](https://github.com/SkillCorner/opendata) tracking data and clipping short moments to share.

- **Scrub** through the whole match with a slider, or press Play to watch it at real speed (10 frames per second).
- **Jump to key moments** with the event timeline under the slider. It has one lane each for shots & goals, ball won by pressing, ball lost, and dangerous off-ball runs, built from SkillCorner's event data. Hover a marker to see what happened, when, and who did it; click it to start playing 5 seconds before the moment.
- **Clip** any 0–10 second sequence: move to the start and click **Set clip start**, move to the end and click **Set clip end**, give it a name, then click **Save clip**.
- **Share** clips: every saved clip shows up in the Clips list for everyone using the app. Click **Watch** to play it, or **Copy link** to get a link (`/?clip=<id>`) that opens straight to that clip.

## Running it

Requires Python 3.10+.

```bash
python -m venv .venv
# Windows: .venv\Scripts\activate    macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt

# Download a match (IDs are the folder names in SkillCorner/opendata/data/matches)
python download_data.py 1886347

python app.py
```

Then open http://localhost:5000.

### Using a different game

Any match from the SkillCorner open data works. Download it with `python download_data.py <match_id>` and start the app with that ID:

```bash
python app.py <match_id>        # or set the MATCH_ID environment variable
```

With no ID given, the app uses the first match folder found in `data/`. Pitch size, team names, and kit colours are all read from the match file. The events file is optional: without it, the app works the same but has no event timeline.

## Tech stack and architecture

| Part | Choice | Why |
| --- | --- | --- |
| Backend | Python + Flask | Small and simple; the only dependency. |
| Frontend | Plain HTML, CSS, JavaScript, `<canvas>` | No build step; canvas redraws 22 players + ball easily at 10 FPS. |
| Clip storage | `clips.json` file | No database needed for a handful of clips. |

```
app.py              Flask server: loads the match, serves frames and clips
download_data.py    Downloads a match's match.json, tracking and events files from GitHub
static/index.html   Page layout
static/app.js       Pitch drawing, slider/playback, clipping, clip list
static/style.css    Styling
data/<match_id>/    Downloaded SkillCorner files (not committed)
clips.json          Saved clips (created on first save, not committed)
```

**How it works**

1. On startup, `app.py` reads `<id>_match.json` (players, teams, kit colours, pitch size) and `<id>_tracking_extrapolated.jsonl` (one line per frame with player and ball x/y in metres). Each frame is kept in memory as a compact JSON string.
2. The browser requests frames in 1-minute chunks (`GET /api/frames?start=N`) as you scrub or play, and prefetches the next chunk so playback doesn't stall. This keeps the initial page load fast instead of downloading the whole ~90 MB match.
3. `<id>_dynamic_events.csv` is filtered down to the moments an analyst would look for first (shots, goals, pressing regains, possession losses, dangerous runs), and each is placed on the timeline at its frame. Each type gets its own labelled lane so busy stretches of the match stay readable.
4. Clips are saved as a start and end frame (`POST /api/clips`); the server rejects clips longer than 10 seconds. `GET /api/clips` lists the clips for the loaded match.
