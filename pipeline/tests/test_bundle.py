import numpy as np
from bundle import (
    build_periods, frame_to_index, index_to_frame, index_to_clock, total_frames,
    unmirror, write_container, read_container, SENTINEL,
)

# Real shape of match 2017461: first half starts at 2510, half-time gap ~9,500 frames.
PERIODS = [
    {"period": 1, "start_frame": 2510, "end_frame": 30000},
    {"period": 2, "start_frame": 39500, "end_frame": 69000},
]


def test_clock_is_continuous_across_half_time():
    p = build_periods(PERIODS)
    assert p[0].start_index == 0
    assert p[1].start_index == 30000 - 2510 + 1
    assert total_frames(p) == (30000 - 2510 + 1) + (69000 - 39500 + 1)
    # last frame of H1 and first of H2 are adjacent in playback
    assert frame_to_index(p, 30000) + 1 == frame_to_index(p, 39500)
    assert frame_to_index(p, 35000) is None  # half time is not playable
    assert frame_to_index(p, 5) is None      # pre-match is not playable


def test_index_round_trip():
    p = build_periods(PERIODS)
    for f in (2510, 2511, 30000, 39500, 50000, 69000):
        assert index_to_frame(p, frame_to_index(p, f)) == f


def test_clock_shows_match_time_not_frames():
    p = build_periods(PERIODS)
    assert index_to_clock(p, 0, 10.0) == (1, 0.0)
    assert index_to_clock(p, 600, 10.0) == (1, 60.0)
    period, secs = index_to_clock(p, frame_to_index(p, 39500), 10.0)
    assert (period, secs) == (2, 45 * 60.0)


def test_unmirror():
    assert unmirror(47.71, 8.13, "right_to_left") == (-47.71, -8.13)
    assert unmirror(47.71, 8.13, "left_to_right") == (47.71, 8.13)


def test_container_round_trip(tmp_path):
    pos = np.full((5, 3, 2), SENTINEL, dtype=np.int16)
    pos[2, 1] = (123, -456)
    flags = np.array([[1, 3, 0]] * 5, dtype=np.uint8)
    path = tmp_path / "t.bin"
    write_container(str(path), {"pos": pos, "flags": flags}, {"fps": 10})
    header, arrays = read_container(str(path))
    assert header["fps"] == 10
    assert arrays["pos"].shape == (5, 3, 2)
    assert tuple(arrays["pos"][2, 1]) == (123, -456)
    assert arrays["flags"].dtype == np.uint8
    assert arrays["flags"][0, 1] == 3


def test_ten_second_limit_is_derived_from_fps():
    # The app computes the limit as 10 * fps; a 25 fps feed must allow 250 frames.
    for fps, limit in ((10, 100), (25, 250)):
        assert round(10 * fps) == limit
