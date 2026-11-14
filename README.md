# Fire Guardian — Detect. Predict. Protect.

**NASA Space Apps Challenge 2026 · “Harmonization of MODIS and VIIRS Hot Spots”**

Fire Guardian monitors wildfires across Saudi Arabia. Its foundation is **one consistent monthly burning-activity record** built by harmonizing MODIS (1 km, 2001→) and VIIRS (375 m, 2012→) hotspots from NASA FIRMS, with gas flares and industrial heat masked out. On top of that record it shows live fires, flags high-risk areas and simulates a drone response.

**How the site works.** The map page shows one view at a time, picked by the user:

| View | What the map shows | Side panel / phone sheet |
|---|---|---|
| **Live fires** (default) | Fires seen by NASA satellites (NOAA-20/21 VIIRS via FIRMS, flares filtered), as pulsing flame icons sized by strength. Optional: show the filtered industrial heat in grey | Fire count with a 24 h / 2 days / 5 days switch, fire list, selected fire with the VIIRS infrared image, weather |
| **Forecast** | Where fires are common this month (glow) and tomorrow's AI index for the southwest pilot (dashed squares: Low / Medium / High) | AI summary for tomorrow with its 2025 hit rate, top provinces this month, weather |
| **Danger zones** | Only the most dangerous areas: fires burning now, places that burn most years this month, AI "high" cells | Count and lists of each, weather |

Tapping a fire, an area or anywhere on the map selects it, and the weather and details follow the selection. **Analytics** holds the harmonized fire calendar, the harmonization validation and the AI model page. **Drones** holds the drone-response simulation (map with flights, simulated camera, fleet, mission log, QGroundControl `.plan` export).

**Phones.** On screens narrower than 768 px (or short touch screens in landscape) the app switches to a phone layout: full-screen map, view chips, a draggable bottom sheet and a bottom tab bar (`web/src/components/mobile/MobileShell.tsx`). It can also be added to the home screen (web manifest).

**Languages.** English and Arabic, with right-to-left layout in Arabic, from one file: `web/src/lib/i18n.tsx`. The detailed Analytics charts stay in English. To go English-only, remove `<LangToggle />` from `Shell.tsx` and `MobileShell.tsx`.

**Risk layers.**
- *Seasonal baseline* (all KSA, orange/yellow): for each 0.25° cell, the share of years (2012–2025) with at least one flare-masked hotspot in the current calendar month (`web/public/data/risk.json`, ≥ 50 % = high, ≥ 20 % = elevated).
- *AI research index* (SW pilot, dashed cells): a teammate's logistic-regression model on NASA POWER weather scores **tomorrow** (03:00–03:00 Saudi time) for 29 cells of 0.5° × 0.625° in Jazan, Asir and Al Baha. It predicts whether a cell will have a flare-filtered VIIRS vegetation detection, using weather from 3 days earlier because of NASA POWER's publishing delay. Shown as Low (< 1) / Elevated (≥ 1) / High (≥ 5) with each level's observed 2025 hit rate (0.9 % / 2.8 % / 7.5 %). It is **not** a wildfire probability. On the 2025 retrospective test it is roughly level with the seasonal baseline: average precision 0.050 vs 0.046, and 52 vs 57 detections caught in the top 10 %. Details are in Analytics → AI model and `pipeline/ai/` (README_AR.md, train_model.py, results/, test_integration.mjs).

**Drone simulation** (Drones page only). Bases are illustrative staging points at regional cities. Cruise speed is 110 km/h, range 180 km, and the clock runs ×30. Nothing has been tested on hardware.

## Key results (Saudi Arabia, flares masked)

| | KSA | SW KSA (Al Baha · Asir · Jazan) |
|---|---|---|
| Detections in the FIRMS window → kept after mask | 629,262 → 52,051 | 3,438 |
| Overall VIIRS / MODIS ratio (2012-02 → 2026-10) | **9.4×** | **6.4×** |
| Monthly Pearson r (MODIS vs VIIRS) | 0.50 (log 0.69) | 0.90 |
| Leave-one-year-out median annual error — harmonized | **13.1 %** | 11.1 % |
| Same, if raw VIIRS were spliced onto MODIS | 878 % | 504 % |

Large-wildfire regions such as Portugal show a ratio of about 2.8. Saudi burning is mostly small agricultural and waste fires: 1 km MODIS misses most of them, while 375 m VIIRS detects them. That is why Fire Guardian learns the ratio **per region and calendar month** instead of using one global factor. The lower KSA-wide correlation comes from small residual industrial sources in the Eastern Province and Riyadh. Vegetation-dominated regions correlate strongly (Al Baha r = 0.98, SW KSA 0.90).

## Method (summary)

1. **Clean**: merge FIRMS archive and NRT files (the archive wins in overlapping months), normalize the schema (MODIS confidence 0–100 and VIIRS `l/n/h` become one scale), keep `type` 0 or missing, and clip to the real Natural Earth polygons (not a bounding box).
2. **Mask static heat sources**, in layers:
   - FIRMS type 2 (static land source) and type 3 (offshore).
   - ~1 km cells with type-2 detections, so NRT points in those cells are masked too.
   - ~1 km persistence: ≥ 8 distinct months, ≥ 3 years, and ≥ 4 months within one year. The one-year rule protects stubble-burning farms.
   - ~5 km night-time persistence: night fraction ≥ 0.4 and persistent. This catches flares whose detections drift between 1 km cells.
   - **GIHS** industrial polygons (Ma et al. 2024, *Scientific Data*, [Zenodo 10.5281/zenodo.8308133](https://doi.org/10.5281/zenodo.8308133), CC BY 4.0).
   - Live only: within the FIRMS window, points seen on ≥ 2 overpasses within 1.5 km and ≥ 50 % at night are flagged as flares. Saudi vegetation fires are short-lived and mostly daytime.
3. **Aggregate** hotspots per month for each sensor family: MODIS (Terra + Aqua) and VIIRS (S-NPP).
4. **Ratio**: for each calendar month k, r_k = ΣVIIRS_k / ΣMODIS_k over the overlap years. Sparse months are shrunk toward the overall ratio with weight n/(n+60).
5. **Harmonize**: VIIRS ÷ r_k puts VIIRS on the MODIS scale. The harmonized value is the **mean** of the available MODIS-scale estimates, **never a sum**. The record runs from 2001 to today and stays valid after MODIS ends.
6. **Validate**: leave-one-year-out prediction of MODIS annual and monthly totals from VIIRS, plus correlation.

**Caveats shown in the UI:** MODIS is Terra-only before July 2002. Missing data ≠ zero fire. Hotspots ≠ individual fires. Never sum MODIS and VIIRS counts. Suomi NPP stopped producing data on 2 Nov 2026, so live monitoring uses NOAA-20/21.

## Repository layout

```
pipeline/            Python offline processing  →  web/public/data/*.json, api/data/*.js
  ai/                teammate's AI research model: training script, metrics, reference examples, integration tests
  data/raw/          FIRMS downloads (MODIS_DATA.zip, VIIRS_DATA.zip: archive + NRT CSVs, KSA window)
  data/boundaries/   regions.geojson (Natural Earth, KSA + provinces + SW KSA), committed
  data/gihs/         GIHS polygons clipped to the KSA window, committed
vercel.json          Vercel Services config: "web" (Vite site) + "api" (Express, routed from /api/*)
api/                 API service: firms (FIRMS proxy), weather (Meteomatics proxy), ai-predict (AI research index), health
  data/              flare-mask cells, KSA border, GIHS polygons (generated by the pipeline), ai-model.js (trained model)
web/                 Vite + React + TypeScript + Tailwind, Radix/shadcn-style UI, MapLibre GL, ECharts
  public/data/       precomputed calendar JSON per region, risk.json, grid, boundaries
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

1. Import the GitHub repo in Vercel and leave **Root Directory** at the repo root. The root `vercel.json` defines two services: **`web`** (`web/`, the Vite site) and **`api`** (`api/`, an Express app that `/api/*` is routed to). The Python `pipeline/` is offline tooling: it is not deployed (see `.vercelignore`) and its outputs are committed under `web/`.
2. In **Settings → Environment Variables**, add `FIRMS_MAP_KEY`, `METEOMATICS_USER` and `METEOMATICS_PASS`, then redeploy.
3. Every push to `main` deploys automatically. Check `/api/health` to see which keys are configured (it reports true or false, never the values).

Secrets live only in environment variables. `.env.example` is committed, while `.env.local` and `api_keys.txt` are gitignored. API responses are cached in memory and through `s-maxage` headers (FIRMS: 10 min), which keeps usage within the Meteomatics limit of 1,000 queries per day.

## Data sources

- **NASA FIRMS**: MODIS C6.1 and VIIRS S-NPP C2 active fire archive and NRT; live NOAA-20/21 VIIRS through the Area API.
- **GIHS v3.0**: Global Remote Industrial Heat Sources (CC BY 4.0).
- **Natural Earth**: 1:10m admin-0 and admin-1 boundaries (public domain).
- **NASA GIBS**: Blue Marble relief and daily VIIRS true-colour basemaps, VIIRS SWIR imagery for the thermal feed.
- **Meteomatics**: point weather through `/api/weather` (snapped to 0.25°, cached 30 min to respect the 1,000 queries/day limit).
- **Sentinel-2 cloudless** (EOX, contains modified Copernicus data): aerial still behind the simulated drone camera.
- **NASA POWER** (daily point/regional API, no key): weather inputs for the AI research index via `/api/ai-predict` (`?grid=1` for all 29 cells, cached 30 min).

## Credits

Built on **SAFIRE**, a teammate’s Streamlit prototype for Saudi fire early warning (`reference/`). Its FIRMS fetch, CSV export and honest limitations text were carried over. Three known bugs were fixed along the way:
- VIIRS confidence is `l/n/h`, not `low/nominal/high`.
- The Saudi border polygon replaces the rectangular bounding box.
- WebGL rendering replaces one Folium marker per point.

## AI tools used

We used **Claude** (Anthropic) for planning and **Claude Code** to write code. Generated source files carry a short header comment noting AI assistance, as the Space Apps rules require. The team reviewed every data-processing decision, and the results are validated in the app's Method & Data view.

## Limitations

Fire Guardian is a research and demonstration tool. It is not an official warning system and does not replace the Saudi Civil Defense, and the drone fleet is a simulation. Some industrial heat may remain after masking, especially in the Eastern Province. Satellite revisit times, cloud and fire size all limit what the sensors detect.
