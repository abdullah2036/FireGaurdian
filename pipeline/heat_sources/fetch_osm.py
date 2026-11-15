"""Named industrial heat-related sites in Saudi Arabia from OpenStreetMap (Overpass API).

Collects gas flares, oil & gas facilities, refineries, power plants, works/factories and named
industrial areas (point = node or polygon centre). Used only to NAME a likely heat source near a
detection; a nearby site is a candidate, not proof. Data © OpenStreetMap contributors, ODbL.

Usage: python -m pipeline.heat_sources.fetch_osm   → pipeline/data/heat_sources/osm_industrial.json
AI-assisted: written with Claude Code (Anthropic) for NASA Space Apps 2026.
"""
from __future__ import annotations

import json
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "pipeline" / "data" / "heat_sources" / "osm_industrial.json"
QUERY = """
[out:json][timeout:180];
area["ISO3166-1"="SA"][admin_level=2]->.sa;
(
  nwr["man_made"="flare"](area.sa);
  nwr["industrial"~"^(oil|gas|refinery|petroleum|cement|steel|steelmaking|aluminium|chemical|petrochemical|fertilizer|gas_plant|oil_refinery)$"](area.sa);
  nwr["power"="plant"](area.sa);
  nwr["man_made"="works"](area.sa);
  nwr["landuse"="industrial"]["name"](area.sa);
  nwr["man_made"="petroleum_well"]["name"](area.sa);
);
out center tags;
"""
SERVERS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"]


def kind(tags: dict) -> str:
    ind = tags.get("industrial", "")
    name = (tags.get("name:en") or tags.get("name") or "").lower()
    if tags.get("man_made") == "flare" or "flare" in name:
        return "flare"
    if ind in ("refinery", "oil_refinery") or "refinery" in name:
        return "refinery"
    if ind in ("oil", "gas", "petroleum", "gas_plant") or tags.get("man_made") == "petroleum_well" or any(w in name for w in ("gosp", "gas plant", "oil", "aramco", "gas ")):
        return "oil_gas"
    if tags.get("power") == "plant" or "power" in name:
        return "power"
    if ind == "cement" or "cement" in name:
        return "cement"
    if ind in ("steel", "steelmaking") or "steel" in name or "hadeed" in name:
        return "steel"
    if ind in ("chemical", "petrochemical", "fertilizer") or any(w in name for w in ("petrochem", "chemical", "sabic", "fertil")):
        return "petrochemical"
    if ind == "aluminium" or "alumin" in name:
        return "aluminium"
    return "industrial"


def main():
    body = urllib.parse.urlencode({"data": QUERY}).encode()
    last = None
    for url in SERVERS:
        try:
            req = urllib.request.Request(url, data=body, headers={"User-Agent": "fire-guardian-pipeline/1.0"})
            data = json.loads(urllib.request.urlopen(req, timeout=240).read())
            break
        except Exception as e:  # noqa: BLE001
            last = e
    else:
        raise SystemExit(f"Overpass failed: {last}")
    sites = []
    for el in data["elements"]:
        tags = el.get("tags", {})
        lat = el.get("lat", el.get("center", {}).get("lat"))
        lon = el.get("lon", el.get("center", {}).get("lon"))
        if lat is None or lon is None:
            continue
        name = tags.get("name:en") or tags.get("name") or ""
        sites.append({"id": f"{el['type'][0]}{el['id']}", "lat": round(lat, 5), "lon": round(lon, 5),
                      "type": kind(tags), "name": name, "nameAr": tags.get("name:ar", "")})
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"source": "OpenStreetMap contributors (ODbL), via Overpass API",
                               "fetched": data.get("osm3s", {}).get("timestamp_osm_base", ""), "sites": sites},
                              ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    from collections import Counter
    print(len(sites), Counter(s["type"] for s in sites).most_common())


if __name__ == "__main__":
    main()
