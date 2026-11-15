// Experimental model: NASA FIRMS inferred class 0 vs 2 for an existing hotspot.
// Percentages are model indices against inferred labels, not proven fire probabilities.
import models from '../data/heat_model.js'
import sites from '../data/industrial_sites.js'
import cells from '../data/training_cells.js'

export type ThermalPattern = 'vegetation_like' | 'static_like' | 'uncertain' | 'unavailable'
export type HeatCategory = 'volcano_candidate' | 'offshore_detection' | 'industrial_map_candidate' | 'persistent_candidate' | 'vegetation_candidate' | 'thermal_static_candidate' | 'uncertain'
export interface HeatInputs {
  lat: number; lon: number; source: string; brightK: number | null; brightI5K: number | null; frp: number | null
  scan: number | null; track: number | null; daynight: string; conf: 'l' | 'n' | 'h' | 'u'
  static: string | null; reportedType: number | null
}
export interface MapEvidence { industrialMap: boolean; persistentFine: boolean; persistentCoarse: boolean }
export interface AirContext { value: number; previous72: number }
export interface NearbyFacility { id: string; name: string; type: string; distanceKm: number }
export interface HeatAssessment {
  category: HeatCategory; map: MapEvidence; livePersistence: boolean; thermalPattern: ThermalPattern
  modelStatus: 'snpp_experimental' | 'sensor_transfer_unvalidated' | 'unavailable'
  brightnessK: number | null; brightI5K: number | null; channelDifferenceK: number | null; frpMW: number | null
  staticIndex: number | null; vegetationIndex: number | null; usedCO: boolean; coMicrogramsM3: number | null
  inSampleGrid: boolean; nearbyFacilities: NearbyFacility[]
}
const trainingCells = new Set(cells)
export const gridKey = (lat: number, lon: number) => `${Math.floor(lat / .4 + .5 + 1e-9)},${Math.floor(lon / .4 + .5 + 1e-9)}`
function valid(v: number | null, min: number, max: number): v is number {
  return v != null && Number.isFinite(v) && v >= min && v <= max
}
function distanceKm(lat: number, lon: number, slat: number, slon: number) {
  const radians = Math.PI / 180
  const a = Math.sin((slat-lat)*radians/2)**2 + Math.cos(lat*radians)*Math.cos(slat*radians)*Math.sin((slon-lon)*radians/2)**2
  return 12742 * Math.asin(Math.sqrt(Math.min(1, a)))
}
export function nearestFacilities(lat: number, lon: number): NearbyFacility[] {
  return sites.map((s) => ({ ...s, distanceKm: distanceKm(lat,lon,s.lat,s.lon) })).sort((a,b) => a.distanceKm-b.distanceKm)
}
export type Model = typeof models.withCO
export function thermalIndex(values: number[], model: Model): number {
  let z = model.baseline
  for (const tree of model.trees) {
    let node = tree[0]
    while (!node[5]) node = tree[values[node[0]] <= node[1] ? node[2] : node[3]]
    z += node[4]
  }
  const calibrated = model.calibrationIntercept + model.calibrationSlope*z
  return 1 / (1 + Math.exp(-calibrated))
}
export function assessHeat(d: HeatInputs, map: MapEvidence, air?: AirContext | null): HeatAssessment {
  const candidates = nearestFacilities(d.lat,d.lon)
  const nearest = candidates[0]?.distanceKm ?? 250
  const eligible = d.source.startsWith('VIIRS_') && d.reportedType !== 1 && d.reportedType !== 3 &&
    valid(d.brightK,250,500) && valid(d.brightI5K,200,400) && valid(d.frp,0,10000) &&
    valid(d.scan,.1,5) && valid(d.track,.1,5) && (d.daynight === 'D' || d.daynight === 'N') && d.conf !== 'u'
  const usableCO = !!air && valid(air.value,0,100000) && valid(air.previous72,0,100000)
  let score: number | null = null
  let pattern: ThermalPattern = 'unavailable'
  let status: HeatAssessment['modelStatus'] = 'unavailable'
  if (eligible) {
    const inputs = [d.brightK!,d.brightI5K!,d.brightK!-d.brightI5K!,Math.log1p(d.frp!),d.scan!,d.track!,
      d.daynight==='N'?1:0,d.conf==='l'?1:0,d.conf==='h'?1:0,Math.log1p(Math.min(250,nearest))]
    if (usableCO) inputs.push(air!.value,air!.value-air!.previous72)
    score = thermalIndex(inputs,usableCO ? models.withCO : models.withoutCO)
    pattern = score <= .4 ? 'vegetation_like' : score >= .6 ? 'static_like' : 'uncertain'
    status = d.source === 'VIIRS_SNPP_NRT' ? 'snpp_experimental' : 'sensor_transfer_unvalidated'
  }
  const livePersistence = d.static === 'night-persistent-live'
  let category: HeatCategory = 'uncertain'
  if (d.reportedType === 1) category = 'volcano_candidate'
  else if (d.reportedType === 3) category = 'offshore_detection'
  else if (map.industrialMap) category = 'industrial_map_candidate'
  else if (map.persistentFine || map.persistentCoarse || livePersistence || d.static === 'type') category = 'persistent_candidate'
  else if (pattern === 'vegetation_like') category = 'vegetation_candidate'
  else if (pattern === 'static_like') category = 'thermal_static_candidate'
  return {
    category, map, livePersistence, thermalPattern: pattern, modelStatus: status,
    brightnessK:d.brightK, brightI5K:d.brightI5K,
    channelDifferenceK:valid(d.brightK,250,500)&&valid(d.brightI5K,200,400)?d.brightK-d.brightI5K:null,
    frpMW:d.frp, staticIndex:score, vegetationIndex:score===null?null:1-score,
    usedCO:eligible && usableCO, coMicrogramsM3:usableCO ? air!.value : null,
    inSampleGrid:trainingCells.has(gridKey(d.lat,d.lon)),
    nearbyFacilities:candidates.filter((s)=>s.distanceKm<=5).slice(0,3).map((s)=>({id:s.id,name:s.name,type:s.type,distanceKm:Math.round(s.distanceKm*100)/100})),
  }
}
