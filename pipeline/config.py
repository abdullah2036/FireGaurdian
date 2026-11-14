# NovaShift pipeline configuration.
# AI-assisted: written with Claude Code (Anthropic) for NASA Space Apps 2026.
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PIPELINE = ROOT / "pipeline"
RAW_DIR = PIPELINE / "data" / "raw"
BOUNDARY_SRC = PIPELINE / "data" / "boundaries_src"
BOUNDARY_FILE = PIPELINE / "data" / "boundaries" / "regions.geojson"
OUT_DIR = ROOT / "web" / "public" / "data"
API_DATA_DIR = ROOT / "api" / "data"  # JS modules bundled into the API service

# ~1 km persistence-mask grid (degrees)
MASK_CELL_DEG = 0.01
# Coarse grid exported for custom areas (degrees)
GRID_CELL_DEG = 0.1

# Static heat-source rules (applied to vegetation-typed detections, both sensors pooled)
MASK_MIN_DISTINCT_MONTHS = 8
MASK_MIN_DISTINCT_YEARS = 3
MASK_MIN_MONTHS_IN_ONE_YEAR = 4
# A ~1 km cell with this many type-2 ("static land source") detections is static
MASK_MIN_TYPE2 = 2

# Night-gated coarse persistence (flares drift between 1 km cells)
NIGHT_CELL_DEG = 0.05
NIGHT_MIN_FRACTION = 0.4
NIGHT_MIN_MONTHS = 12
NIGHT_MIN_YEARS = 3
NIGHT_MIN_MONTHS_IN_ONE_YEAR = 6

GIHS_FILE = PIPELINE / "data" / "gihs" / "gihs_ksa_region.geojson"

# Ratio shrinkage: a calendar-month ratio is blended toward the overall ratio
# with weight S_M / (S_M + K) where S_M = MODIS hotspots in that month over the overlap.
RATIO_SHRINK_K = 60

# Overlap window starts with the first full VIIRS S-NPP month
OVERLAP_START = "2012-02"

# Provinces from Natural Earth admin-1 (iso_3166_2 codes) and composite regions
COMPOSITES = {
    "ksa": {"name": "Saudi Arabia", "short": "KSA", "kind": "country"},
    "sw-ksa": {
        "name": "Southwest KSA (Al Baha · Asir · Jazan)",
        "short": "SW KSA",
        "kind": "composite",
        "members": ["SA-11", "SA-14", "SA-09"],
    },
}
PROVINCE_NAMES = {
    "SA-01": "Riyadh", "SA-02": "Makkah", "SA-03": "Al Madinah", "SA-04": "Eastern Province",
    "SA-05": "Al-Qassim", "SA-06": "Ha'il", "SA-07": "Tabuk", "SA-08": "Northern Borders",
    "SA-09": "Jazan", "SA-10": "Najran", "SA-11": "Al Baha", "SA-12": "Al Jawf", "SA-14": "Asir",
}
