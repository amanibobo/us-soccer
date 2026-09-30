"""Download one match from SkillCorner open data into data/<match_id>/.

Usage: python download_data.py <match_id>
Match IDs are listed at https://github.com/SkillCorner/opendata/tree/master/data/matches
"""
import sys
import urllib.request
from pathlib import Path

RAW = "https://raw.githubusercontent.com/SkillCorner/opendata/master/data/matches"
LFS = "https://media.githubusercontent.com/media/SkillCorner/opendata/master/data/matches"

if len(sys.argv) != 2:
    sys.exit(__doc__)

match_id = sys.argv[1]
out_dir = Path(__file__).parent / "data" / match_id
out_dir.mkdir(parents=True, exist_ok=True)

files = [
    (f"{RAW}/{match_id}/{match_id}_match.json", f"{match_id}_match.json"),
    (f"{RAW}/{match_id}/{match_id}_dynamic_events.csv", f"{match_id}_dynamic_events.csv"),
    # The tracking file is stored in Git LFS, so it comes from the media host.
    (f"{LFS}/{match_id}/{match_id}_tracking_extrapolated.jsonl", f"{match_id}_tracking_extrapolated.jsonl"),
]
for url, name in files:
    print(f"Downloading {name}...")
    urllib.request.urlretrieve(url, out_dir / name)
print(f"Done. Files saved to {out_dir}")
