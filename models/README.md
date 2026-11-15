# Models

Two models built by team members. Each folder holds the training code, data or results, and a Node integration test that checks the deployed JavaScript version gives the same answers as the Python one. The detailed write-ups are in Arabic (`README_AR.md`).

## `thermal_classifier/`: fire or industrial heat?

Gradient-boosted trees (scikit-learn `HistGradientBoostingClassifier`) that tell a vegetation fire from industrial heat using a hotspot's own signature: I4/I5 brightness temperatures, fire radiative power, pixel size, day/night and distance to the nearest known plant.

- **Training:** Suomi NPP VIIRS detections in Saudi Arabia (`train.py`; `train_with_co.py` adds CAMS carbon monoxide, data in `training_CAMS_CO.csv.gz`).
- **Facilities:** `industrial_sites.csv` (Climate TRACE 2025, 157 sites).
- **Results:** on NOAA-20/21 data from May–Jul 2026 it reaches **AUC 0.92**. Adding carbon monoxide did not help (80.3 % vs 80.9 %), so the live site uses the model without it.
- **Live use:** step 5 of the classifier in [`api/lib/classify.ts`](../api/lib/classify.ts), for places with no NASA label history. The model itself is exported to [`api/data/heat_model.ts`](../api/data/heat_model.ts).
- **Test:** `node models/thermal_classifier/test-integration.mjs` (run from the repo root).

## `day_ahead/`: will a cell have a fire detection tomorrow?

Logistic regression with Platt calibration on NASA POWER daily weather (temperature, humidity, wind, rain) plus location and season, for 29 cells of 0.5° × 0.625° in Jazan, Asir and Al Baha.

- **Training:** 2020–2023; calibrated on 2024; tested on 2025 (`train_model.py`, `results/metrics.json`).
- **Result:** roughly level with a seasonal baseline (average precision 0.050 vs 0.046). Because it does not beat the monthly pattern, the app shows it only on request and labels it experimental.
- **Live use:** [`api/handlers/ai-predict.ts`](../api/handlers/ai-predict.ts), model in [`api/data/ai-model.js`](../api/data/ai-model.js).
- **Test:** `cd models/day_ahead && SAFIRE_ROOT=../.. node test_integration.mjs`
