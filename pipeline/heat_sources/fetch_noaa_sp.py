"""Download NASA FIRMS VIIRS standard-processing (SP) detections for the KSA window.

SP files for NOAA-20 and NOAA-21 carry NASA's own `type` label for every detection
(0 = presumed vegetation fire, 2 = other static land source, 3 = offshore). These labels
are the reference used to (a) map industrial heat locations seen by the satellites the site
uses live and (b) test the heat-source classifier on months it never saw.

Usage:  python -m pipeline.heat_sources.fetch_noaa_sp  [--start 2024-08-01 --end 2026-07-31]
Needs FIRMS_MAP_KEY in the environment or in web/.env.local. Output (not committed):
pipeline/data/cache/noaa_sp/<SOURCE>.csv.gz

AI-assisted: written with Claude Code (Anthropic) for NASA Space Apps 2026.
"""
from __future__ import annotations

import argparse
import csv
import gzip
import io
import os
import re
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "pipeline" / "data" / "cache" / "noaa_sp"
BBOX = "34.4,16.3,55.7,32.2"
SOURCES = ["VIIRS_NOAA20_SP", "VIIRS_NOAA21_SP"]
COLS = ["latitude", "longitude", "bright_ti4", "bright_ti5", "frp", "scan", "track", "acq_date", "acq_time",
        "satellite", "confidence", "daynight", "type"]


def firms_key() -> str:
    k = os.environ.get("FIRMS_MAP_KEY")
    if not k:
        env = (ROOT / "web" / ".env.local").read_text(encoding="utf-8")
        k = re.search(r"^FIRMS_MAP_KEY=(.+)$", env, re.M).group(1).strip().strip('"')
    return k


def fetch(key: str, source: str, start: date, days: int) -> list[dict]:
    url = f"https://firms.modaps.eosdis.nasa.gov/api/area/csv/{key}/{source}/{BBOX}/{days}/{start.isoformat()}"
    for attempt in range(4):
        try:
            text = urllib.request.urlopen(url, timeout=120).read().decode()
            if text.lower().startswith(("invalid", "error")):
                raise RuntimeError(text[:120])
            return [{c: r.get(c, "") for c in COLS} for r in csv.DictReader(io.StringIO(text))]
        except Exception as e:  # noqa: BLE001 - retry transient network/API errors
            if attempt == 3:
                raise RuntimeError(f"{source} {start}: {e}") from e
            time.sleep(5 * (attempt + 1))
    return []


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--start", default="2024-08-01")
    ap.add_argument("--end", default="2026-07-31")
    ap.add_argument("--days", type=int, default=5)  # FIRMS area API allows up to 5 days for SP
    a = ap.parse_args()
    key = firms_key()
    OUT.mkdir(parents=True, exist_ok=True)
    s0, s1 = date.fromisoformat(a.start), date.fromisoformat(a.end)
    windows = []
    d = s0
    while d <= s1:
        n = min(a.days, (s1 - d).days + 1)
        windows.append((d, n))
        d += timedelta(days=n)
    for src in SOURCES:
        t0 = time.time()
        with ThreadPoolExecutor(max_workers=4) as ex:
            chunks = list(ex.map(lambda w: fetch(key, src, *w), windows))
        rows = [r for c in chunks for r in c]
        with gzip.open(OUT / f"{src}.csv.gz", "wt", newline="", encoding="utf-8") as fh:
            w = csv.DictWriter(fh, fieldnames=COLS)
            w.writeheader()
            w.writerows(rows)
        print(f"{src}: {len(rows):,} detections in {len(windows)} requests ({time.time() - t0:.0f}s)")


if __name__ == "__main__":
    main()
