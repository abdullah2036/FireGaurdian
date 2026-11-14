# NovaShift — Two satellites. One fire record.

**NASA Space Apps Challenge 2026 · “Harmonization of MODIS and VIIRS Hot Spots”**

NovaShift merges MODIS (1 km, 2001→) and VIIRS (375 m, 2012→) active-fire hotspots from NASA FIRMS into **one consistent monthly burning-activity record for Saudi Arabia**, so the sensor a hotspot came from no longer changes the story. Gas flares and industrial heat sources are masked out, and every number is validated in the app.

| View | Status |
|---|---|
| **Calendar** — year × month heatmap, peak months/years, latest month vs. median, anomalies, CSV | ✅ Phase 1 |
| **Method & Data** — per-year raw vs. harmonized, monthly ratio, leave-one-year-out, scatter, mask report | ✅ Phase 1 |
| Live Map — NOAA-20/21 VIIRS over KSA, flares masked | 🛠 Phase 2 (`/api/firms` proxy already live) |
| Risk Outlook — probabilistic critical-period risk | 🛠 Phase 3 |
| Drone Ops — response simulation + QGroundControl `.plan` export | 🛠 Phase 4 |

## Key results (Saudi Arabia, flares masked)

| | KSA | SW KSA (Al Baha · Asir · Jazan) |
|---|---|---|
| Detections in the FIRMS window → kept after mask | 629,262 → 52,051 | 3,438 |
| Overall VIIRS / MODIS ratio (2012-02 → 2026-10) | **9.4×** | **6.4×** |
| Monthly Pearson r (MODIS vs VIIRS) | 0.50 (log 0.69) | 0.90 |
| Leave-one-year-out median annual error — harmonized | **13.1 %** | 11.1 % |
| Same, if raw VIIRS were spliced onto MODIS | 878 % | 504 % |

Large-wildfire regions such as Portugal show a ratio of about 2.8. Saudi burning is mostly small agricultural and waste fires: 1 km MODIS misses most of them, while 375 m VIIRS detects them. That is why NovaShift learns the ratio **per region and calendar month** instead of using one global factor. The lower KSA-wide correlation comes from small residual industrial sources in the Eastern Province and Riyadh. Vegetation-dominated regions correlate strongly (Al Baha r = 0.98, SW KSA 0.90).

## Method (summary)

1. **Clean**: merge FIRMS archive and NRT files (the archive wins in overlapping months), normalize the schema (MODIS confidence 0–100 and VIIRS `l/n/h` become one scale), keep `type` 0 or missing, and clip to the real Natural Earth polygons (not a bounding box).
2. **Mask static heat sources**, in layers:
   - FIRMS type 2 (static land source) and type 3 (offshore).
   - ~1 km cells with type-2 detections, so NRT points in those cells are masked too.
   - ~1 km persistence: ≥ 8 distinct months, ≥ 3 years, and ≥ 4 months within one year. The one-year rule protects stubble-burning farms.
   - ~5 km night-time persistence: night fraction ≥ 0.4 and persistent. This catches flares whose detections drift between 1 km cells.
   - **GIHS** industrial polygons (Ma et al. 2024, *Scientific Data*, [Zenodo 10.5281/zenodo.8308133](https://doi.org/10.5281/zenodo.8308133), CC BY 4.0).
3. **Aggregate** hotspots per month for each sensor family: MODIS (Terra + Aqua) and VIIRS (S-NPP).
4. **Ratio**: for each calendar month k, r_k = ΣVIIRS_k / ΣMODIS_k over the overlap years. Sparse months are shrunk toward the overall ratio with weight n/(n+60).
5. **Harmonize**: VIIRS ÷ r_k puts VIIRS on the MODIS scale. The harmonized value is the **mean** of the available MODIS-scale estimates, **never a sum**. The record runs from 2001 to today and stays valid after MODIS ends.
6. **Validate**: leave-one-year-out prediction of MODIS annual and monthly totals from VIIRS, plus correlation.

**Caveats shown in the UI:** MODIS is Terra-only before July 2002. Missing data ≠ zero fire. Hotspots ≠ individual fires. Never sum MODIS and VIIRS counts. Suomi NPP stopped producing data on 2 Nov 2026, so live monitoring uses NOAA-20/21.

## Repository layout

```
pipeline/            Python offline processing  →  web/public/data/*.json, web/api/_data/*.json
  data/raw/          FIRMS downloads (MODIS_DATA.zip, VIIRS_DATA.zip: archive + NRT CSVs, KSA window)
  data/boundaries/   regions.geojson (Natural Earth, KSA + provinces + SW KSA), committed
  data/gihs/         GIHS polygons clipped to the KSA window, committed
web/                 Vite + React + TypeScript + Tailwind, Radix/shadcn-style UI, ECharts
  api/               Vercel serverless functions (FIRMS proxy, health); keys stay server-side
  public/data/       precomputed calendar JSON per region, grid, boundaries
reference/           SAFIRE Streamlit prototype (teammate’s original)
```

## Run locally

```bash
# 1. Pipeline (Python 3.11+); re-runnable with one command
python -m venv .venv && .venv/Scripts/activate      # macOS/Linux: source .venv/bin/activate
pip install -r pipeline/requirements.txt
python -m pipeline.build

# 2. Web app
cd web
cp .env.example .env.local     # fill in keys (optional: without them /api/firms returns labelled mock data)
npm install
npm run dev                    # http://localhost:5173 (also serves /api/* locally)
```

## Deploy (Vercel)

1. Import the GitHub repo in Vercel and set **Root Directory = `web`**. The framework (Vite) is read from `web/vercel.json`.
2. In **Settings → Environment Variables**, add `FIRMS_MAP_KEY`, `METEOMATICS_USER` and `METEOMATICS_PASS`, then redeploy.
3. Every push to `main` deploys automatically. Check `/api/health` to see which keys are configured (it reports true or false, never the values).

Secrets live only in environment variables. `.env.example` is committed, while `.env.local` and `api_keys.txt` are gitignored. API responses are cached in memory and through `s-maxage` headers (FIRMS: 10 min), which keeps usage within the Meteomatics limit of 1,000 queries per day.

## Data sources

- **NASA FIRMS**: MODIS C6.1 and VIIRS S-NPP C2 active fire archive and NRT; live NOAA-20/21 VIIRS through the Area API.
- **GIHS v3.0**: Global Remote Industrial Heat Sources (CC BY 4.0).
- **Natural Earth**: 1:10m admin-0 and admin-1 boundaries (public domain).
- Planned: NASA GIBS (WMTS overlays), NASA POWER (historical weather), Meteomatics (forecast weather).

## Credits

Built on **SAFIRE**, a teammate’s Streamlit prototype for Saudi fire early warning (`reference/`). Its FIRMS fetch, CSV export and honest limitations text were carried over. Three known bugs were fixed along the way:
- VIIRS confidence is `l/n/h`, not `low/nominal/high`.
- The Saudi border polygon replaces the rectangular bounding box.
- WebGL rendering replaces one Folium marker per point.

## AI tools used

We used **Claude** (Anthropic) for planning and **Claude Code** to write code. Generated source files carry a short header comment noting AI assistance, as the Space Apps rules require. The team reviewed every data-processing decision, and the results are validated in the app's Method & Data view.

## Limitations

NovaShift is a research and demonstration tool. It is not an official warning system and does not replace the Saudi Civil Defense. Some industrial heat may remain after masking, especially in the Eastern Province. Satellite revisit times, cloud and fire size all limit what the sensors detect.
