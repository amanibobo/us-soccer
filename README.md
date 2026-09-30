# Tracking Data Viewer

A web app for watching a match of [SkillCorner open data](https://github.com/SkillCorner/opendata) tracking data, like scrubbing through a YouTube video, and cutting short clips to share with coaches and analysts.

Tracking data is the x/y position of all 22 players and the ball, 10 times per second. This tool draws it on a pitch so you can see the whole team shape, including the off-ball movement a broadcast camera misses.

## Features

- **Scrub and play.** Drag the slider to move through the whole match, or press **Play** to watch at real speed (10 frames per second).
- **Jump to key moments.** An event timeline under the slider marks shots and goals, balls won by pressing, balls lost, and dangerous off-ball runs, each in its own lane. Hover a marker to see what happened, when, and who did it. Click it to start playing 5 seconds before the moment, so you see the build-up.
- **See off-ball movement.** Each player leaves a fading trail showing where they ran over the last 3 seconds, so runs and shape changes are visible even when paused. Switch trails off with the **Show movement trails** checkbox.
- **Clip.** Save any sequence up to 10 seconds long, with a name.
- **Share inside the app.** Saved clips appear in the Clips list for everyone using the app. **Copy link** gives a link that opens straight to that clip.
- **Download as video.** Save any clip as a video file for email, WhatsApp or presentations. The video includes the trails and a caption with the match, clip name and game clock.

## How to use it

1. **Find a moment.** Drag the slider, press **Play**, or click a marker on the event timeline (hover first to see what it is).
2. **Mark the clip.** Move to where the clip should begin and click **Set clip start**. Move to where it should end and click **Set clip end**. The app shows the clip's length and warns you if it is over 10 seconds.
3. **Save it.** Type a name (for example "Moreno goal") and click **Save clip**. It appears in the **Clips** list on the right.
4. **Share it.** In the Clips list:
   - **Watch** plays the clip on the pitch.
   - **Copy link** copies a link that opens the app on that clip, for anyone who can reach the app.
   - **Download** records the clip and saves it as a video file. The clip plays while it records (up to 10 seconds), so keep the tab open until the file is saved.

## Running it

Requires Python 3.10+ and a modern browser (Chrome, Edge or Firefox).

```bash
python -m venv .venv
# Windows: .venv\Scripts\activate    macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt

# Download a match (Auckland FC vs Newcastle Jets, A-League 2024/25)
python download_data.py 1886347

python app.py
```

Then open http://localhost:5000.

### Using a different game

Any match in the SkillCorner open data works (match IDs are the folder names in [`data/matches`](https://github.com/SkillCorner/opendata/tree/master/data/matches)):

```bash
python download_data.py <match_id>
python app.py <match_id>        # or set the MATCH_ID environment variable
```

With no ID given, the app uses the first match folder in `data/`. Nothing is hard-coded to one game: pitch size, team names, scores, kit colours and players are all read from the match's own files. If a match has no events file, everything still works except the event timeline.

## Tech stack and architecture

| Part | Choice | Why |
| --- | --- | --- |
| Backend | Python + Flask | Small and simple. Python is the standard language for sports data work, and Flask is the only dependency. |
| Frontend | Plain HTML, CSS and JavaScript, drawn on a `<canvas>` | No build step or framework to install; canvas easily redraws 22 players, the ball and their trails 10 times a second. |
| Video export | Browser `MediaRecorder` API | Records the pitch canvas directly in the browser, so the server needs no video tools (no ffmpeg). Saves MP4 in Chrome and Edge, WebM elsewhere. |
| Clip storage | `clips.json` file | A handful of clips doesn't need a database. |

```
app.py              Flask server: loads the match, tracking frames and key events; serves them and the clips
download_data.py    Downloads a match's match.json, tracking and events files from SkillCorner's GitHub
static/index.html   Page layout
static/app.js       Pitch drawing, trails, playback, event timeline, clipping, clip list, video download
static/style.css    Styling
data/<match_id>/    Downloaded SkillCorner files (not committed)
clips.json          Saved clips (created on first save, not committed)
```

### How it works

1. **Loading the match.** On startup, `app.py` reads three files from `data/<match_id>/`:
   - `<id>_match.json`: players, teams, kit colours and pitch size.
   - `<id>_tracking_extrapolated.jsonl`: one line per frame, with every player's and the ball's x/y in metres.
   - `<id>_dynamic_events.csv`: SkillCorner's event data.

   Each frame is kept in memory as a compact JSON string. With a full match loaded, the server uses under 100 MB of memory.
2. **Streaming frames.** Instead of downloading the whole ~90 MB match up front, the browser requests frames in 1-minute chunks (`GET /api/frames?start=N`) as you scrub or play. It fetches the next chunk ahead of time so playback doesn't stall.
3. **Event timeline.** The server filters the ~5,000 events down to the moments an analyst looks for first: shots, goals, pressing regains, possession losses and dangerous runs. The browser places each one on the timeline at its frame. Each type has its own labelled lane so busy stretches stay readable.
4. **Trails.** For each frame, the browser draws every player's path over the previous 30 frames (3 seconds), fading with age. Trails break at half-time and skip tracking glitches (jumps over 3 m in 0.1 s).
5. **Clips.** A clip is stored as a start and end frame (`POST /api/clips`). The server rejects clips longer than 10 seconds. `GET /api/clips` lists the clips for the loaded match, and `/?clip=<id>` opens the app playing that clip.
6. **Video download.** The browser loads every frame the clip needs, then plays it on the canvas while `MediaRecorder` captures it, and saves the result as a file. Nothing is sent to the server.
