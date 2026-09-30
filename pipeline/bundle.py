"""Shared pieces of the larpers bundle format.

A bundle is a folder with three files:

  meta.json      teams, players (one slot each), pitch size, periods, gaps
  tracking.bin   one binary container holding several typed arrays (gzipped)
  events.json    dynamic events + phases of play, keyed by playback index

Playback index vs frame
-----------------------
SkillCorner frame numbers include pre-match and half-time frames. The app
works in *playback index*: a continuous 0..N-1 over frames that fall inside a
period. The mapping is stored in meta.json as one entry per period, so
index <-> frame is arithmetic, not a lookup table.
"""

from __future__ import annotations

import json
import struct
from dataclasses import dataclass, asdict

import numpy as np

FORMAT_VERSION = 1
SENTINEL = -32768  # int16 "no value"


# --------------------------------------------------------------------------- clock


@dataclass(frozen=True)
class Period:
    period: int
    start_frame: int
    end_frame: int  # inclusive
    start_index: int
    clock_offset_s: float  # match clock at start_frame (45:00 for period 2)

    @property
    def n_frames(self) -> int:
        return self.end_frame - self.start_frame + 1

    @property
    def end_index(self) -> int:
        return self.start_index + self.n_frames - 1


def build_periods(match_periods: list[dict]) -> list[Period]:
    """Turn SkillCorner match_periods into contiguous playback periods."""
    out: list[Period] = []
    idx = 0
    for p in sorted(match_periods, key=lambda p: p["period"]):
        n = p["period"]
        # Regulation halves start at 0 and 45 min; extra time at 90 and 105.
        offset_min = {1: 0, 2: 45, 3: 90, 4: 105}.get(n, 45 * (n - 1))
        per = Period(n, int(p["start_frame"]), int(p["end_frame"]), idx, offset_min * 60.0)
        out.append(per)
        idx += per.n_frames
    return out


def total_frames(periods: list[Period]) -> int:
    return sum(p.n_frames for p in periods)


def frame_to_index(periods: list[Period], frame: int) -> int | None:
    for p in periods:
        if p.start_frame <= frame <= p.end_frame:
            return p.start_index + (frame - p.start_frame)
    return None


def index_to_frame(periods: list[Period], index: int) -> int:
    for p in periods:
        if p.start_index <= index <= p.end_index:
            return p.start_frame + (index - p.start_index)
    raise IndexError(index)


def index_to_clock(periods: list[Period], index: int, fps: float) -> tuple[int, float]:
    """Return (period number, match-clock seconds) for a playback index."""
    for p in periods:
        if p.start_index <= index <= p.end_index:
            return p.period, p.clock_offset_s + (index - p.start_index) / fps
    raise IndexError(index)


# --------------------------------------------------------------------------- coords


def unmirror(x: float, y: float, attacking_side: str) -> tuple[float, float]:
    """Event files mirror coordinates so possession always attacks left->right.

    Verified against tracking: when attacking_side is right_to_left both axes
    are negated (event (47.71, 8.13) sits at tracking (-47.53, -8.14)).
    """
    if attacking_side == "right_to_left":
        return -x, -y
    return x, y


# --------------------------------------------------------------------------- binary container


def write_container(path: str, arrays: dict[str, np.ndarray], extra: dict | None = None) -> dict:
    """Write several numpy arrays into one file.

    Layout: uint32 LE header length, UTF-8 JSON header, then the raw array
    bytes back to back, each padded to a 4-byte boundary. The header lists
    dtype, shape and byte offset of every section so the browser can wrap
    the bytes in typed arrays without copying.
    """
    sections = []
    blobs = []
    offset = 0
    for name, arr in arrays.items():
        arr = np.ascontiguousarray(arr)
        if arr.dtype.byteorder not in ("<", "=", "|"):
            arr = arr.astype(arr.dtype.newbyteorder("<"))
        b = arr.tobytes()
        pad = (-len(b)) % 4
        sections.append(
            {
                "name": name,
                "dtype": str(arr.dtype),
                "shape": list(arr.shape),
                "offset": offset,
                "length": len(b),
            }
        )
        blobs.append(b + b"\0" * pad)
        offset += len(b) + pad
    header = {"format": FORMAT_VERSION, "sections": sections, **(extra or {})}
    hb = json.dumps(header, separators=(",", ":")).encode("utf-8")
    hb += b" " * ((-len(hb)) % 4)
    with open(path, "wb") as f:
        f.write(struct.pack("<I", len(hb)))
        f.write(hb)
        for b in blobs:
            f.write(b)
    return header


def read_container(path: str) -> tuple[dict, dict[str, np.ndarray]]:
    """Inverse of write_container, used by tests and the summary check."""
    with open(path, "rb") as f:
        (hlen,) = struct.unpack("<I", f.read(4))
        header = json.loads(f.read(hlen).decode("utf-8"))
        body = f.read()
    out = {}
    for s in header["sections"]:
        buf = body[s["offset"] : s["offset"] + s["length"]]
        out[s["name"]] = np.frombuffer(buf, dtype=np.dtype(s["dtype"])).reshape(s["shape"])
    return header, out


def periods_to_json(periods: list[Period]) -> list[dict]:
    return [
        {**asdict(p), "end_index": p.end_index, "n_frames": p.n_frames} for p in periods
    ]
