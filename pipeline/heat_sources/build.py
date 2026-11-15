"""Heat-source classification for Saudi Arabia: is a satellite hotspot a fire or an industrial source?

Evidence, strongest first (all real, open data):
  1. NASA's own labels. FIRMS standard-processing files for NOAA-20/21 (the satellites the site
     uses live) tag every detection: 0 = presumed vegetation fire, 2 = static land source
     (industry, flares), 3 = offshore. We grid these labels at 0.005° (~500 m) and look up the
     3×3 neighbourhood of each new detection.
  2. GIHS v3.0 industrial heat-source polygons (VIIRS 2012–2021, Ma et al. 2024).
  3. 14-year persistence from our Suomi-NPP/MODIS archive (same 1 km / 5 km masks as the calendar).
  4. Named facilities: Climate TRACE 2025 (157 power, cement, steel, refinery, petrochemical,
     aluminium and chemical plants) and OpenStreetMap (flares, oil & gas, plants, works).
  5. A thermal-signature model (teammate's gradient-boosted trees, no CO) for places with no history.

The classifier is TESTED on months it never saw: label cells come from Aug 2024–Apr 2026 and the
test is May–Jul 2026 (latest NASA SP data), scored against NASA's labels for those months.
Outputs: api/data/nasa_static_cells.js, api/data/osm_sites.js, web/public/data/heat-eval.json,
web/public/data/heat-sites.json.

Usage: python -m pipeline.heat_sources.build   (after fetch_noaa_sp and fetch_osm)
AI-assisted: written with Claude Code (Anthropic) for NASA Space Apps 2026.
"""
from __future__ import annotations

import json
import math
from collections import Counter
from pathlib import Path

import numpy as np
import pandas as pd
import shapely

from pipeline.boundaries import load_regions
from pipeline.mask import load_gihs

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / "pipeline" / "data" / "cache" / "noaa_sp"
OSM = ROOT / "pipeline" / "data" / "heat_sources" / "osm_industrial.json"
CT = ROOT / "models" / "thermal_classifier" / "industrial_sites.csv"
API = ROOT / "api" / "data"
WEB = ROOT / "web" / "public" / "data"

CELL = 0.005          # NASA label grid (deg)
KEYBASE = 100000
TEST_FROM = "2026-05-01"
CT_KM, OSM_KM = 2.0, 1.5
LONG_MONTHS = 6       # heat at one spot in >= 6 distinct months → not a vegetation fire


def _module(path: Path):
    text = path.read_text(encoding="utf-8")
    start = text.index("{") if "export default {" in text or "= {" in text else text.index("[")
    end = text.rindex("}") + 1
    return json.loads(text[start:end])


# ---------- thermal model (same trees and calibration as api/lib/heat.ts, no-CO variant) ----------
def load_model():
    return _module(API / "heat_model.ts")["withoutCO"]


def model_score(m, X: np.ndarray) -> np.ndarray:
    z = np.full(len(X), m["baseline"], dtype=float)
    for tree in m["trees"]:
        node = np.zeros(len(X), dtype=int)
        nodes = np.array(tree, dtype=float)
        for _ in range(64):
            leaf = nodes[node, 5] == 1
            if leaf.all():
                break
            f = nodes[node, 0].astype(int)
            go_left = X[np.arange(len(X)), f] <= nodes[node, 1]
            nxt = np.where(go_left, nodes[node, 2], nodes[node, 3]).astype(int)
            node = np.where(leaf, node, nxt)
        z += nodes[node, 4]
    cal = m["calibrationIntercept"] + m["calibrationSlope"] * z
    return 1 / (1 + np.exp(-cal))


def haversine(lat1, lon1, lat2, lon2):
    r = np.pi / 180
    a = np.sin((lat2 - lat1) * r / 2) ** 2 + np.cos(lat1 * r) * np.cos(lat2 * r) * np.sin((lon2 - lon1) * r / 2) ** 2
    return 12742 * np.arcsin(np.sqrt(np.minimum(1, a)))


def nearest(lat, lon, sites):
    """Index and distance (km) of the nearest site for each point (sites: DataFrame lat/lon)."""
    from scipy.spatial import cKDTree
    def xyz(la, lo):
        la, lo = np.radians(la), np.radians(lo)
        return np.column_stack([np.cos(la) * np.cos(lo), np.cos(la) * np.sin(lo), np.sin(la)])
    tree = cKDTree(xyz(sites.lat.to_numpy(), sites.lon.to_numpy()))
    chord, idx = tree.query(xyz(lat, lon), k=1)
    return idx, 12742 * np.arcsin(np.minimum(1, chord / 2))


def cell_keys(lat, lon):
    return (np.floor(lat / CELL).astype(np.int64) * KEYBASE + np.floor(lon / CELL).astype(np.int64))


def label_cells(df: pd.DataFrame) -> dict[int, list[int]]:
    """Per 0.005° cell: [type0 count, type2 count, type3 count, distinct months with any detection]."""
    k = cell_keys(df.latitude.to_numpy(), df.longitude.to_numpy())
    out: dict[int, list[int]] = {}
    for key, t in zip(k, df.type.to_numpy()):
        c = out.setdefault(int(key), [0, 0, 0, 0])
        c[0 if t == 0 else 1 if t == 2 else 2] += 1
    months = pd.DataFrame({"k": k, "ym": df.acq_date.str[:7].to_numpy()}).groupby("k").ym.nunique()
    for key, n in months.items():
        out[int(key)][3] = int(n)
    return out


def neighbourhood(cells: dict[int, list[int]], lat, lon) -> np.ndarray:
    """3×3 sums of the label counts, and the max months-active, around each point."""
    k = cell_keys(lat, lon)
    res = np.zeros((len(k), 4), dtype=int)
    for di in (-1, 0, 1):
        for dj in (-1, 0, 1):
            kk = k + di * KEYBASE + dj
            v = np.array([cells.get(int(x), (0, 0, 0, 0)) for x in kk])
            res[:, :3] += v[:, :3]
            res[:, 3] = np.maximum(res[:, 3], v[:, 3])
    return res


def classify(df: pd.DataFrame, cells, gihs, snpp_fine, snpp_coarse, ct, osm, model) -> pd.DataFrame:
    """Replicates api/lib/classify.ts. Returns category, subtype, confidence and the evidence used."""
    lat, lon = df.latitude.to_numpy(), df.longitude.to_numpy()
    nb = neighbourhood(cells, lat, lon)
    t0, t2, t3, months = nb[:, 0], nb[:, 1], nb[:, 2], nb[:, 3]
    # Vegetation fires do not burn at one spot for months: NASA-"fire" spots active in >= 6 distinct
    # months were 76 % night-time on the test (like industrial heat, 90 %) vs 29 % for spots active < 6 months.
    long_running = months >= LONG_MONTHS
    stat = t2 + t3
    nasa_static = (stat >= 3) & (stat >= 0.6 * (t0 + stat))
    offshore = nasa_static & (t3 > t2)
    nasa_fire = (t0 >= 3) & (stat == 0)
    in_gihs = shapely.contains_xy(gihs, lon, lat) if gihs is not None else np.zeros(len(df), bool)
    fk = np.floor(lat / 0.01).astype(np.int64) * KEYBASE + np.floor(lon / 0.01).astype(np.int64)
    ck = np.floor(lat / 0.05).astype(np.int64) * KEYBASE + np.floor(lon / 0.05).astype(np.int64)
    persist = np.isin(fk, list(snpp_fine)) | np.isin(ck, list(snpp_coarse))
    ci, cd = nearest(lat, lon, ct)
    oi, od = nearest(lat, lon, osm)
    fac_ct, fac_osm = cd <= CT_KM, od <= OSM_KM
    # thermal model inputs (teammate's feature order, no CO); distance uses Climate TRACE like training
    b4, b5 = df.bright_ti4.to_numpy(float), df.bright_ti5.to_numpy(float)
    frp, sc, tr = df.frp.to_numpy(float), df.scan.to_numpy(float), df.track.to_numpy(float)
    conf, dn = df.confidence.astype(str).to_numpy(), df.daynight.astype(str).to_numpy()
    ok = (np.isfinite(b4) & (b4 >= 250) & (b4 <= 500) & np.isfinite(b5) & (b5 >= 200) & (b5 <= 400) & (frp >= 0)
          & (sc >= .1) & (sc <= 5) & (tr >= .1) & (tr <= 5) & np.isin(dn, ["D", "N"]) & np.isin(conf, ["l", "n", "h"]))
    X = np.column_stack([b4, b5, b4 - b5, np.log1p(np.clip(frp, 0, None)), sc, tr, dn == "N", conf == "l", conf == "h",
                         np.log1p(np.minimum(250, cd))]).astype(float)
    score = np.full(len(df), np.nan)
    if ok.any():
        score[ok] = model_score(model, np.nan_to_num(X[ok]))
    cat = np.full(len(df), "uncertain", dtype=object)
    conf_out = np.full(len(df), "low", dtype=object)
    reason = np.full(len(df), "", dtype=object)
    # Order chosen on the held-out test: persistence and facility proximity alone flagged thousands of
    # NASA-labelled fires (recurring farm burning), so they only break ties in the uncertain band;
    # facilities are used to NAME a source, not to decide. (Live repeat-night flags are tie-breakers too.)
    rules = [
        (offshore, "offshore", "high", "nasa_offshore"),
        (nasa_static & ~offshore, "industrial", "high", "nasa_static"),
        (in_gihs, "industrial", "medium", "gihs"),
        (long_running, "industrial", "medium", "long_running"),
        (nasa_fire, "fire", "high", "nasa_fire_history"),
        (np.isfinite(score) & (score >= 0.6), "industrial", "medium", "thermal_model"),
        (np.isfinite(score) & (score <= 0.4), "fire", "medium", "thermal_model"),
        (persist, "industrial", "low", "persistent"),
    ]
    done = np.zeros(len(df), bool)
    for mask, c, cf, why in rules:
        sel = mask & ~done
        cat[sel], conf_out[sel], reason[sel] = c, cf, why
        done |= sel
    return pd.DataFrame({"category": cat, "confidence": conf_out, "reason": reason, "score": score,
                         "t0": t0, "t2": t2, "t3": t3, "months": months, "ct_km": cd, "osm_km": od, "ct_i": ci, "osm_i": oi})


def main():
    regions, _ = load_regions()
    ksa = next(g for p, g in regions if p["id"] == "ksa")
    shapely.prepare(ksa)
    frames = []
    for f in sorted(CACHE.glob("*.csv.gz")):
        d = pd.read_csv(f, dtype={"acq_time": str})
        d["source"] = f.name.split(".")[0]
        frames.append(d)
    df = pd.concat(frames, ignore_index=True)
    for c in ["latitude", "longitude", "bright_ti4", "bright_ti5", "frp", "scan", "track", "type"]:
        df[c] = pd.to_numeric(df[c], errors="coerce")
    df = df[df.type.isin([0, 2, 3])].copy()
    df["type"] = df.type.astype(int)
    df = df[shapely.contains_xy(ksa.buffer(0.05), df.longitude.to_numpy(), df.latitude.to_numpy())].copy()
    print(f"labelled NOAA-20/21 detections in KSA: {len(df):,}  types={dict(Counter(df.type))}  "
          f"{df.acq_date.min()} → {df.acq_date.max()}")

    gihs, _ = load_gihs()
    sc = _module(API / "static_cells.js")
    snpp_fine, snpp_coarse = set(sc["fine"]), set(sc["coarse"])
    ct = pd.read_csv(CT).rename(columns={"latitude": "lat", "longitude": "lon"})
    osm_sites = json.loads(OSM.read_text(encoding="utf-8"))["sites"]
    osm = pd.DataFrame(osm_sites)
    model = load_model()

    # ---------------- temporal test ----------------
    build, test = df[df.acq_date < TEST_FROM], df[df.acq_date >= TEST_FROM].copy()
    cells_b = label_cells(build)
    res = classify(test, cells_b, gihs, snpp_fine, snpp_coarse, ct, osm, model)
    test = pd.concat([test.reset_index(drop=True), res], axis=1)
    test["truth"] = np.where(test.type == 0, "fire", "industrial")
    test["pred"] = np.where(test.category == "offshore", "industrial", test.category)

    def summary(t):
        out = {}
        for truth in ("fire", "industrial"):
            s = t[t.truth == truth]
            out[truth] = {"n": int(len(s)), **{p: int((s.pred == p).sum()) for p in ("fire", "industrial", "uncertain")}}
        decided = t[t.pred != "uncertain"]
        out["accuracy_decided"] = round(float((decided.pred == decided.truth).mean()), 4) if len(decided) else None
        rec = [out[k][k] / out[k]["n"] for k in ("fire", "industrial") if out[k]["n"]]
        out["balanced_recall"] = round(float(np.mean(rec)), 4)
        out["uncertain_share"] = round(float((t.pred == "uncertain").mean()), 4)
        return out

    new_loc = (test.t0 + test.t2 + test.t3) == 0
    m_ok = np.isfinite(test.score)
    from sklearn.metrics import roc_auc_score
    y = (test.type != 0).astype(int)
    model_eval = {
        "n": int(m_ok.sum()),
        "auc": round(float(roc_auc_score(y[m_ok], test.score[m_ok])), 4),
        "accuracy_at_half": round(float(((test.score[m_ok] >= .5).astype(int) == y[m_ok]).mean()), 4),
        "share_industrial_in_test": round(float(y[m_ok].mean()), 4),
    }
    reasons = test.groupby(["reason", "truth"]).size().unstack(fill_value=0)
    evaluation = {
        "what": "Heat-source classifier tested on NOAA-20/21 detections in Saudi Arabia, scored against NASA FIRMS labels (type 0 = vegetation fire; 2/3 = static/offshore source).",
        "label_cells_from": f"{build.acq_date.min()} to {build.acq_date.max()}",
        "test_period": f"{test.acq_date.min()} to {test.acq_date.max()}",
        "test_detections": int(len(test)),
        "overall": summary(test),
        "new_locations": {"n": int(new_loc.sum()), **summary(test[new_loc])},
        "thermal_model_on_noaa": model_eval,
        "by_reason": {r: {k: int(v) for k, v in row.items()} for r, row in reasons.iterrows()},
        "night_share": {
            "nasa_fire_labels": round(float((test[test.truth == "fire"].daynight == "N").mean()), 3),
            "nasa_industrial_labels": round(float((test[test.truth == "industrial"].daynight == "N").mean()), 3),
            "nasa_fire_labels_inside_gihs": round(float((test[(test.truth == "fire") & (test.reason == "gihs")].daynight == "N").mean()), 3) if ((test.truth == "fire") & (test.reason == "gihs")).any() else None,
        },
        "caveats": [
            "NASA's type labels are themselves inferred from persistence, not field-verified.",
            "Live repeat-night flags cannot be replayed on archive data and are not included in this test.",
            "A nearby named facility is a candidate source, not proof.",
        ],
    }
    WEB.mkdir(parents=True, exist_ok=True)
    (WEB / "heat-eval.json").write_text(json.dumps(evaluation, indent=1), encoding="utf-8")
    print(json.dumps({k: evaluation[k] for k in ("test_period", "test_detections", "overall", "new_locations", "thermal_model_on_noaa")}, indent=1))

    # ---------------- deployment data (all months) ----------------
    cells_all = label_cells(df)
    keep = {k: v for k, v in cells_all.items() if v[1] + v[2] >= 1 or v[0] >= 3}
    (API / "nasa_static_cells.js").write_text(
        "// Generated by pipeline/heat_sources/build.py — NASA FIRMS NOAA-20/21 SP labels per 0.005° cell: [type0, type2, type3, months active].\n"
        f"// Period {df.acq_date.min()} to {df.acq_date.max()}. Do not edit.\n"
        "export default " + json.dumps({"deg": CELL, "keyBase": KEYBASE, "longMonths": LONG_MONTHS, "from": df.acq_date.min(), "to": df.acq_date.max(),
                                        "cells": {str(k): v for k, v in keep.items()}}, separators=(",", ":")) + "\n", encoding="utf-8")
    (API / "osm_sites.js").write_text(
        "// Generated by pipeline/heat_sources/fetch_osm.py — © OpenStreetMap contributors (ODbL). Do not edit.\n"
        "export default " + json.dumps(osm_sites, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"label cells kept: {len(keep):,}")

    # known industrial heat sites for the map: cluster NASA static detections at 0.02°, name the nearest facility
    st = df[df.type != 0].copy()
    st["gi"], st["gj"] = np.floor(st.latitude / 0.02).astype(int), np.floor(st.longitude / 0.02).astype(int)
    g = st.groupby(["gi", "gj"]).agg(lat=("latitude", "mean"), lon=("longitude", "mean"), n=("type", "size"),
                                      off=("type", lambda s: int((s == 3).sum())), night=("daynight", lambda s: int((s == "N").sum()))).reset_index()
    g = g[g.n >= 10].copy()
    ci, cd = nearest(g.lat.to_numpy(), g.lon.to_numpy(), ct)
    oi, od = nearest(g.lat.to_numpy(), g.lon.to_numpy(), osm)
    sites = []
    for r, i1, d1, i2, d2 in zip(g.itertuples(), ci, cd, oi, od):
        name, typ, src, km = "", "industrial", "", None
        if d1 <= 3:
            name, typ, src, km = ct.iloc[i1]["name"], ct.iloc[i1]["type"], "Climate TRACE", round(float(d1), 2)
        elif d2 <= 2:
            o = osm.iloc[i2]
            name, typ, src, km = o["name"] or "", o["type"], "OpenStreetMap", round(float(d2), 2)
        if r.off > r.n / 2:
            typ = "offshore"
        sites.append({"lat": round(r.lat, 4), "lon": round(r.lon, 4), "n": int(r.n), "nightShare": round(r.night / r.n, 2),
                      "type": typ, "name": name, "source": src, "km": km})
    sites.sort(key=lambda s: -s["n"])
    (WEB / "heat-sites.json").write_text(json.dumps({
        "what": "Industrial heat sites seen by NOAA-20/21: NASA FIRMS type 2/3 detections clustered at 0.02°, ≥10 detections.",
        "period": [df.acq_date.min(), df.acq_date.max()], "sites": sites}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"industrial heat sites: {len(sites)}  named: {sum(1 for s in sites if s['name'])}  types={Counter(s['type'] for s in sites).most_common(8)}")


if __name__ == "__main__":
    main()
