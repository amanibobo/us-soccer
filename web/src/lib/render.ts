import { SENTINEL, type MatchData } from "./types";

export interface RenderOptions {
  cameraOverlay: boolean;
  trails: boolean;
  names: boolean;
  selectedSlot: number | null;
  /** slot -> highlight color for any extra emphasis (e.g. event player) */
  highlight?: Map<number, string>;
}

export interface Transform {
  /** pixels per metre */
  scale: number;
  /** canvas pixel of pitch centre */
  cx: number;
  cy: number;
  width: number;
  height: number;
}

const PITCH_GREEN = "#5d9a6b";
const LINE = "rgba(255,255,255,0.85)";

export function fitTransform(width: number, height: number, length: number, widthM: number, padM = 4): Transform {
  const scale = Math.min(width / (length + padM * 2), height / (widthM + padM * 2));
  return { scale, cx: width / 2, cy: height / 2, width, height };
}

export function toPx(t: Transform, xm: number, ym: number): [number, number] {
  // y positive is the far side of the pitch, drawn at the top
  return [t.cx + xm * t.scale, t.cy - ym * t.scale];
}

export function toMetres(t: Transform, px: number, py: number): [number, number] {
  return [(px - t.cx) / t.scale, (t.cy - py) / t.scale];
}

function luminance(hex: string): number {
  const h = hex.replace("#", "");
  if (h.length < 6) return 0.5;
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function drawPitch(ctx: CanvasRenderingContext2D, t: Transform, L: number, W: number) {
  const [x0, y0] = toPx(t, -L / 2, W / 2);
  const [x1, y1] = toPx(t, L / 2, -W / 2);
  ctx.fillStyle = PITCH_GREEN;
  ctx.fillRect(0, 0, t.width, t.height);
  // mowing stripes for depth
  const stripes = 10;
  for (let i = 0; i < stripes; i++) {
    if (i % 2 === 0) continue;
    const sx0 = x0 + ((x1 - x0) * i) / stripes;
    const sx1 = x0 + ((x1 - x0) * (i + 1)) / stripes;
    ctx.fillStyle = "rgba(255,255,255,0.045)";
    ctx.fillRect(sx0, y0, sx1 - sx0, y1 - y0);
  }
  ctx.strokeStyle = LINE;
  ctx.lineWidth = Math.max(1, t.scale * 0.12);
  ctx.lineJoin = "round";
  // outline + halfway
  ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
  ctx.beginPath();
  ctx.moveTo(t.cx, y0);
  ctx.lineTo(t.cx, y1);
  ctx.stroke();
  // centre circle + spot
  ctx.beginPath();
  ctx.arc(t.cx, t.cy, 9.15 * t.scale, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(t.cx, t.cy, Math.max(1.5, t.scale * 0.25), 0, Math.PI * 2);
  ctx.fillStyle = LINE;
  ctx.fill();

  for (const side of [-1, 1]) {
    const gx = (side * L) / 2;
    // penalty box 16.5 x 40.32
    const [bx, by] = toPx(t, gx - side * 16.5, 20.16);
    const bw = 16.5 * t.scale * side;
    ctx.strokeRect(Math.min(bx, bx + bw), by, Math.abs(bw), 40.32 * t.scale);
    // six-yard box 5.5 x 18.32
    const [sx, sy] = toPx(t, gx - side * 5.5, 9.16);
    const sw = 5.5 * t.scale * side;
    ctx.strokeRect(Math.min(sx, sx + sw), sy, Math.abs(sw), 18.32 * t.scale);
    // penalty spot
    const [px, py] = toPx(t, gx - side * 11, 0);
    ctx.beginPath();
    ctx.arc(px, py, Math.max(1.5, t.scale * 0.25), 0, Math.PI * 2);
    ctx.fill();
    // penalty arc
    ctx.beginPath();
    const a = Math.acos(5.5 / 9.15);
    if (side === -1) ctx.arc(px, py, 9.15 * t.scale, -a, a);
    else ctx.arc(px, py, 9.15 * t.scale, Math.PI - a, Math.PI + a);
    ctx.stroke();
    // goal 7.32 wide, 2 deep
    const [gx0, gy0] = toPx(t, gx, 3.66);
    ctx.strokeRect(side === -1 ? gx0 - 2 * t.scale : gx0, gy0, 2 * t.scale, 7.32 * t.scale);
  }
}

interface Interp {
  x: number;
  y: number;
  present: boolean;
  detected: boolean;
}

/** Interpolated player position at fractional index. Reuses the passed object. */
function playerAt(m: MatchData, time: number, slot: number, out: Interp): Interp {
  const n = m.meta.n_frames;
  const i0 = Math.min(n - 1, Math.max(0, Math.floor(time)));
  const i1 = Math.min(n - 1, i0 + 1);
  const a = time - i0;
  const S = m.nSlots;
  const f0 = m.flags[i0 * S + slot];
  const f1 = m.flags[i1 * S + slot];
  const p0 = (f0 & 1) === 1;
  const p1 = (f1 & 1) === 1;
  const b0 = (i0 * S + slot) * 2;
  const b1 = (i1 * S + slot) * 2;
  if (p0 && p1) {
    out.x = (m.pos[b0] + (m.pos[b1] - m.pos[b0]) * a) / 100;
    out.y = (m.pos[b0 + 1] + (m.pos[b1 + 1] - m.pos[b0 + 1]) * a) / 100;
    out.present = true;
    out.detected = (a < 0.5 ? f0 & 2 : f1 & 2) !== 0;
  } else if (p0 || p1) {
    const b = p0 ? b0 : b1;
    out.x = m.pos[b] / 100;
    out.y = m.pos[b + 1] / 100;
    out.present = true;
    out.detected = ((p0 ? f0 : f1) & 2) !== 0;
  } else {
    out.present = false;
    out.detected = false;
  }
  return out;
}

export function ballAt(m: MatchData, time: number): { x: number; y: number; z: number; present: boolean; detected: boolean } {
  const n = m.meta.n_frames;
  const i0 = Math.min(n - 1, Math.max(0, Math.floor(time)));
  const i1 = Math.min(n - 1, i0 + 1);
  const a = time - i0;
  const p0 = m.ball[i0 * 4] !== SENTINEL;
  const p1 = m.ball[i1 * 4] !== SENTINEL;
  if (p0 && p1) {
    return {
      x: (m.ball[i0 * 4] + (m.ball[i1 * 4] - m.ball[i0 * 4]) * a) / 100,
      y: (m.ball[i0 * 4 + 1] + (m.ball[i1 * 4 + 1] - m.ball[i0 * 4 + 1]) * a) / 100,
      z: (m.ball[i0 * 4 + 2] + (m.ball[i1 * 4 + 2] - m.ball[i0 * 4 + 2]) * a) / 100,
      present: true,
      detected: m.ball[i0 * 4 + 3] === 1,
    };
  }
  if (p0 || p1) {
    const i = p0 ? i0 : i1;
    return { x: m.ball[i * 4] / 100, y: m.ball[i * 4 + 1] / 100, z: m.ball[i * 4 + 2] / 100, present: true, detected: m.ball[i * 4 + 3] === 1 };
  }
  return { x: 0, y: 0, z: 0, present: false, detected: false };
}

/** Slot nearest to a pitch point, within radius metres. */
export function slotAt(m: MatchData, time: number, xm: number, ym: number, radiusM: number): number | null {
  const tmp: Interp = { x: 0, y: 0, present: false, detected: false };
  let best: number | null = null;
  let bestD = radiusM * radiusM;
  for (let s = 0; s < m.nSlots; s++) {
    playerAt(m, time, s, tmp);
    if (!tmp.present) continue;
    const d = (tmp.x - xm) ** 2 + (tmp.y - ym) ** 2;
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return best;
}

export function drawCamera(ctx: CanvasRenderingContext2D, t: Transform, m: MatchData, time: number) {
  const i = Math.min(m.meta.n_frames - 1, Math.max(0, Math.round(time)));
  const c = m.cam.subarray(i * 8, i * 8 + 8);
  if (c[0] === SENTINEL) return;
  ctx.save();
  // Everything outside the camera polygon is dimmed.
  ctx.beginPath();
  ctx.rect(0, 0, t.width, t.height);
  const poly = [
    toPx(t, c[0] / 10, c[1] / 10),
    toPx(t, c[2] / 10, c[3] / 10),
    toPx(t, c[4] / 10, c[5] / 10),
    toPx(t, c[6] / 10, c[7] / 10),
  ];
  ctx.moveTo(poly[0][0], poly[0][1]);
  for (let k = 1; k < 4; k++) ctx.lineTo(poly[k][0], poly[k][1]);
  ctx.closePath();
  ctx.fillStyle = "rgba(15, 23, 42, 0.45)";
  ctx.fill("evenodd");
  ctx.beginPath();
  ctx.moveTo(poly[0][0], poly[0][1]);
  for (let k = 1; k < 4; k++) ctx.lineTo(poly[k][0], poly[k][1]);
  ctx.closePath();
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.setLineDash([6, 4]);
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

export function drawScene(ctx: CanvasRenderingContext2D, t: Transform, m: MatchData, time: number, o: RenderOptions) {
  const { meta } = m;
  drawPitch(ctx, t, meta.pitch.length, meta.pitch.width);

  const i = Math.min(meta.n_frames - 1, Math.max(0, Math.floor(time)));
  if (!m.hasPlayers[i]) {
    // Nothing to draw: the broadcast was not showing the pitch.
    return { noTracking: true };
  }

  if (o.cameraOverlay) drawCamera(ctx, t, m, time);

  const r = Math.max(7, Math.min(13, t.scale * 1.15));
  const tmp: Interp = { x: 0, y: 0, present: false, detected: false };
  const possSlot = m.frame[i * 3 + 1];
  const fps = meta.fps;

  // trails (last 3 s) for the selected player, or everyone if the overlay is on
  if (o.trails || o.selectedSlot != null) {
    const slots = o.trails ? [...Array(m.nSlots).keys()] : [o.selectedSlot as number];
    ctx.lineWidth = 2;
    for (const s of slots) {
      const p = meta.players[s];
      ctx.strokeStyle = p.team === "home" ? meta.home.color : meta.away.color;
      ctx.beginPath();
      let started = false;
      for (let k = Math.max(0, i - 3 * fps); k <= i; k++) {
        playerAt(m, k, s, tmp);
        if (!tmp.present) {
          started = false;
          continue;
        }
        const [px, py] = toPx(t, tmp.x, tmp.y);
        if (!started) {
          ctx.moveTo(px, py);
          started = true;
        } else ctx.lineTo(px, py);
      }
      ctx.globalAlpha = 0.9;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  // players
  ctx.font = `600 ${Math.round(r * 1.05)}px ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let s = 0; s < m.nSlots; s++) {
    playerAt(m, time, s, tmp);
    if (!tmp.present) continue;
    const p = meta.players[s];
    const team = p.team === "home" ? meta.home : meta.away;
    const [px, py] = toPx(t, tmp.x, tmp.y);
    const dark = luminance(team.color) < 0.45;
    const faded = !tmp.detected;

    ctx.globalAlpha = faded ? 0.5 : 1;
    if (s === possSlot) {
      ctx.beginPath();
      ctx.arc(px, py, r + 4, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.fill();
    }
    if (s === o.selectedSlot) {
      ctx.beginPath();
      ctx.arc(px, py, r + 5, 0, Math.PI * 2);
      ctx.strokeStyle = "#facc15";
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fillStyle = team.color;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = dark ? "rgba(255,255,255,0.9)" : "rgba(0,0,0,0.55)";
    if (faded) ctx.setLineDash([3, 2]);
    ctx.stroke();
    ctx.setLineDash([]);
    if (p.team === "away") {
      // away players get an inner ring so the two teams differ by shape, not only color
      ctx.beginPath();
      ctx.arc(px, py, r * 0.62, 0, Math.PI * 2);
      ctx.strokeStyle = dark ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.5)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.fillStyle = team.number_color;
    ctx.fillText(p.number != null ? String(p.number) : "", px, py + 0.5);
    if (o.names || s === o.selectedSlot) {
      ctx.font = `500 ${Math.round(r * 0.95)}px ui-sans-serif, system-ui, sans-serif`;
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.strokeStyle = "rgba(0,0,0,0.5)";
      ctx.lineWidth = 3;
      ctx.lineJoin = "round";
      ctx.strokeText(p.short_name, px, py + r + 9);
      ctx.fillText(p.short_name, px, py + r + 9);
      ctx.font = `600 ${Math.round(r * 1.05)}px ui-sans-serif, system-ui, sans-serif`;
    }
    ctx.globalAlpha = 1;
  }

  // ball
  const b = ballAt(m, time);
  if (b.present) {
    const [bx, by] = toPx(t, b.x, b.y);
    const lift = Math.min(b.z, 6) * t.scale * 0.35;
    const br = Math.max(4, r * 0.5);
    ctx.globalAlpha = b.detected ? 1 : 0.6;
    ctx.beginPath();
    ctx.ellipse(bx, by, br * 0.9, br * 0.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(bx, by - lift, br, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "#111827";
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  return { noTracking: false };
}
