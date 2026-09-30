# PRD: Tracking Data Clipper (US Soccer x GSU ColorStack Tech League)

Sep 30, 2026 · @amani bobo

## Summary

A web app that plays one match of SkillCorner tracking data on a 2D pitch, lets the user scrub it like a YouTube video, and turns any 0-10 second window into a clip that other people can open from a link.

The bet is that the required features are table stakes and the score is decided by three things:

- **Swap-ability.** Any SkillCorner match loads by changing one match ID, with no code changes. This is the literal question under "Technical feasibility."
- **Analyst workflow.** Clips are tagged, titled, annotated and grouped into playlists, the way video analysts already work. This is the "sit in the shoes of a video analyst" question under "Innovation."
- **Zero learning curve.** Controls copy YouTube exactly: space to play, arrow keys to step, drag to scrub. This is the "limited computer experience beyond YouTube" question under "Presentation clarity."

Working name: **Touchline**. Rename freely.

## The brief and how it is scored

US Soccer wants tracking data to be clipped and shared the way video analysts clip and tag video. Two features are required: a scrub slider over the full match, and clipping of any 0-10 second sequence that other users can view.

Each category is scored 1-5. Every feature in this PRD should earn points in at least one row.

| Category | What the judges ask | How this PRD answers |
| --- | --- | --- |
| Technical feasibility | Can the match be swapped? Does the stack fit the problem? | Match ID is the only input. A preprocessing script converts any SkillCorner match to one compact format. Static front end, thin API, one Docker command. |
| Innovation | Did you think like a video analyst beyond the brief? | Tags, playlists, drawing on clips, event markers on the timeline, and overlays only tracking data can show (off-ball runs, camera view, team shape). |
| Presentation clarity | Can a YouTube-only user pick it up? | YouTube keyboard shortcuts and layout, a 3-step clip flow, a first-run tour, and a tutorial video under 3 minutes. |

Submission needs three things: a tutorial video for first-time users, a public repo without the dataset, and a README covering description, stack, architecture and run instructions (or a live link).

## Users and what they need

Three groups inside US Soccer use the output, and only one of them makes clips. The rest only open them, so the viewing side has to work with no instructions at all.

| User | Role in the tool | What they need |
| --- | --- | --- |
| Performance or video analyst | Makes clips | Find a moment fast, trim it precisely, label it, send it. Same habits as video tagging software. |
| Coach | Opens clips | One link, plays immediately, loops, shows what the analyst wants them to notice. No login, no setup. |
| Talent ID scout | Opens and filters clips | Follow one player through a sequence. See what he does off the ball, which video often cuts out of frame. |

The core insight for the pitch to judges: video shows what the camera followed, tracking data shows all 22 players. A clip tool for tracking data should make the off-camera part easy to see, not just replay dots.

## Dataset

The [SkillCorner open data repo](https://github.com/SkillCorner/opendata) holds broadcast tracking for 2024/25 Australian A-League matches at 10 frames per second, plus derived event and phase files for each match. It is MIT licensed and SkillCorner asks for credit.

| File per match | What it holds | How the tool uses it |
| --- | --- | --- |
| `{id}_match.json` | Lineups, shirt numbers, positions, kit colors, score, pitch size, period start and end frames, attacking side per half | Player labels, team colors, pitch drawing, match clock |
| `{id}_tracking_extrapolated.jsonl` | One line per frame: x/y for each player and the ball, who is in possession, an `is_detected` flag per player, and the camera's visible area as a polygon | The playback itself, plus the "what the camera saw" overlay |
| `{id}_dynamic_events.csv` | Player possessions, passing options, off-ball runs and on-ball engagements, each with start and end frames ([spec](https://26560301.fs1.hubspotusercontent-eu1.net/hubfs/26560301/Guides/Dynamic%20Events/20250216%20-%20Dynamic%20Events%20CSV%20Specifications.pdf)) | Timeline markers, suggested clips, run and pressing overlays |
| `{id}_phases_of_play.csv` | Start and end frames of each phase (build up, create, finish, transition, set play and others), with flags for phases that led to a shot or goal | Colored phase band on the scrub bar, "jump to next chance" |

Coordinates are in meters with (0, 0) at the center spot, x along the length and y along the width.

### Things I checked directly that shape the design

- **The tracking file is about 90 MB of raw JSON and is stored in Git LFS.** Match 2017461 is 89.5 MB. A browser cannot load that comfortably, so preprocessing is required, not optional.
- **Frame numbers are not match time.** In match 2017461 the first half starts at frame 2510 and there is a gap of about 9,500 frames at half time. In other matches the first half starts at frame 10. The clock must be built from `match_periods` in the match file.
- **Pitch size varies.** One match is 104 x 68 m, others are 105 x 68 m. Read it from the match file, never hard-code it.
- **Teams switch ends at half time.** `home_team_side` lists the direction for each period.
- **Event coordinates are mirrored** so the team in possession always attacks left to right. Flip them back using `attacking_side` before drawing on the pitch.
- **`matches.json` lists 20 matches, the README says 10.** Confirm which match folders contain all four files before committing to one.
- **Known noise.** SkillCorner states about 97% of player identities are correct and recommends smoothing speeds. Off-camera players are extrapolated, not observed.

### Which match to use

Recommended: **2006229, Melbourne City 2-0 Macarthur FC** (7 March 2025). It has two goals, one forward scored both, and its frame numbering is clean. That gives the demo a goal clip and a "follow one player" story.

Swap test: **2017461, Melbourne Victory 0-1 Auckland FC**. It has the awkward frame offsets and a white away kit, so if the tool loads it with no code changes, the swap claim is proven. Show this swap in the video.

## Core scope: what the brief requires

Six requirements cover the brief. All six must be finished and polished before any extra feature is started.

| ID | Requirement | Done when |
| --- | --- | --- |
| C1 | Pitch playback | All players and the ball move on a 2D pitch in kit colors with shirt numbers. Play, pause, and speeds of 0.5x, 1x and 2x work. Motion is smooth, not a 10 fps stutter. |
| C2 | Scrub slider | Dragging the bar moves the pitch with no visible lag across the whole match. Clicking jumps. The clock shows match time and half. The half-time gap is invisible to the user. |
| C3 | Make a clip | The user sets a start and an end, the tool blocks anything over 10.0 seconds with a clear message, and the user gives it a title. Three actions or fewer from "I see it" to "saved." |
| C4 | Share a clip | Every clip has its own link. Opening it shows only that clip, looping, with a play button and nothing to learn. A second button downloads it as a GIF or MP4. |
| C5 | Clip list | Saved clips appear in a side list and as markers on the scrub bar, like YouTube chapters. Clicking one plays it. |
| C6 | Swap the match | Running one command with a different match ID produces a working tool for that match. No source edits. |

### Decision: link first, file second

The brief leaves the viewing method open. A clip here is a small record: match ID, start frame, end frame, title, tags and drawings. The link is the primary output and the GIF or MP4 is the fallback.

- A link keeps the clip interactive. The coach can pause, step frame by frame, turn overlays on, or open the full match at that moment for context.
- A link costs a few hundred bytes to store. A GIF costs megabytes and cannot be edited after.
- A file still matters because analysts paste clips into slides and group chats. Offer it, but do not build the product around it.

The clip's data is also encoded in the URL itself, so a shared link still opens if the clip database is wiped or the judges run the tool locally.

## Beyond the brief: what to add

An analyst spends most of their time finding the moment, not trimming it. The strongest additions help them find moments faster and show things video cannot. Effort is S (under a day), M (1-3 days) or L (more).

### Build these (they carry the Innovation score)

| # | Feature | Why an analyst wants it | Data it uses | Effort |
| --- | --- | --- | --- | --- |
| A1 | Timeline markers and phase band | Goals, shots and phases of play are visible on the scrub bar. "Next chance" and "previous chance" buttons jump between them. | Phases file, match file | S |
| A2 | Tags and notes on clips | Same habit as video tagging. Tag by theme (pressing, build-up, set piece) and by player, then filter the clip list. | None (user input) | S |
| A3 | Camera view overlay | Shades the area the broadcast camera saw and fades players who were off camera. Makes the tool's unique value obvious in one glance. | Camera polygon, `is_detected` | S |
| A4 | Player focus | Click a player to highlight him, show his name and position, and draw a trail of his last 3 seconds. Built for talent ID. | Tracking, match file | S-M |
| A5 | Drawing on clips | Arrows, lines, zones and freehand, saved with the clip and shown to whoever opens it. If your telestrator canvas code fits, reuse it. | None (user input) | M |
| A6 | Suggested clips | One click to create clips from events: every sequence that led to a shot, every run in behind by a chosen player, every pressing chain that won the ball. The analyst reviews and keeps the good ones. | Dynamic events, phases file | M |
| A7 | Playlists | Order several clips under one title and share one link that plays them in sequence. This is how analysts present to coaches. | None (user input) | M |

### Add if time allows

| # | Feature | Why | Effort |
| --- | --- | --- | --- |
| B1 | Team shape overlays | Toggle team outline, defensive line height, and team width and length. Coaches talk in these terms. | M |
| B2 | Run and passing option arrows | Draw SkillCorner's off-ball runs and passing options on the pitch during a clip, colored by threat. | M |
| B3 | Space control map | Shade which team controls each area of the pitch (Voronoi). Visually striking in the video. | M |
| B4 | Ask for clips in plain English | "Show me number 17's runs in behind in the second half" returns matching clips by filtering the events file with an LLM. High wow factor, needs a fallback if it misfires in the demo. | M-L |
| B5 | Comments on a clip | A coach replies on the clip itself instead of in a separate chat. | M |
| B6 | Export clip data as CSV | The data team gets the raw frames for the same window the coach is watching. | S |

### Leave out

- **Accounts and login.** They add friction for judges and nothing to the score. A name field on clip creation is enough.
- **3D view.** Looks impressive, harder to read than 2D, and costs days.
- **Multi-match library.** Prove the swap with two matches instead of building a catalog.
- **Recomputing metrics.** SkillCorner already supplies runs, passing options, pressure and phases. Visualize theirs, do not rebuild them.

## UX: screens and the clip flow

The editor looks like a YouTube watch page: the pitch where the video would be, the control bar under it, and the clip list where recommended videos would be. Anyone who has used YouTube already knows where everything is.

### Two screens

- **Editor** (`/match/{id}`). Header with teams, score and overlay toggles. Pitch in the center. Below it: play button, clock, speed, and the scrub bar with a phase band and event markers. Right panel with three tabs: Clips, Suggested, Playlists.
- **Viewer** (`/clip/{id}`). What a coach sees from a shared link. Title, the pitch, a play button, and the clip looping. Small secondary actions: open in full match, download, copy link. Nothing else.

### Making a clip

1. Pause on the moment and press **Start clip** (or `I`).
2. Play or drag forward and press **End clip** (or `O`). The selected range lights up on the scrub bar with two drag handles and a counter, for example "6.4 s of 10 s."
3. Type a title, add tags if wanted, press **Save**. The link is copied to the clipboard and a message confirms it.

A shortcut button, **Clip last 10 seconds**, does steps 1 and 2 in one press for the common case of "that was it, save that."

### Keyboard shortcuts (same as YouTube where one exists)

| Key | Action |
| --- | --- |
| Space or `K` | Play or pause |
| Left / Right arrow | Back or forward 5 seconds |
| `J` / `L` | Back or forward 10 seconds |
| `,` / `.` | Back or forward one frame |
| `I` / `O` | Set clip start / end |
| Shift + Left / Right | Previous or next chance |
| `?` | Show this list |

### Rules for clarity

- Plain labels only: "Start clip" and "End clip," never "in-point" or "frame." Show time as 23:41, not frame 14210.
- Every button has a text tooltip. No icon-only controls.
- Teams differ by more than color: home as filled circles, away as rings, ball in a distinct shape. Outline every marker so a white kit stays visible.
- A four-step first-run tour points at play, scrub, Start clip and Save. A `?` button replays it.
- Errors say what to do: "Clips can be up to 10 seconds. Drag the end handle left."

## Architecture and tech stack

The design splits into a one-time preprocessing step and a light run-time app. All heavy work happens before the user opens the page, which is what makes scrubbing feel instant.

&#91;embedded content: architecture · build-time pipeline and run-time app\]

The browser holds the whole match in memory after one download, so scrubbing and playback never call the server. The server is only contacted to save or open a clip.

| Layer | Choice | Why it fits |
| --- | --- | --- |
| Preprocessing | Python with pandas and NumPy | Sports analytics teams work in Python. It reads the JSONL and CSV files directly. |
| Match format | Positions as 16-bit integers in centimeters, one flat binary file, plus JSON for metadata and events | Roughly 59,000 frames x 23 objects x 2 coordinates is about 5.5 MB before compression, down from about 90 MB. Any frame is found by index with no parsing. |
| Front end | React, TypeScript, Vite | Standard, well documented, easy for a reviewer to read. |
| Pitch rendering | HTML Canvas 2D, interpolated between frames to 60 fps | 23 moving dots is trivial for canvas. No game engine or WebGL needed. |
| API | FastAPI | Same language as the pipeline. About five endpoints. |
| Storage | SQLite | One file, no setup. Swap for Postgres if many people write at once. |
| Export | MediaRecorder for MP4 or WebM, a GIF encoder in a web worker | Runs in the browser, so no video rendering on the server. |
| Packaging | Docker Compose | One command to run locally. |
| Hosting | A free tier such as Fly.io or Render | Judges click a link instead of installing anything. |

### Clip record

| Field | Example | Note |
| --- | --- | --- |
| `id` | `k3f9x2` | Short, goes in the URL |
| `match_id` | `2006229` | Makes clips portable across matches |
| `start_frame`, `end_frame` | `14210`, `14274` | End minus start is at most 100 frames (10 s at 10 fps). Enforced on the server too. |
| `title`, `tags`, `author` | "Run in behind, 24th min" | Free text and a tag list |
| `drawings` | JSON | Shapes in pitch meters, not pixels, so they scale on any screen |
| `overlays` | JSON | Which toggles were on when the clip was saved |

### Repo layout

```
touchline/
  pipeline/            fetch and preprocess one match (Python)
  api/                 FastAPI app and SQLite schema
  web/                 React app
  data/                gitignored, bundles are written here
  docker-compose.yml
  Makefile             make data MATCH=2006229, make up
  README.md
```

## Data pipeline and swapping the match

One command, `make data MATCH=<id>`, turns any SkillCorner match into a bundle the app can load. Nothing in the app knows about a specific match, team or pitch size.

1. **Fetch.** Download the four files for the match ID from the SkillCorner repo into `data/raw/`. The tracking file comes through Git LFS. The dataset is never committed, which satisfies the submission rule.
2. **Read match info.** Teams, kit colors, roster (player ID to number, name, position, team), pitch size, period frames, and attacking side per half.
3. **Build the clock.** Keep only frames inside a period. Give each a continuous playback index and a match time. Keep the original frame number alongside, because the event files refer to it.
4. **Pack positions.** One fixed slot per rostered player plus the ball. Store x and y in centimeters as 16-bit integers, with a reserved value for "not on the pitch." Store `is_detected` as a separate bit array and the camera polygon at low precision.
5. **Clean lightly.** Interpolate short gaps in the ball track. Offer optional smoothing as a toggle. Never invent positions across long gaps.
6. **Convert events.** Keep the needed columns from the events and phases files, flip mirrored coordinates back to real pitch directions, and write compact JSON keyed by frame.
7. **Write and check.** Write the bundle with a format version and frame rate in `meta.json`. Assert that frame counts match period durations, coordinates fall inside the pitch plus a margin, and no more than 11 players per team are on the pitch. Print a summary.

### Why this holds up when the match changes

- **Frame rate is data, not a constant.** The brief mentions 10-30 fps. The 10 second limit is computed as `10 x fps`, so a 25 fps feed works.
- **Everything match-specific lives in `meta.json`.** Colors, names, pitch size, periods and directions are all read at load.
- **The app lists whatever bundles exist.** With two bundles in `data/`, a match picker appears. That is the swap demo.
- **One adapter per data provider.** The pipeline's loader is a single function that returns a standard structure. Supporting another vendor means writing one new loader. The open-source [kloppy](https://kloppy.pysport.org/) library already standardizes several tracking providers and is worth evaluating as that layer.

## Build plan

Build in this order so there is a submittable tool after milestone 4 and every later milestone only adds score. No dates are set because the deadline is not in the brief text.

1. **Data spike (half a day).** Download match 2006229, load it in a notebook, plot one frame, and confirm every item in the "things I checked" list. Decide the match.
2. **Pipeline.** `make data MATCH=<id>` produces a valid bundle for both the main match and the swap-test match.
3. **Playback and scrubbing.** Pitch, players, ball, play and pause, speed, smooth interpolation, scrub bar, clock, keyboard shortcuts. Covers C1 and C2.
4. **Clips.** Start and end, 10 second limit, save, link, viewer page, clip list, markers on the bar, GIF and MP4 download. Covers C3 to C5. Put it in Docker and deploy it. **The brief is now met. From here on, the deployed version must always work.**
5. **Analyst layer, quick wins.** Timeline markers and phase band, tags, camera view overlay, player focus (A1 to A4).
6. **Analyst layer, bigger items.** Drawing on clips, suggested clips, playlists (A5 to A7).
7. **Clarity pass.** First-run tour, empty states, error messages. Hand the tool to someone non-technical, say nothing, watch where they get stuck, and fix the top three problems.
8. **Submission.** README, tutorial video, final deploy, swap test recorded.
9. **Stretch.** Items B1 to B6, only after a full draft of the video exists.

If time runs short, cut from the bottom. A polished milestone 5 beats a rough milestone 6.

## Submission deliverables

The video and README are scored directly under Presentation clarity, so they get real time in the plan, not the last hour.

### Tutorial video (aim for under 3 minutes)

1. **The problem, 15 seconds.** Video shows what the camera followed. Tracking data shows all 22 players. This tool lets you clip it like video.
2. **Scrub, 20 seconds.** Play, drag, jump to the next chance.
3. **Make a clip, 30 seconds.** Start, End, title, Save. Show the 10 second limit message once.
4. **Share it, 30 seconds.** Paste the link into a new browser window as "the coach." Download the GIF.
5. **What video cannot show, 45 seconds.** Camera view overlay, player focus on the goalscorer, a suggested off-ball run clip, a drawing, a playlist.
6. **Swap the match, 20 seconds.** Run one command, open the second match.

Record the screen at a large zoom, speak slowly, and show key presses on screen. Write the script before recording.

### README checklist

- [ ] One-paragraph description and a screenshot or GIF at the top
- [ ] Link to the live tool and to the video
- [ ] How to use it, in the same three steps as the clip flow
- [ ] How to run it locally: `make data MATCH=2006229` then `docker compose up`
- [ ] How to swap the match, with the exact command
- [ ] Tech stack and the architecture diagram from this PRD
- [ ] Technical choices and why, including what was considered and rejected
- [ ] Project structure
- [ ] Known limitations and what would come next
- [ ] Credit to SkillCorner for the data, as their license note asks

### Repo checklist

- [ ] `data/` is in `.gitignore` and no dataset file is in git history
- [ ] Dockerfile and `docker-compose.yml` work from a fresh clone
- [ ] A few tests on the pipeline (clock mapping, 10 second limit)
- [ ] Clean commit history with readable messages

## Risks and open questions

The biggest risk is spending the time on extras while the core scrub and clip flow still feels rough. The build order above is the guard against that.

| Risk | What it looks like | Response |
| --- | --- | --- |
| Scrubbing lags | The pitch trails the slider on a slow laptop | Binary bundle held in memory, draw only on animation frames, test on a throttled CPU early |
| Ball track is noisy or missing | Ball jumps or vanishes in clips | Interpolate short gaps, fade the ball when it is not detected, never hide the problem by faking long stretches |
| Off-camera players look wrong | Extrapolated players drift | Show them faded by default and explain it with the camera overlay. It becomes a feature, not a bug. |
| GIF export is slow or huge | A 10 second GIF takes long to encode or exceeds 10 MB | Encode in a web worker at 10 fps and reduced size, offer MP4 as the default download |
| Free hosting sleeps | First load takes 30 seconds for a judge | Keep the app warm before judging, and make the URL-encoded clip links work without the database |
| Git LFS download fails | The fetch script gets a pointer file instead of data | Detect the pointer, print a clear message with the manual download steps |
| Scope creep | Six half-finished overlays | Finish A1 to A4 fully before starting A5 |

### Open questions

- [ ] What is the submission deadline, and is this solo or a team? This decides how far down the feature list to plan.
- [ ] Is a live hosted link expected, or is Docker enough? Plan for both until confirmed.
- [ ] Which match folders contain all four files? `matches.json` lists 20 matches and the README says 10.
- [ ] Is tracking quality good in match 2006229, especially around the two goals? Check in the data spike.
- [ ] Should saved clips be visible to everyone with the match link, or only to people with the clip link? Default proposed: everyone, no accounts.
- [ ] Does the hosted demo need the data files on the server? If so, confirm the MIT license and credit note cover that. The repo itself still excludes them.
- [ ] Is the plain-English clip search (B4) worth the demo risk? Decide after A1 to A7 are done.

## Sources

- [SkillCorner open data repository and README](https://github.com/SkillCorner/opendata), opened 30 September 2026
- [SkillCorner Dynamic Events CSV Specifications, 2025/02/16](https://26560301.fs1.hubspotusercontent-eu1.net/hubfs/26560301/Guides/Dynamic%20Events/20250216%20-%20Dynamic%20Events%20CSV%20Specifications.pdf)
- Direct inspection of `matches.json`, three `_match.json` files, the phases file header and the tracking file's LFS pointer for match 2017461. Tracking frame contents and the bundle size are taken from the README and arithmetic, not from a full download.
