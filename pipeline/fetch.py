"""Download the four SkillCorner open-data files for one match.

Usage: python fetch.py <match_id> --out <dir>

The tracking file lives in Git LFS, so it is fetched through GitHub's media
endpoint. If we still end up with an LFS pointer (a ~130 byte text file), we
stop and print the manual steps rather than silently building an empty bundle.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import requests

RAW = "https://raw.githubusercontent.com/SkillCorner/opendata/master/data/matches"
LFS = "https://media.githubusercontent.com/media/SkillCorner/opendata/master/data/matches"

FILES = {
    "match.json": RAW,
    "dynamic_events.csv": RAW,
    "phases_of_play.csv": RAW,
    "tracking_extrapolated.jsonl": LFS,
}


def is_lfs_pointer(path: Path) -> bool:
    if path.stat().st_size > 1024:
        return False
    head = path.read_bytes()[:64]
    return head.startswith(b"version https://git-lfs.github.com")


def download(url: str, dest: Path) -> None:
    with requests.get(url, stream=True, timeout=600) as r:
        r.raise_for_status()
        total = int(r.headers.get("content-length") or 0)
        done = 0
        with open(dest, "wb") as f:
            for chunk in r.iter_content(chunk_size=1 << 20):
                f.write(chunk)
                done += len(chunk)
                if total:
                    pct = 100 * done // total
                    print(f"\r  {dest.name}: {done / 1e6:6.1f} MB ({pct}%)", end="", flush=True)
        print(f"\r  {dest.name}: {done / 1e6:6.1f} MB          ")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("match_id")
    ap.add_argument("--out", required=True)
    ap.add_argument("--force", action="store_true", help="re-download files that already exist")
    args = ap.parse_args()

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    mid = args.match_id
    print(f"Fetching match {mid} into {out}")

    for suffix, base in FILES.items():
        dest = out / f"{mid}_{suffix}"
        if dest.exists() and not args.force and not is_lfs_pointer(dest):
            print(f"  {dest.name}: already present, skipping")
            continue
        download(f"{base}/{mid}/{mid}_{suffix}", dest)

    tracking = out / f"{mid}_tracking_extrapolated.jsonl"
    if is_lfs_pointer(tracking):
        print(
            "\nThe tracking file came back as a Git LFS pointer, not data.\n"
            "Download it manually and place it at:\n"
            f"  {tracking}\n"
            "Steps: open https://github.com/SkillCorner/opendata/tree/master/data/matches/"
            f"{mid} , click the tracking file, then 'Download raw file'.",
            file=sys.stderr,
        )
        return 1

    print("Done.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
