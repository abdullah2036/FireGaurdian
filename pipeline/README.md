# Pipeline

Offline Python processing. Its outputs are committed (`web/public/data/`, `api/data/`), so the app never runs Python at request time.

| Step | File | Output |
|---|---|---|
| Load and clean FIRMS archive + NRT (MODIS, VIIRS) | `load.py` | cleaned detections |
| Saudi and province boundaries (Natural Earth) | `boundaries.py` | `data/boundaries/regions.geojson` |
| Flare and industrial heat mask (FIRMS type 2/3, persistence, GIHS) | `mask.py` | static-cell grids |
| Monthly VIIRS/MODIS ratio and harmonized record, leave-one-year-out validation | `harmonize.py` | calendar per region |
| Build everything for the app | `build.py` | `web/public/data/*.json`, `api/data/*.js` |
| NASA labels, OpenStreetMap sites, classifier evidence and evaluation | `heat_sources/` | `api/data/nasa_static_cells.js`, `web/public/data/heat-eval.json` |

```bash
pip install -r pipeline/requirements.txt
python -m pipeline.build
python -m pipeline.heat_sources.fetch_noaa_sp   # needs FIRMS_MAP_KEY
python -m pipeline.heat_sources.fetch_osm
python -m pipeline.heat_sources.build
```

Settings (thresholds, regions, date windows) are in `config.py`. Raw FIRMS downloads are in `data/raw/`; large re-fetchable sources are gitignored.
