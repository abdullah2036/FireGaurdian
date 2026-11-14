# MODIS <-> VIIRS harmonization of monthly hotspot counts.
# AI-assisted: written with Claude Code (Anthropic) for NASA Space Apps 2026.
"""Method (per region):

* Count hotspots per month per sensor family (MODIS = Terra + Aqua; VIIRS = S-NPP).
* Over the overlap (2012-02 -> last full month with both sensors), learn a ratio
  r_k = sum(VIIRS_k) / sum(MODIS_k) for each calendar month k, shrunk toward the
  overall ratio R when month k is sparse: r_k = w*raw_k + (1-w)*R, w = S_M/(S_M+K).
* VIIRS is converted to the MODIS scale: VIIRS_h = VIIRS / r_k.
* Harmonized series = mean of the available MODIS-scale estimates
  (MODIS and/or VIIRS_h). Never a sum of the two sensors. It runs 2001 -> present
  and continues on VIIRS alone after MODIS ends.
"""
import numpy as np
import pandas as pd

from .config import OVERLAP_START, RATIO_SHRINK_K


def month_range(start: str, end: str):
    return [p.strftime("%Y-%m") for p in pd.period_range(start, end, freq="M")]


def fit_ratios(m: np.ndarray, v: np.ndarray, cal: np.ndarray, k=RATIO_SHRINK_K):
    """m, v: monthly counts over overlap months; cal: calendar month 1..12."""
    sm, sv = np.nansum(m), np.nansum(v)
    overall = sv / sm if sm > 0 else np.nan
    by, raw, smk, svk = [], [], [], []
    for c in range(1, 13):
        sel = cal == c
        a, b = np.nansum(m[sel]), np.nansum(v[sel])
        rr = b / a if a > 0 else np.nan
        w = a / (a + k)
        by.append(float(w * rr + (1 - w) * overall) if a > 0 else float(overall))
        raw.append(None if np.isnan(rr) else float(rr))
        smk.append(int(a))
        svk.append(int(b))
    return float(overall), by, raw, smk, svk


def _robust_z(x, ref):
    ref = np.asarray([r for r in ref if r is not None and not np.isnan(r)])
    if len(ref) < 5 or x is None or np.isnan(x):
        return None
    lr = np.log1p(ref)
    med = np.median(lr)
    mad = max(1.4826 * np.median(np.abs(lr - med)), 0.25)
    return float((np.log1p(x) - med) / mad)


def harmonize_region(df: pd.DataFrame, months, avail: dict, partial: dict, meta: dict):
    """df: masked detections clipped to the region.
    avail[family] = (first_full_month, last_full_month) of sensor coverage."""
    idx = pd.Index(months)
    counts = df.groupby(["family", "ym"]).size().unstack(0).reindex(idx).fillna(0)
    out = {}
    for fam in ("MODIS", "VIIRS"):
        col = counts[fam] if fam in counts else pd.Series(0, index=idx)
        a0, a1 = avail[fam]
        ok = (idx >= a0) & (idx <= a1)
        out[fam] = np.where(ok, col.values, np.nan)
    m, v = out["MODIS"], out["VIIRS"]
    cal = np.array([int(s[5:7]) for s in months])
    year = np.array([int(s[:4]) for s in months])

    both = ~np.isnan(m) & ~np.isnan(v) & (idx >= OVERLAP_START)
    overall, by, raw, smk, svk = fit_ratios(m[both], v[both], cal[both])
    r_month = np.array([by[c - 1] for c in cal])
    vh = v / r_month

    est = np.vstack([m, vh])
    harm = np.where(np.all(np.isnan(est), axis=0), np.nan, np.nanmean(np.where(np.isnan(est), np.nan, est), axis=0))
    rawseries = np.where(~np.isnan(v), v, m)

    # Validation ---------------------------------------------------------
    mo, vo = m[both], v[both]
    pear = float(np.corrcoef(mo, vo)[0, 1]) if both.sum() > 3 and mo.std() > 0 and vo.std() > 0 else None
    pearl = float(np.corrcoef(np.log1p(mo), np.log1p(vo))[0, 1]) if pear is not None else None
    loyo = []
    yrs = sorted(set(year[both]))
    for y in yrs:
        tr = both & (year != y)
        te = both & (year == y)
        if tr.sum() < 24 or te.sum() < 6:
            continue
        ov, byy, *_ = fit_ratios(m[tr], v[tr], cal[tr])
        rm = np.array([byy[c - 1] for c in cal[te]])
        act = m[te]
        pred_month = v[te] / rm
        pred_overall = v[te] / ov
        pred_naive = v[te]
        loyo.append({
            "year": int(y), "months": int(te.sum()),
            "actual": float(act.sum()),
            "naive": float(pred_naive.sum()),
            "overall": round(float(pred_overall.sum()), 1),
            "monthly": round(float(pred_month.sum()), 1),
            "maeMonthly": round(float(np.mean(np.abs(pred_month - act))), 2),
            "maeOverall": round(float(np.mean(np.abs(pred_overall - act))), 2),
            "maeNaive": round(float(np.mean(np.abs(pred_naive - act))), 2),
        })

    def _ape(key):
        e = [abs(r[key] - r["actual"]) / r["actual"] for r in loyo if r["actual"] >= 20]
        return round(100 * float(np.median(e)), 1) if e else None

    def _mean(key):
        return round(float(np.mean([r[key] for r in loyo])), 2) if loyo else None

    validation = {
        "overlapMonths": int(both.sum()),
        "overlapStart": months[int(np.argmax(both))] if both.any() else None,
        "pearsonMonthly": None if pear is None else round(pear, 3),
        "pearsonMonthlyLog": None if pearl is None else round(pearl, 3),
        "loyo": loyo,
        "loyoSummary": {
            "medianAnnualAPE": {"naive": _ape("naive"), "overall": _ape("overall"), "monthly": _ape("monthly")},
            "meanMonthlyMAE": {"naive": _mean("maeNaive"), "overall": _mean("maeOverall"), "monthly": _mean("maeMonthly")},
        },
    }

    # Climatology & anomalies (on the harmonized series, complete months only)
    complete = np.array([s not in partial for s in months])
    z, anom = [], []
    clim = {"median": [], "p25": [], "p75": [], "mean": []}
    for c in range(1, 13):
        vals = harm[(cal == c) & complete & ~np.isnan(harm)]
        clim["median"].append(round(float(np.median(vals)), 2) if len(vals) else None)
        clim["p25"].append(round(float(np.percentile(vals, 25)), 2) if len(vals) else None)
        clim["p75"].append(round(float(np.percentile(vals, 75)), 2) if len(vals) else None)
        clim["mean"].append(round(float(np.mean(vals)), 2) if len(vals) else None)
    for t in range(len(months)):
        ref = harm[(cal == cal[t]) & complete & (np.arange(len(months)) != t)]
        zz = _robust_z(harm[t], ref) if complete[t] else None
        z.append(None if zz is None else round(zz, 2))
        med = clim["median"][cal[t] - 1] or 0
        a = 0
        if zz is not None and zz >= 2 and harm[t] >= max(5.0, 1.5 * med):
            a = 1
        elif zz is not None and zz <= -2 and med >= 5:
            a = -1
        anom.append(a)

    # Per-year table
    years = []
    for y in sorted(set(year)):
        s = year == y
        def tot(arr):
            vals = arr[s]
            return None if np.all(np.isnan(vals)) else round(float(np.nansum(vals)), 1)
        years.append({
            "year": int(y), "modis": tot(m), "viirs": tot(v), "viirsH": tot(vh), "harmonized": tot(harm),
            "partial": bool(any(mm in partial for mm in np.array(months)[s])) or int(s.sum()) < 12,
            "terraOnly": bool(y <= 2002),
        })

    full_years = [yy for yy in years if not yy["partial"] and yy["harmonized"] is not None]
    top_years = sorted(full_years, key=lambda r: -r["harmonized"])[:5]
    last_complete = max(i for i, s in enumerate(months) if complete[i])
    lc = months[last_complete]
    peak = int(np.nanargmax([x if x is not None else -1 for x in clim["median"]])) + 1

    def r(arr):
        return [None if np.isnan(x) else round(float(x), 2) for x in arr]

    return {
        **meta,
        "months": months,
        "modis": r(m), "viirs": r(v), "viirsH": r(vh), "harmonized": r(harm), "raw": r(rawseries),
        "z": z, "anomaly": anom,
        "partial": partial,
        "ratio": {"overall": round(overall, 3), "byMonth": [round(x, 3) for x in by],
                  "rawByMonth": [None if x is None else round(x, 3) for x in raw],
                  "modisByMonth": smk, "viirsByMonth": svk, "shrinkK": RATIO_SHRINK_K},
        "validation": validation,
        "climatology": clim,
        "years": years,
        "summary": {
            "topYears": [{"year": t["year"], "harmonized": t["harmonized"]} for t in top_years],
            "peakMonth": peak,
            "lastCompleteMonth": lc,
            "lastCompleteValue": None if np.isnan(harm[last_complete]) else round(float(harm[last_complete]), 1),
            "lastCompleteMedian": clim["median"][int(lc[5:7]) - 1],
            "lastCompleteZ": z[last_complete],
            "totalHarmonized": round(float(np.nansum(harm)), 0),
            "anomalyCount": int(sum(1 for a in anom if a == 1)),
        },
    }
