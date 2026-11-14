# Load and normalize raw NASA FIRMS downloads (archive + NRT, MODIS + VIIRS).
# AI-assisted: written with Claude Code (Anthropic) for NASA Space Apps 2026.
import io
import zipfile

import numpy as np
import pandas as pd

from .config import RAW_DIR

COLS = ["latitude", "longitude", "acq_date", "acq_time", "satellite", "instrument",
        "confidence", "frp", "daynight", "type", "brightness"]


def _family(instrument: str) -> str:
    return "MODIS" if str(instrument).upper().startswith("MODIS") else "VIIRS"


def _read_member(zf: zipfile.ZipFile, name: str) -> pd.DataFrame:
    df = pd.read_csv(io.BytesIO(zf.read(name)), dtype={"acq_time": str, "confidence": str})
    if "type" not in df.columns:  # NRT files carry no `type` column
        df["type"] = np.nan
    df = df[[c for c in COLS if c in df.columns]].copy()
    df["source_file"] = name
    df["product"] = "archive" if name.startswith("fire_archive") else "nrt"
    return df


def load_raw() -> pd.DataFrame:
    """Read every fire_*.csv inside every zip (and loose CSV) in pipeline/data/raw."""
    frames = []
    for z in sorted(RAW_DIR.glob("*.zip")):
        with zipfile.ZipFile(z) as zf:
            for name in zf.namelist():
                base = name.rsplit("/", 1)[-1]
                if base.startswith("fire_") and base.endswith(".csv"):
                    frames.append(_read_member(zf, base if base == name else name))
    for c in sorted(RAW_DIR.glob("fire_*.csv")):
        df = pd.read_csv(c, dtype={"acq_time": str, "confidence": str})
        if "type" not in df.columns:
            df["type"] = np.nan
        df = df[[k for k in COLS if k in df.columns]].copy()
        df["source_file"] = c.name
        df["product"] = "archive" if c.name.startswith("fire_archive") else "nrt"
        frames.append(df)
    if not frames:
        raise FileNotFoundError(f"No FIRMS CSVs found in {RAW_DIR}")
    df = pd.concat(frames, ignore_index=True)

    df["family"] = df["instrument"].map(_family)
    df["acq_time"] = df["acq_time"].str.zfill(4)
    df["date"] = pd.to_datetime(df["acq_date"])
    df["ym"] = df["acq_date"].str[:7]
    df["year"] = df["date"].dt.year
    df["month"] = df["date"].dt.month

    # Normalized confidence: MODIS 0-100 -> l/n/h (FIRMS guidance: <30 low, 30-79 nominal, >=80 high);
    # VIIRS already l/n/h (the API returns single letters, NOT low/nominal/high).
    conf = df["confidence"].astype(str).str.strip().str.lower()
    num = pd.to_numeric(conf, errors="coerce")
    lab = conf.str[:1].where(conf.str[:1].isin(["l", "n", "h"]), "u")
    lab = np.where(num.notna(), np.where(num >= 80, "h", np.where(num >= 30, "n", "l")), lab)
    df["conf"] = lab

    # Dedupe archive/NRT overlap: prefer the finalized archive record.
    n0 = len(df)
    df["_rank"] = (df["product"] == "nrt").astype(int)
    df["_lat"] = df["latitude"].round(3)
    df["_lon"] = df["longitude"].round(3)
    df = (df.sort_values("_rank")
            .drop_duplicates(["family", "satellite", "acq_date", "acq_time", "_lat", "_lon"])
            .drop(columns=["_rank", "_lat", "_lon"]))
    # Months covered by the archive are authoritative: drop NRT rows in those months per satellite.
    key = df["satellite"].astype(str) + "|" + df["ym"]
    arch_keys = set(key[df["product"] == "archive"])
    in_arch = (df["product"] == "nrt") & key.isin(arch_keys)
    df = df[~in_arch].reset_index(drop=True)
    print(f"  load: {n0:,} rows read, {len(df):,} after archive/NRT dedupe")
    return df
