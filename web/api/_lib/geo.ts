// Point-in-polygon + static-source masking for live FIRMS detections.
// AI-assisted: written with Claude Code (Anthropic) for NASA Space Apps 2026.
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Data files are written by the Python pipeline and shipped via vercel.json `includeFiles`.
// The function's working directory differs between `vite dev`, a plain Vercel project and a
// Vercel Services deployment, so try each plausible location.
const here = dirname(fileURLToPath(import.meta.url))
const DATA_DIRS = [
  join(here, '..', '_data'),
  join(process.cwd(), 'api', '_data'),
  join(process.cwd(), 'web', 'api', '_data'),
]
const load = (f: string) => {
  const dir = DATA_DIRS.find((d) => existsSync(join(d, f)))
  if (!dir) throw new Error(`data file ${f} not found in ${DATA_DIRS.join(', ')}`)
  return JSON.parse(readFileSync(join(dir, f), 'utf-8'))
}
const staticCells = load('static_cells.json')
const ksa = load('ksa.json')
const gihs = load('gihs.json')

type Ring = number[][]
type Geom = { type: 'Polygon'; coordinates: Ring[] } | { type: 'MultiPolygon'; coordinates: Ring[][] }

function inRing(x: number, y: number, ring: Ring) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

function polys(g: Geom): Ring[][] {
  return g.type === 'Polygon' ? [g.coordinates] : g.coordinates
}

function bboxOf(rings: Ring[]) {
  let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity
  for (const [x, y] of rings[0]) { a = Math.min(a, x); b = Math.min(b, y); c = Math.max(c, x); d = Math.max(d, y) }
  return [a, b, c, d]
}

function makeIndex(g: Geom) {
  const ps = polys(g).map((p) => ({ p, bb: bboxOf(p) }))
  return (x: number, y: number) => ps.some(({ p, bb }) =>
    x >= bb[0] && x <= bb[2] && y >= bb[1] && y <= bb[3] && inRing(x, y, p[0]) && !p.slice(1).some((h) => inRing(x, y, h)))
}

export const inKSA = makeIndex(ksa as Geom)
const inGIHS = makeIndex(gihs as Geom)
const sc = staticCells as { keyBase: number; fineDeg: number; fine: number[]; coarseDeg: number; coarse: number[] }
const fine = new Set(sc.fine)
const coarse = new Set(sc.coarse)
const key = (lat: number, lon: number, deg: number) => Math.floor(lat / deg) * sc.keyBase + Math.floor(lon / deg)

/** Returns the reason a detection is treated as a static (non-vegetation) heat source, or null. */
export function staticReason(lat: number, lon: number, type?: number | null): string | null {
  if (type === 2 || type === 3) return 'type'
  if (fine.has(key(lat, lon, sc.fineDeg))) return 'persistent-1km'
  if (coarse.has(key(lat, lon, sc.coarseDeg))) return 'night-persistent-5km'
  if (inGIHS(lon, lat)) return 'gihs'
  return null
}
