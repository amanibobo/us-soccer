"""Fetch freely licensed player headshots from Wikimedia Commons via Wikidata.

Usage: python headshots.py <bundle dir or match.json>... --out ../web/public/players

For each rostered player we search Wikidata by name, keep only entities whose
occupation is "association football player", and download the P18 image at
256 px. Coverage is partial (many A-League players have no photo); the app
falls back to an initials avatar. Writes players.json with credits.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

import requests

UA = "larpers/0.1 (student project; https://github.com/amanibobo/us-soccer)"
S = requests.Session()
S.headers["User-Agent"] = UA
FOOTBALLER = "Q937857"


def wd(params: dict) -> dict:
    r = S.get("https://www.wikidata.org/w/api.php", params={**params, "format": "json"}, timeout=30)
    r.raise_for_status()
    return r.json()


def find_player(name: str) -> dict | None:
    res = wd({"action": "wbsearchentities", "search": name, "language": "en", "type": "item", "limit": 5})
    ids = [h["id"] for h in res.get("search", [])]
    if not ids:
        return None
    ents = wd({"action": "wbgetentities", "ids": "|".join(ids), "props": "claims|labels|descriptions"})["entities"]
    for qid in ids:
        e = ents.get(qid, {})
        claims = e.get("claims", {})
        occ = [c["mainsnak"]["datavalue"]["value"]["id"] for c in claims.get("P106", []) if "datavalue" in c["mainsnak"]]
        if FOOTBALLER not in occ:
            continue
        imgs = [c["mainsnak"]["datavalue"]["value"] for c in claims.get("P18", []) if "datavalue" in c["mainsnak"]]
        if not imgs:
            return None
        return {"qid": qid, "file": imgs[0], "label": e.get("labels", {}).get("en", {}).get("value", name)}
    return None


def commons_info(filename: str) -> dict | None:
    r = S.get(
        "https://commons.wikimedia.org/w/api.php",
        params={
            "action": "query",
            "titles": f"File:{filename}",
            "prop": "imageinfo",
            "iiprop": "url|extmetadata",
            "iiurlwidth": 256,
            "format": "json",
        },
        timeout=30,
    )
    r.raise_for_status()
    pages = r.json()["query"]["pages"]
    info = next(iter(pages.values())).get("imageinfo")
    if not info:
        return None
    ii = info[0]
    meta = ii.get("extmetadata", {})
    return {
        "thumb": ii.get("thumburl"),
        "page": ii.get("descriptionurl"),
        "author": strip_html(meta.get("Artist", {}).get("value", "")),
        "license": meta.get("LicenseShortName", {}).get("value", ""),
    }


def strip_html(s: str) -> str:
    import re

    return re.sub(r"<[^>]+>", "", s).strip()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("sources", nargs="+", help="bundle meta.json files")
    ap.add_argument("--out", required=True)
    ap.add_argument("--index", required=True, help="players.json the app imports")
    args = ap.parse_args()
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    index_path = Path(args.index)
    index_path.parent.mkdir(parents=True, exist_ok=True)
    index = json.loads(index_path.read_text()) if index_path.exists() else {}

    players: dict[int, str] = {}
    for src in args.sources:
        m = json.loads(Path(src).read_text())
        for p in m["players"]:
            players[p["id"]] = p["name"]

    found = 0
    for pid, name in players.items():
        if str(pid) in index:
            found += 1
            continue
        try:
            hit = find_player(name)
            if not hit:
                print(f"  - {name}: no photo")
                continue
            info = commons_info(hit["file"])
            if not info or not info["thumb"]:
                print(f"  - {name}: file missing")
                continue
            ext = ".jpg" if not info["thumb"].lower().endswith(".png") else ".png"
            dest = out / f"{pid}{ext}"
            img = S.get(info["thumb"], timeout=60)
            img.raise_for_status()
            dest.write_bytes(img.content)
            index[str(pid)] = {"file": f"/players/{dest.name}", "author": info["author"], "license": info["license"], "page": info["page"]}
            found += 1
            print(f"  + {name}: {info['license']} by {info['author'][:40]}")
            time.sleep(0.3)
        except Exception as e:  # noqa: BLE001
            print(f"  ! {name}: {e}")
    index_path.write_text(json.dumps(index, indent=1))
    print(f"{found}/{len(players)} players have a photo. Index: {index_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
