"""Fetch club crests from Wikipedia for every team in the built bundles.

Usage: python crests.py <meta.json>... --out ../web/public/logos --index ../web/src/config/logos.json

For each team we look up its Wikipedia article, take the first image whose
name looks like a logo or crest, and download a 256 px PNG. Crests belong to
the clubs; the app uses them only to identify the teams. Teams without a hit
keep the monogram badge.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

import requests

UA = "larpers/0.1 (student project; https://github.com/amanibobo/us-soccer)"
S = requests.Session()
S.headers["User-Agent"] = UA
API = "https://en.wikipedia.org/w/api.php"

# Names in the data that do not match the article title directly.
ALIASES = {
    "Melbourne V FC": "Melbourne Victory FC",
    "Melbourne Victory Football Club": "Melbourne Victory FC",
    "CC Mariners": "Central Coast Mariners FC",
    "Central Coast Mariners Football Club": "Central Coast Mariners FC",
    "Wellington P FC": "Wellington Phoenix FC",
    "Western Sydney": "Western Sydney Wanderers FC",
    "Western Sydney Wanderers FC": "Western Sydney Wanderers FC",
    "Brisbane FC": "Brisbane Roar FC",
    "Newcastle": "Newcastle Jets FC",
    "Western United": "Western United FC",
    "Sydney Football Club": "Sydney FC",
    "Adelaide United Football Club": "Adelaide United FC",
    "Perth Glory Football Club": "Perth Glory FC",
}

STOP = {"fc", "football", "club", "united", "city", "the", "afc"}


def keywords(name: str) -> list[str]:
    return [w for w in re.split(r"[^a-z]+", name.lower()) if w and w not in STOP]


def api(params: dict) -> dict:
    r = S.get(API, params={**params, "format": "json"}, timeout=30)
    r.raise_for_status()
    return r.json()


def find_article(name: str) -> str | None:
    q = ALIASES.get(name, name)
    # exact title first (follows redirects), then search
    res = api({"action": "query", "titles": q, "redirects": 1})
    page = next(iter(res["query"]["pages"].values()))
    if "missing" not in page:
        return page["title"]
    res = api({"action": "query", "list": "search", "srsearch": f"{q} football club", "srlimit": 3})
    hits = res.get("query", {}).get("search", [])
    return hits[0]["title"] if hits else None


def find_logo_file(title: str, name: str) -> str | None:
    res = api({"action": "query", "titles": title, "prop": "images", "imlimit": 100})
    page = next(iter(res["query"]["pages"].values()))
    names = [i["title"] for i in page.get("images", [])]
    keys = keywords(ALIASES.get(name, name))
    # the file name must mention the club and look like a crest
    good = [
        n for n in names
        if any(k in n.lower() for k in keys)
        and re.search(r"logo|crest|badge|\.svg$", n, re.I)
        and not re.search(r"commons-logo|wiki|icon|flag|symbol|edit|kit|pictogram|stadium|map", n, re.I)
    ]
    good.sort(key=lambda n: (not re.search(r"logo|crest|badge", n, re.I), len(n)))
    return good[0] if good else None


def thumb_url(file_title: str) -> str | None:
    res = api({"action": "query", "titles": file_title, "prop": "imageinfo", "iiprop": "url", "iiurlwidth": 256})
    page = next(iter(res["query"]["pages"].values()))
    info = page.get("imageinfo")
    return info[0].get("thumburl") if info else None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("sources", nargs="+")
    ap.add_argument("--out", required=True)
    ap.add_argument("--index", required=True)
    args = ap.parse_args()
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    index_path = Path(args.index)
    index = json.loads(index_path.read_text()) if index_path.exists() else {}

    teams: dict[int, str] = {}
    for src in args.sources:
        m = json.loads(Path(src).read_text())
        for side in ("home", "away"):
            teams[m[side]["id"]] = m[side]["name"] or m[side]["short_name"]

    for tid, name in teams.items():
        dest = out / f"{tid}.png"
        if dest.exists():
            index.setdefault(str(tid), f"/logos/{tid}.png")
            print(f"  = {name}: already have it")
            continue
        try:
            title = find_article(name)
            f = find_logo_file(title, name) if title else None
            url = thumb_url(f) if f else None
            if not url:
                print(f"  - {name}: no crest found ({title})")
                continue
            dest.write_bytes(S.get(url, timeout=60).content)
            index[str(tid)] = f"/logos/{tid}.png"
            print(f"  + {name}: {f} (from '{title}')")
        except Exception as e:  # noqa: BLE001
            print(f"  ! {name}: {e}")
    index_path.write_text(json.dumps(index, indent=1, sort_keys=True))
    print(f"{len(index)} crests. Index: {index_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
