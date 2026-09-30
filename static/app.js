const canvas = document.getElementById("pitch");
const ctx = canvas.getContext("2d");
const slider = document.getElementById("slider");
const playBtn = document.getElementById("play");
const clock = document.getElementById("clock");
const clipRange = document.getElementById("clip-range");
const clipName = document.getElementById("clip-name");
const saveBtn = document.getElementById("save-clip");
const message = document.getElementById("message");
const clipList = document.getElementById("clips");
const nowPlaying = document.getElementById("now-playing");
const trailsToggle = document.getElementById("show-trails");

const SCALE = 9; // pixels per meter
const MARGIN = 30; // pixels around the pitch
const TRAIL_SECONDS = 3; // how much recent movement each player's trail shows
const MAX_STEP_METERS = 3; // a bigger jump between frames is a tracking glitch, not a run

let meta;
let current = 0;
let timer = null;
let clipStart = null;
let clipEnd = null;
let activeClip = null; // clip being watched; playback stops at its end
let clips = [];
const chunks = new Map(); // chunk index -> array of frames
const loading = new Map(); // chunk index -> promise for its request
let recording = null; // { recorder, clip } while a clip is being recorded for download

// ---------- Data loading ----------

function getFrame(i) {
  const c = Math.floor(i / meta.chunk_size);
  loadChunk(c);
  loadChunk(c + 1); // prefetch so playback doesn't stall
  const frames = chunks.get(c);
  return frames ? frames[i - c * meta.chunk_size] : undefined;
}

// Returns a promise that settles once chunk c is loaded (or has failed to load).
function loadChunk(c) {
  if (c < 0 || c * meta.chunk_size >= meta.num_frames) return Promise.resolve();
  if (!loading.has(c)) {
    loading.set(
      c,
      fetch(`/api/frames?start=${c * meta.chunk_size}`)
        .then((r) => r.json())
        .then((data) => {
          chunks.set(c, data.frames);
          draw();
        })
        .catch(() => loading.delete(c)) // allow a retry next time the frame is needed
    );
  }
  return loading.get(c);
}

function ensureLoaded(from, to) {
  const loads = [];
  for (let c = Math.floor(Math.max(0, from) / meta.chunk_size); c <= Math.floor(to / meta.chunk_size); c++) {
    loads.push(loadChunk(c));
  }
  return Promise.all(loads);
}

// ---------- Drawing ----------

// Pitch coordinates are meters with (0, 0) at the centre spot and y pointing up.
function toPx(x, y) {
  return [MARGIN + (x + meta.pitch_length / 2) * SCALE, MARGIN + (meta.pitch_width / 2 - y) * SCALE];
}

function drawPitch() {
  const L = meta.pitch_length;
  const W = meta.pitch_width;
  ctx.fillStyle = "#3a7d44";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "rgba(255,255,255,0.8)";
  ctx.lineWidth = 2;

  const rect = (x, y, w, h) => {
    const [px, py] = toPx(x, y + h);
    ctx.strokeRect(px, py, w * SCALE, h * SCALE);
  };
  const circle = (x, y, r, fill) => {
    const [px, py] = toPx(x, y);
    ctx.beginPath();
    ctx.arc(px, py, r * SCALE, 0, Math.PI * 2);
    fill ? ctx.fill() : ctx.stroke();
  };

  rect(-L / 2, -W / 2, L, W);
  ctx.beginPath();
  ctx.moveTo(...toPx(0, W / 2));
  ctx.lineTo(...toPx(0, -W / 2));
  ctx.stroke();
  circle(0, 0, 9.15);
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  circle(0, 0, 0.3, true);
  for (const side of [-1, 1]) {
    const goalLine = (side * L) / 2;
    rect(side < 0 ? goalLine : goalLine - 16.5, -20.16, 16.5, 40.32); // penalty area
    rect(side < 0 ? goalLine : goalLine - 5.5, -9.16, 5.5, 18.32); // goal area
    rect(side < 0 ? goalLine - 2 : goalLine, -3.66, 2, 7.32); // goal
    circle(goalLine - side * 11, 0, 0.3, true); // penalty spot
  }
}

function draw() {
  drawPitch();
  const frame = getFrame(current);
  clock.textContent = formatTime(frame);
  if (!frame) {
    ctx.fillStyle = "#fff";
    ctx.font = "24px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("Loading...", canvas.width / 2, canvas.height / 2);
    return;
  }
  const [, , ball, people] = frame;

  if (trailsToggle.checked) drawTrails(frame);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "bold 11px system-ui";
  for (const [id, x, y] of people) {
    const player = meta.players[id];
    if (!player) continue;
    const [px, py] = toPx(x, y);
    ctx.beginPath();
    ctx.arc(px, py, 10, 0, Math.PI * 2);
    ctx.fillStyle = meta[`${player.team}_color`];
    ctx.fill();
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = meta[`${player.team}_number_color`];
    ctx.fillText(player.number, px, py + 1);
  }

  if (ball) {
    const [px, py] = toPx(ball[0], ball[1]);
    ctx.beginPath();
    ctx.arc(px, py, 5, 0, Math.PI * 2);
    ctx.fillStyle = "#ffeb3b";
    ctx.fill();
    ctx.strokeStyle = "#000";
    ctx.stroke();
  }

  // Downloaded videos are watched outside the app, so stamp the context into them
  if (recording) {
    ctx.fillStyle = "#fff";
    ctx.font = "bold 14px system-ui";
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillText(`${meta.title}  ·  ${recording.clip.name}`, MARGIN, MARGIN / 2);
    ctx.textAlign = "right";
    ctx.fillText(formatTime(frame), canvas.width - MARGIN, MARGIN / 2);
  }
}

// Draw each player's path over the last TRAIL_SECONDS, fading out with age.
function drawTrails(frame) {
  const length = TRAIL_SECONDS * meta.fps;
  const paths = new Map(); // player id -> [[x, y] or null (gap)], oldest first
  for (let i = Math.max(0, current - length); i <= current; i++) {
    const past = getFrame(i);
    if (!past || past[1] !== frame[1]) continue; // not loaded yet, or the other half
    for (const [id, x, y] of past[3]) {
      if (!paths.has(id)) paths.set(id, []);
      paths.get(id)[i - (current - length)] = [x, y];
    }
  }

  ctx.lineWidth = 3;
  ctx.lineCap = "butt"; // round caps overlap between segments and look beaded
  for (const [id, points] of paths) {
    const player = meta.players[id];
    if (!player) continue;
    ctx.strokeStyle = meta[`${player.team}_color`];
    for (let k = 1; k < points.length; k++) {
      const a = points[k - 1];
      const b = points[k];
      // Skip gaps and jumps no player could run in 0.1s (tracking glitches)
      if (!a || !b || Math.hypot(b[0] - a[0], b[1] - a[1]) > MAX_STEP_METERS) continue;
      ctx.globalAlpha = (k / points.length) * 0.8;
      ctx.beginPath();
      ctx.moveTo(...toPx(a[0], a[1]));
      ctx.lineTo(...toPx(b[0], b[1]));
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}

trailsToggle.onchange = () => draw();

// SkillCorner timestamps look like "00:12:34.50" (match clock; the 2nd half starts at 45:00).
function formatTime(frame) {
  if (!frame || !frame[0]) return "--:--";
  const [h, m, s] = frame[0].split(":");
  const minutes = String(Number(h) * 60 + Number(m)).padStart(2, "0");
  const half = frame[1] === 1 ? "1st half" : frame[1] === 2 ? "2nd half" : `Period ${frame[1]}`;
  return `${half} ${minutes}:${s.slice(0, 2)}`;
}

function frameLabel(i) {
  const time = formatTime(getFrame(i));
  return time === "--:--" ? `frame ${i}` : time;
}

// ---------- Playback ----------

function seek(i) {
  current = Math.max(0, Math.min(i, meta.num_frames - 1));
  slider.value = current;
  draw();
}

function play() {
  if (activeClip && current >= activeClip.end) seek(activeClip.start);
  playBtn.textContent = "Pause";
  timer = setInterval(() => {
    if (!getFrame(current + 1)) return; // wait for data to load
    seek(current + 1);
    const atEnd = activeClip ? current >= activeClip.end : current >= meta.num_frames - 1;
    if (atEnd) pause();
  }, 1000 / meta.fps);
}

function pause() {
  clearInterval(timer);
  timer = null;
  playBtn.textContent = "Play";
  if (recording && recording.recorder.state === "recording") {
    const { recorder } = recording;
    setTimeout(() => recorder.stop(), 300); // hold the last frame so it makes it into the video
  }
}

playBtn.onclick = () => (timer ? pause() : play());

slider.oninput = () => {
  const i = Number(slider.value);
  if (activeClip && (i < activeClip.start || i > activeClip.end)) setActiveClip(null);
  seek(i);
};

// ---------- Event timeline ----------

const LANES = [
  { label: "Shots & goals", types: ["shot", "goal"], color: "#2a78d6" },
  { label: "Ball won", types: ["won"], color: "#1baf7a" },
  { label: "Ball lost", types: ["lost"], color: "#eb6834" },
  { label: "Dangerous runs", types: ["run"], color: "#4a3aa7" },
];
const LEAD_IN_SECONDS = 5; // jump a little before the event so you see the build-up

function buildTimeline() {
  const timeline = document.getElementById("timeline");
  const tooltip = document.getElementById("tooltip");
  for (const lane of LANES) {
    const events = meta.events.filter((e) => lane.types.includes(e.type));
    if (!events.length) continue;

    const row = document.createElement("div");
    row.className = "lane-row";
    row.innerHTML = `<span class="lane-label"></span><div class="lane"></div><span class="lane-spacer"></span>`;
    row.querySelector(".lane-label").textContent = `${lane.label} (${events.length})`;
    const track = row.querySelector(".lane");

    for (const event of events) {
      const marker = document.createElement("button");
      marker.className = `marker ${event.type}`;
      marker.style.left = `${(event.frame / (meta.num_frames - 1)) * 100}%`;
      marker.style.setProperty("--color", lane.color);
      marker.setAttribute("aria-label", event.label);
      marker.onclick = () => {
        pause();
        setActiveClip(null);
        seek(event.frame - LEAD_IN_SECONDS * meta.fps);
        play();
      };
      marker.onmouseenter = marker.onfocus = () => {
        const box = marker.getBoundingClientRect();
        tooltip.textContent = event.label;
        tooltip.style.left = `${box.left + box.width / 2}px`;
        tooltip.style.top = `${box.top - 4}px`;
        tooltip.hidden = false;
      };
      marker.onmouseleave = marker.onblur = () => (tooltip.hidden = true);
      track.append(marker);
    }
    timeline.append(row);
  }
}

// ---------- Clipping ----------

function updateClipRange() {
  message.textContent = "";
  if (clipStart === null && clipEnd === null) {
    clipRange.textContent = "No clip selected";
  } else {
    const startText = clipStart === null ? "?" : frameLabel(clipStart);
    const endText = clipEnd === null ? "?" : frameLabel(clipEnd);
    clipRange.textContent = `${startText} → ${endText}`;
  }

  let valid = clipStart !== null && clipEnd !== null;
  if (valid && clipEnd <= clipStart) {
    message.textContent = "Clip end must be after clip start.";
    valid = false;
  } else if (valid && clipEnd - clipStart > meta.max_clip_frames) {
    message.textContent = `Clips can be at most ${meta.max_clip_frames / meta.fps} seconds long.`;
    valid = false;
  } else if (valid) {
    clipRange.textContent += ` (${((clipEnd - clipStart) / meta.fps).toFixed(1)}s)`;
  }
  saveBtn.disabled = !valid;
}

document.getElementById("mark-in").onclick = () => {
  clipStart = current;
  updateClipRange();
};

document.getElementById("mark-out").onclick = () => {
  clipEnd = current;
  updateClipRange();
};

saveBtn.onclick = async () => {
  const res = await fetch("/api/clips", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: clipName.value, start: clipStart, end: clipEnd }),
  });
  if (!res.ok) {
    message.textContent = "Could not save clip.";
    return;
  }
  clipStart = clipEnd = null;
  clipName.value = "";
  updateClipRange();
  await loadClips();
};

// ---------- Clip list / sharing ----------

function clipLink(clip) {
  return `${location.origin}/?clip=${clip.id}`;
}

function setActiveClip(clip) {
  activeClip = clip;
  nowPlaying.textContent = clip ? `Watching: ${clip.name}` : "";
}

function watchClip(clip) {
  pause();
  setActiveClip(clip);
  seek(clip.start);
  play();
}

async function copyLink(clip, button) {
  const link = clipLink(clip);
  try {
    await navigator.clipboard.writeText(link);
    button.textContent = "Copied!";
    setTimeout(() => (button.textContent = "Copy link"), 1500);
  } catch {
    window.prompt("Copy this link:", link); // clipboard API needs https or localhost
  }
}

// MP4 first (plays in PowerPoint, WhatsApp, phones); WebM where the browser can't record MP4
const VIDEO_TYPES = ["video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9", "video/webm"];

// Record the clip by playing it on the pitch canvas, then save it as a video file.
async function downloadClip(clip, button) {
  if (recording) return;
  const mimeType = window.MediaRecorder && VIDEO_TYPES.find((t) => MediaRecorder.isTypeSupported(t));
  if (!mimeType) {
    message.textContent = "This browser can't record video. Try Chrome, Edge or Firefox.";
    return;
  }

  button.textContent = "Preparing...";
  // Load every frame the clip and its trails need first, so the video doesn't stall
  await ensureLoaded(clip.start - TRAIL_SECONDS * meta.fps, clip.end);
  pause();
  setActiveClip(clip);
  seek(clip.start);

  const recorder = new MediaRecorder(canvas.captureStream(30), { mimeType });
  const parts = [];
  recorder.ondataavailable = (e) => parts.push(e.data);
  recorder.onstop = () => {
    const url = URL.createObjectURL(new Blob(parts, { type: mimeType }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${clip.name.replace(/[^\w\- ]+/g, "").trim() || "clip"}.${mimeType.includes("mp4") ? "mp4" : "webm"}`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    recording = null;
    document.body.classList.remove("recording");
    slider.disabled = playBtn.disabled = false;
    button.textContent = "Download";
    setActiveClip(clip);
    draw(); // remove the caption from the on-screen pitch
  };

  recording = { recorder, clip };
  document.body.classList.add("recording");
  slider.disabled = playBtn.disabled = true; // scrubbing mid-recording would ruin the video
  button.textContent = "Recording...";
  nowPlaying.textContent = `Recording: ${clip.name} (keep this tab open)`;
  recorder.start();
  draw();
  play(); // pause() at the clip's end stops the recorder
}

async function loadClips() {
  clips = await (await fetch("/api/clips")).json();
  clipList.innerHTML = "";
  if (!clips.length) clipList.innerHTML = "<li>No clips yet.</li>";
  for (const clip of clips) {
    const li = document.createElement("li");
    const seconds = ((clip.end - clip.start) / meta.fps).toFixed(1);
    li.innerHTML = `<strong></strong><div class="time">frames ${clip.start}–${clip.end} (${seconds}s)</div>`;
    li.querySelector("strong").textContent = clip.name;

    const watchBtn = document.createElement("button");
    watchBtn.textContent = "Watch";
    watchBtn.onclick = () => watchClip(clip);
    const copyBtn = document.createElement("button");
    copyBtn.textContent = "Copy link";
    copyBtn.onclick = () => copyLink(clip, copyBtn);
    const downloadBtn = document.createElement("button");
    downloadBtn.textContent = "Download";
    downloadBtn.onclick = () => downloadClip(clip, downloadBtn);
    li.append(watchBtn, copyBtn, downloadBtn);
    clipList.append(li);
  }
}

// ---------- Startup ----------

async function init() {
  meta = await (await fetch("/api/match")).json();
  document.getElementById("title").textContent = meta.title;
  canvas.width = meta.pitch_length * SCALE + MARGIN * 2;
  canvas.height = meta.pitch_width * SCALE + MARGIN * 2;
  slider.max = meta.num_frames - 1;
  buildTimeline();

  await loadClips();
  const sharedId = new URLSearchParams(location.search).get("clip");
  const shared = clips.find((c) => c.id === sharedId);
  if (shared) watchClip(shared);
  else seek(0);
}

init();
