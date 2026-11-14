// Small geo helpers for the client: distance, bearing, point-in-polygon, province lookup.
// AI-assisted: written with Claude Code (Anthropic) for NASA Space Apps 2026.
import type { Feature, FeatureCollection, Geometry } from 'geojson'

export const R_EARTH_KM = 6371
const rad = (d: number) => (d * Math.PI) / 180

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const dLat = rad(lat2 - lat1), dLon = rad(lon2 - lon1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * R_EARTH_KM * Math.asin(Math.sqrt(a))
}

export function bearingDeg(lat1: number, lon1: number, lat2: number, lon2: number) {
  const y = Math.sin(rad(lon2 - lon1)) * Math.cos(rad(lat2))
  const x = Math.cos(rad(lat1)) * Math.sin(rad(lat2)) - Math.sin(rad(lat1)) * Math.cos(rad(lat2)) * Math.cos(rad(lon2 - lon1))
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

export const compass = (deg: number | null | undefined) =>
  deg == null ? '—' : ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(deg / 45) % 8]

function inRing(x: number, y: number, ring: number[][]) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

export function inGeometry(lon: number, lat: number, g: Geometry): boolean {
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []
  return polys.some((p) => inRing(lon, lat, p[0] as number[][]) && !p.slice(1).some((h) => inRing(lon, lat, h as number[][])))
}

export interface RegionProps { id: string; name: string; short?: string; kind: string; bbox: [number, number, number, number] }

/** Name of the province containing a point, or null. */
export function provinceOf(fc: FeatureCollection<Geometry, RegionProps> | null, lat: number, lon: number): string | null {
  if (!fc) return null
  const f = fc.features.find((f: Feature<Geometry, RegionProps>) => {
    if (f.properties.kind !== 'province') return false
    const [a, b, c, d] = f.properties.bbox
    return lon >= a && lon <= c && lat >= b && lat <= d && inGeometry(lon, lat, f.geometry)
  })
  return f ? f.properties.short ?? f.properties.name : null
}
