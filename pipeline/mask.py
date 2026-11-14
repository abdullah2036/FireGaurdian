# Static heat-source (gas flare / industrial) mask.
# AI-assisted: written with Claude Code (Anthropic) for NASA Space Apps 2026.
"""Four layers, applied to MODIS + VIIRS detections pooled:

1. Type: drop FIRMS type 2 (other static land source) and 3 (offshore).
2. Type-cells: any ~1 km cell (0.01 deg) with >= MASK_MIN_TYPE2 type-2/3
   detections is static, so NRT detections (no `type` column) there are masked.
3. Persistence (~1 km): cells whose remaining detections span many distinct
   months across several years, with >= 4 active months in at least one year
   (protects farms that burn stubble once or twice a year).
   Layers 2-3 are dilated by one cell (VIIRS geolocation jitter).
4. Night-gated persistence (~5 km): flares drift between 1 km cells, so we also
   test 0.05 deg cells. A cell is industrial when it is mostly night-time
   (vegetation fires in KSA burn by day) AND persistent.
5. GIHS: detections inside the Global Remote Industrial Heat Sources polygons
   (Ma et al. 2024, Scientific Data, Zenodo 10.5281/zenodo.8308133, CC BY 4.0),
   buffered by ~500 m.
"""
import json

import numpy as np
import pandas as pd
import shapely
from shapely.geometry import shape

from .config import (GIHS_FILE, MASK_CELL_DEG, MASK_MIN_DISTINCT_MONTHS, MASK_MIN_DISTINCT_YEARS,
                     MASK_MIN_MONTHS_IN_ONE_YEAR, MASK_MIN_TYPE2, NIGHT_CELL_DEG, NIGHT_MIN_FRACTION,
                     NIGHT_MIN_MONTHS, NIGHT_MIN_MONTHS_IN_ONE_YEAR, NIGHT_MIN_YEARS)

KEY_BASE = 100000


def cell_key(lat, lon, deg):
    i = np.floor(np.asarray(lat) / deg).astype(np.int64)
    j = np.floor(np.asarray(lon) / deg).astype(np.int64)
    return i * KEY_BASE + j


def _dilate(keys: set) -> set:
    out = set()
    for k in keys:
        i, j = divmod(k, KEY_BASE)
        for di in (-1, 0, 1):
            for dj in (-1, 0, 1):
                out.add((i + di) * KEY_BASE + (j + dj))
    return out


def _persist(df, key, min_months, min_years, min_in_year):
    d = df.assign(_k=key)
    per_year = d.groupby(["_k", "year"])["month"].nunique().groupby("_k").max()
    s = pd.DataFrame({
        "months": d.groupby("_k")["ym"].nunique(),
        "years": d.groupby("_k")["year"].nunique(),
        "py": per_year,
        "night": d.groupby("_k")["daynight"].apply(lambda x: float((x == "N").mean())),
    })
    return s, (s.months >= min_months) & (s.years >= min_years) & (s.py >= min_in_year)


def load_gihs():
    if not GIHS_FILE.exists():
        return None, 0
    fc = json.load(open(GIHS_FILE, encoding="utf-8"))
    geoms = [shape(f["geometry"]) for f in fc["features"]]
    u = shapely.union_all([g.buffer(0.005) for g in geoms])
    shapely.prepare(u)
    return u, len(geoms)


def build_mask(df: pd.DataFrame):
    typed = df["type"].isin([2, 3]).values
    k1 = cell_key(df["latitude"].values, df["longitude"].values, MASK_CELL_DEG)
    t2 = pd.Series(k1[typed]).value_counts()
    type_cells = set(t2[t2 >= MASK_MIN_TYPE2].index.tolist())

    rest = df[~typed]
    rk1 = k1[~typed]
    _, ok = _persist(rest, rk1, MASK_MIN_DISTINCT_MONTHS, MASK_MIN_DISTINCT_YEARS, MASK_MIN_MONTHS_IN_ONE_YEAR)
    persist_cells = set(ok[ok].index.tolist()) - type_cells
    fine = _dilate(type_cells | persist_cells)

    # Night-gated coarse persistence on what survives the fine mask
    alive = ~np.isin(rk1, np.fromiter(fine, dtype=np.int64))
    r2 = rest[alive]
    rk5 = cell_key(r2["latitude"].values, r2["longitude"].values, NIGHT_CELL_DEG)
    s5, _ = _persist(r2, rk5, 1, 1, 1)
    night_ok = (s5.night >= NIGHT_MIN_FRACTION) & (
        ((s5.months >= NIGHT_MIN_MONTHS) & (s5.years >= NIGHT_MIN_YEARS)) | (s5.py >= NIGHT_MIN_MONTHS_IN_ONE_YEAR))
    coarse = set(s5[night_ok].index.tolist())

    gihs, n_gihs = load_gihs()
    mask = {"fine": fine, "coarse": coarse, "gihs": gihs}
    report = {
        "cellDeg": MASK_CELL_DEG,
        "coarseCellDeg": NIGHT_CELL_DEG,
        "typeCells": len(type_cells),
        "persistenceCells": len(persist_cells),
        "maskedCellsDilated": len(fine),
        "nightCoarseCells": len(coarse),
        "gihsPolygons": n_gihs,
        "rules": {
            "minType2PerCell": MASK_MIN_TYPE2,
            "persistence1km": f">= {MASK_MIN_DISTINCT_MONTHS} distinct months, >= {MASK_MIN_DISTINCT_YEARS} years, "
                              f">= {MASK_MIN_MONTHS_IN_ONE_YEAR} months in one year; dilated 1 cell",
            "nightCoarse": f"{NIGHT_CELL_DEG} deg cells with night fraction >= {NIGHT_MIN_FRACTION} and "
                           f"(>= {NIGHT_MIN_MONTHS} months over >= {NIGHT_MIN_YEARS} years, or "
                           f">= {NIGHT_MIN_MONTHS_IN_ONE_YEAR} months in one year)",
            "gihs": "inside GIHS polygons buffered ~500 m",
        },
        "gihs": ("Used: Global Remote Industrial Heat Sources v3.0 (Ma et al. 2024, Sci Data; "
                 "Zenodo 10.5281/zenodo.8308133; CC BY 4.0)") if n_gihs else "GIHS file not present",
    }
    return mask, report


def static_flags(lat, lon, mask):
    lat, lon = np.asarray(lat), np.asarray(lon)
    f = np.isin(cell_key(lat, lon, MASK_CELL_DEG), np.fromiter(mask["fine"], dtype=np.int64))
    c = np.isin(cell_key(lat, lon, NIGHT_CELL_DEG), np.fromiter(mask["coarse"], dtype=np.int64))
    g = shapely.contains_xy(mask["gihs"], lon, lat) if mask["gihs"] is not None else np.zeros(len(lat), bool)
    return f, c, g


def apply_mask(df: pd.DataFrame, mask):
    typed = df["type"].isin([2, 3]).values
    f, c, g = static_flags(df["latitude"].values, df["longitude"].values, mask)
    flagged = typed | f | c | g
    layers = {"type": int(typed.sum()), "fine": int((f & ~typed).sum()),
              "nightCoarse": int((c & ~typed & ~f).sum()), "gihs": int((g & ~typed & ~f & ~c).sum())}
    return df[~flagged].copy(), flagged, layers
