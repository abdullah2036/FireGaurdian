// Heat-source classification for live detections: fire, industrial, offshore or uncertain.
// Same rules as pipeline/heat_sources/build.py, where they are tested on months the rules never saw
// (results in web/public/data/heat-eval.json). Evidence, strongest first:
//   NASA FIRMS labels for this location (NOAA-20/21 standard processing) → GIHS industrial polygon →
//   14-year persistence → repeated night passes now → named facility ≤ 1 km → NASA fire history →
//   thermal-signature model (teammate's trees, no CO).
// AI-assisted: written with Claude Code (Anthropic) for NASA Space Apps 2026.
import cellsData from '../data/nasa_static_cells.js'
import osmSites from '../data/osm_sites.js'
import ctSites from '../data/industrial_sites.js'
import type { HeatAssessment } from './heat.js'

export type SourceCategory = 'fire' | 'industrial' | 'offshore' | 'uncertain'
export type SourceReason = 'nasa_offshore' | 'nasa_static' | 'gihs' | 'long_running' | 'persistent' | 'live_repeat' | 'facility' | 'nasa_fire_history' | 'thermal_model' | 'none'
export interface Facility { name: string; nameAr?: string; type: string; km: number; source: 'Climate TRACE' | 'OpenStreetMap' }
export interface SourceClass {
  category: SourceCategory
  confidence: 'high' | 'medium' | 'low'
  reason: SourceReason
  /** facility type (power, cement, steel, refinery, petrochemical, aluminium, chemical, flare, oil_gas, industrial) or 'offshore' */
  subtype: string | null
  facility: Facility | null
  /** NASA FIRMS labels at this spot (3×3 cells of 0.005°), NOAA-20/21, see nasaPeriod */
  nasa: { fire: number; static: number; offshore: number; months: number }
  staticIndex: number | null
}

const C = cellsData as unknown as { deg: number; keyBase: number; longMonths: number; from: string; to: string; cells: Record<string, [number, number, number, number]> }
export const nasaPeriod = { from: C.from, to: C.to }
const OSM = osmSites as unknown as { lat: number; lon: number; type: string; name: string; nameAr: string }[]
const CT = ctSites as unknown as { lat: number; lon: number; type: string; name: string }[]

function km(lat1: number, lon1: number, lat2: number, lon2: number) {
  const r = Math.PI / 180
  const a = Math.sin((lat2 - lat1) * r / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin((lon2 - lon1) * r / 2) ** 2
  return 12742 * Math.asin(Math.sqrt(Math.min(1, a)))
}
function nearestOf<T extends { lat: number; lon: number }>(list: T[], lat: number, lon: number) {
  let best: T | null = null, d = Infinity
  for (const s of list) {
    if (Math.abs(s.lat - lat) > 0.1 || Math.abs(s.lon - lon) > 0.1) continue
    const x = km(lat, lon, s.lat, s.lon)
    if (x < d) { d = x; best = s }
  }
  return { site: best, km: d }
}

export function nasaLabels(lat: number, lon: number) {
  const i = Math.floor(lat / C.deg), j = Math.floor(lon / C.deg)
  const out = { fire: 0, static: 0, offshore: 0, months: 0 }
  for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
    const c = C.cells[String((i + di) * C.keyBase + (j + dj))]
    if (c) { out.fire += c[0]; out.static += c[1]; out.offshore += c[2]; out.months = Math.max(out.months, c[3] ?? 0) }
  }
  return out
}

export function classifyHeat(
  d: { lat: number; lon: number; static: string | null; reportedType?: number | null },
  heat: HeatAssessment | undefined,
): SourceClass {
  const nasa = nasaLabels(d.lat, d.lon)
  const stat = nasa.static + nasa.offshore
  const nasaStatic = stat >= 3 && stat >= 0.6 * (nasa.fire + stat)
  const offshore = d.reportedType === 3 || (nasaStatic && nasa.offshore > nasa.static)
  const nasaFire = nasa.fire >= 3 && stat === 0
  const ct = nearestOf(CT, d.lat, d.lon), osm = nearestOf(OSM, d.lat, d.lon)
  let facility: Facility | null = null
  if (ct.site && ct.km <= 2 && (ct.km <= osm.km || osm.km > 1.5)) facility = { name: ct.site.name, type: ct.site.type, km: +ct.km.toFixed(2), source: 'Climate TRACE' }
  else if (osm.site && osm.km <= 1.5) facility = { name: osm.site.name, nameAr: osm.site.nameAr || undefined, type: osm.site.type, km: +osm.km.toFixed(2), source: 'OpenStreetMap' }
  const score = heat?.staticIndex ?? null
  const gihs = !!heat?.map.industrialMap
  const persistent = !!(heat?.map.persistentFine || heat?.map.persistentCoarse) || d.static === 'persistent-1km' || d.static === 'night-persistent-5km' || d.static === 'type'
  const liveRepeat = d.static === 'night-persistent-live'

  const pick = (category: SourceCategory, confidence: SourceClass['confidence'], reason: SourceReason): SourceClass => ({
    category, confidence, reason, nasa, staticIndex: score, facility,
    subtype: category === 'offshore' ? 'offshore' : category === 'industrial' ? facility?.type ?? null : null,
  })
  // Order validated on held-out months (pipeline/heat_sources/build.py): persistence and facility
  // proximity alone mislabelled many farm fires, so they only break ties; facilities name the source.
  if (offshore) return pick('offshore', 'high', 'nasa_offshore')
  if (nasaStatic) return pick('industrial', 'high', 'nasa_static')
  if (gihs) return pick('industrial', 'medium', 'gihs')
  // vegetation fires do not burn at one spot for months (validated in build.py: 76 % night-time, like industry)
  if (nasa.months >= C.longMonths) return pick('industrial', 'medium', 'long_running')
  if (nasaFire) return pick('fire', 'high', 'nasa_fire_history')
  if (score != null && score >= 0.6) return pick('industrial', 'medium', 'thermal_model')
  if (score != null && score <= 0.4) return pick('fire', 'medium', 'thermal_model')
  if (persistent) return pick('industrial', 'low', 'persistent')
  if (liveRepeat) return pick('industrial', 'low', 'live_repeat')
  return pick('uncertain', 'low', 'none')
}
