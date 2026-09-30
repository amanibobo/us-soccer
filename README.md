# larpers

**Clip tracking data like video.** Touchline plays a full match of SkillCorner tracking data on a 2D pitch, lets you scrub it like a YouTube video, cut any moment up to 10 seconds into a clip, tag it, and share it with one link.

Built for the US Soccer x GSU ColorStack Tech League. Tracking data by [SkillCorner open data](https://github.com/SkillCorner/opendata) (MIT). Player photos from Wikimedia Commons under their individual licenses (credits in `web/src/config/players.json`). Club crests belong to the clubs and are used only to identify the teams.

> Live site: _coming soon_ · Tutorial video: _coming soon_

## How to use it

1. Pause on the moment and press **Start clip** (or `I`).
2. Move forward and press **End clip** (or `O`). The bar shows the range and a counter such as "6.4 s of 10 s".
3. Give it a title, add tags if you like, press **Save and copy link**. Paste the link anywhere. It opens as a looping clip with a play button and nothing to learn.

Keyboard shortcuts are the same as YouTube: `Space` play/pause, `←`/`→` 5 seconds, `J`/`L` 10 seconds, `,`/`.` one frame, `Shift+←/→` previous/next chance, `?` for the full list. Click any player to follow him.

## Run it locally

Requirements: Node 20+, Python 3.11+ with [uv](https://docs.astral.sh/uv/), and `make`.

```bash
make data MATCH=2006229      # download the four SkillCorner files and build a bundle (about 2 min)
cd web && npm install && npm run dev
```

Open http://localhost:3000.

Optional extras, both in [web/src/config/matches.ts](web/src/config/matches.ts): club crests in `web/public/logos` and a highlights link per match. Player photos come from Wikimedia Commons where a freely licensed one exists:

```bash
make headshots               # looks up every rostered player on Wikidata, saves photos + credits
```

## Swap the match

Nothing in the app knows about a specific match, team, pitch size or frame rate. Every SkillCorner match loads by changing one ID:

```bash
make data MATCH=2017461
```

Refresh the page. The landing page lists every bundle it finds and the match picker shows both. Match 2017461 (Melbourne Victory 0-1 Auckland FC) is the swap test: it has an awkward frame offset and a white away kit, and it loads with no code changes.

## Architecture

```
SkillCorner raw files (90 MB tracking JSONL + match JSON + events CSV + phases CSV)
        │
        │  pipeline/build.py  (one-time, Python)
        ▼
bundle/  meta.json          teams, players, pitch, periods, gaps, goals, shots
         tracking.bin.gz    int16 positions in cm, flags, ball, camera polygon  (~4.5 MB)
         events.json        dynamic events + phases keyed by playback index
         preview.json       one real frame for the landing page
        │
        │  fetched once by the browser, held in memory
        ▼
web/     Next.js app: canvas playback at 60 fps (interpolated), scrubber, clips
```

The browser downloads the bundle once and never talks to a server again while scrubbing, which is what makes dragging feel instant. A clip is a small record (match ID, start and end index, title, tags, overlays) that is encoded into its own URL, so a shared link works with no database at all and still opens if the app is run locally.

### Why these choices

| Layer | Choice | Why |
| --- | --- | --- |
| Preprocessing | Python, pandas, NumPy | Sports analytics teams work in Python. Reads the JSONL and CSV directly. |
| Match format | Flat binary of 16-bit integers in centimetres, gzipped | 59,000 frames x 36 roster slots x 2 coords is 8.5 MB raw, 4.5 MB gzipped, down from 90 MB. Any frame is an array index, no parsing. |
| Front end | Next.js 16, React 19, TypeScript, Tailwind 4 | Standard, well documented, deploys to Vercel in one click. |
| Rendering | HTML Canvas 2D, interpolated between 10 fps frames | 23 moving dots is trivial for canvas. No WebGL or game engine needed. |
| State | zustand | A tiny store the animation loop can update at 60 fps without re-rendering the pitch through React. |
| Clips | URL-encoded, plus browser storage for the list | Zero setup for judges, links never die. A server store can be added without changing the clip shape. |

### Things in the data that shaped the design

- **Frame numbers are not match time.** Some matches start the first half at frame 10, others at frame 2510, and there is a gap of thousands of frames at half time. The pipeline builds a continuous playback index from `match_periods` and the clock is derived from it.
- **About a quarter of frames have no player data.** When the broadcast cuts to a replay or a close-up, SkillCorner has nothing to track. Those stretches are hatched on the timeline, playback skips over them by default, and the pitch says so instead of freezing dots.
- **Event coordinates are mirrored** so the team in possession always attacks left to right. The pipeline flips them back using `attacking_side`, verified against the tracking positions.
- **Off-camera players are extrapolated.** They are drawn faded with a dashed outline, and the Camera view overlay shows exactly what the broadcast could see.

## Project structure

```
pipeline/   fetch.py (download, LFS-aware), build.py (bundle builder), bundle.py (format + clock), headshots.py, tests/
web/        Next.js app
  src/app/            routes: / (landing), /match/[id] (editor), /clip/[code] (viewer)
  src/components/     PitchCanvas, Scrubber, Controls, ClipPanel, SquadPanel, MatchHeader, Editor, ClipViewer
  src/lib/            bundle loader, render, clock, clip encoding
  src/store/          playback store
  src/config/         site.ts (landing content), matches.ts (crests, highlight links), players.json (photo credits)
  public/data/        bundles (gitignored)
data/raw/   downloaded SkillCorner files (gitignored)
Makefile    make data MATCH=<id>, make test, make dev
```

## Deploying

Bundles are not committed. Host the `web/public/data` folder anywhere static (Vercel Blob, S3, a GitHub release) and set `NEXT_PUBLIC_DATA_BASE` to that URL. Without the variable the app reads from `public/data`, which is what local dev uses.

## Tests

```bash
make test
```

Covers the clock mapping across half time, the coordinate flip, the binary container round trip, and the 10 second limit derived from the frame rate.

## Known limitations and next steps

- Clips live in the link and the browser. A shared clip list needs a small server store (planned).
- Download as GIF or MP4 is not built yet. The link is the primary output.
- Drawing on clips, suggested clips from SkillCorner events, and playlists are the next features in order.
