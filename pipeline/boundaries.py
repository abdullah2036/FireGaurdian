# Region boundaries from Natural Earth (public domain).
# AI-assisted: written with Claude Code (Anthropic) for NASA Space Apps 2026.
"""Builds pipeline/data/boundaries/regions.geojson from Natural Earth 10m files.

The committed regions.geojson is used when the large Natural Earth source files
are not present (they are gitignored). Re-fetch them with:
  curl -L -o pipeline/data/boundaries_src/ne_10m_admin0.geojson \
    https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_countries.geojson
  curl -L -o pipeline/data/boundaries_src/ne_10m_admin1.geojson \
    https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson
"""
import json

from shapely.geometry import mapping, shape
from shapely.ops import unary_union

from .config import BOUNDARY_FILE, BOUNDARY_SRC, COMPOSITES, PROVINCE_NAMES


def _round_coords(obj, nd=4):
    if isinstance(obj, (list, tuple)):
        if obj and isinstance(obj[0], (int, float)):
            return [round(float(c), nd) for c in obj]
        return [_round_coords(o, nd) for o in obj]
    return obj


def _feature(rid, props, geom, tol=0.005):
    g = geom.simplify(tol, preserve_topology=True)
    gj = mapping(g)
    gj = {"type": gj["type"], "coordinates": _round_coords(gj["coordinates"])}
    minx, miny, maxx, maxy = geom.bounds
    return {
        "type": "Feature",
        "properties": {"id": rid, **props, "bbox": [round(minx, 3), round(miny, 3), round(maxx, 3), round(maxy, 3)]},
        "geometry": gj,
    }


def build_boundaries():
    a0p = BOUNDARY_SRC / "ne_10m_admin0.geojson"
    a1p = BOUNDARY_SRC / "ne_10m_admin1.geojson"
    if not (a0p.exists() and a1p.exists()):
        if BOUNDARY_FILE.exists():
            print("  boundaries: using committed", BOUNDARY_FILE.name)
            return
        raise FileNotFoundError("Natural Earth sources missing; see pipeline/boundaries.py docstring")

    a0 = json.load(open(a0p, encoding="utf-8"))
    a1 = json.load(open(a1p, encoding="utf-8"))
    ksa = next(shape(f["geometry"]) for f in a0["features"] if f["properties"].get("ADM0_A3") == "SAU")
    provs = {
        f["properties"]["iso_3166_2"]: shape(f["geometry"])
        for f in a1["features"]
        if f["properties"].get("adm0_a3") == "SAU"
    }
    feats = [_feature("ksa", {"name": COMPOSITES["ksa"]["name"], "short": "KSA", "kind": "country"}, ksa)]
    sw = COMPOSITES["sw-ksa"]
    feats.append(
        _feature("sw-ksa", {"name": sw["name"], "short": sw["short"], "kind": "composite"},
                 unary_union([provs[m] for m in sw["members"]]))
    )
    for code, geom in sorted(provs.items()):
        name = PROVINCE_NAMES.get(code, code)
        feats.append(_feature(code.lower(), {"name": name, "short": name, "kind": "province", "iso": code}, geom))

    BOUNDARY_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(BOUNDARY_FILE, "w", encoding="utf-8") as fh:
        json.dump({"type": "FeatureCollection", "features": feats}, fh, separators=(",", ":"))
    print(f"  boundaries: wrote {len(feats)} regions -> {BOUNDARY_FILE.relative_to(BOUNDARY_FILE.parents[2])}")


def load_regions():
    data = json.load(open(BOUNDARY_FILE, encoding="utf-8"))
    return [(f["properties"], shape(f["geometry"])) for f in data["features"]], data
