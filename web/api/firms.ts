// GET /api/firms?source=VIIRS_NOAA20_NRT&days=1
// Proxies the NASA FIRMS Area API for Saudi Arabia (key stays server-side), clips to the real
// KSA border, flags gas flares / industrial sources, and caches responses.
// Falls back to clearly-labelled mock data when FIRMS_MAP_KEY is missing or FIRMS fails.
// AI-assisted: written with Claude Code (Anthropic) for NASA Space Apps 2026.
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { cached, parseCSV, sendJSON } from './_lib/http.js'
import { inKSA, staticReason } from './_lib/geo.js'

const SOURCES = ['VIIRS_NOAA20_NRT', 'VIIRS_NOAA21_NRT', 'MODIS_NRT', 'VIIRS_SNPP_NRT'] as const
const KSA_BBOX = '34.4,16.3,55.7,32.2' // query window; results are clipped to the border polygon

export interface Detection {
  lat: number; lon: number; date: string; time: string; satellite: string; source: string
  conf: 'l' | 'n' | 'h' | 'u'; frp: number | null; daynight: string; static: string | null
}

function normConf(c: string): Detection['conf'] {
  const s = (c ?? '').trim().toLowerCase()
  const n = Number(s)
  if (s !== '' && !Number.isNaN(n)) return n >= 80 ? 'h' : n >= 30 ? 'n' : 'l'
  // FIRMS returns l / n / h for VIIRS (not low/nominal/high)
  const f = s[0]
  return f === 'l' || f === 'n' || f === 'h' ? f : 'u'
}

async function fetchSource(key: string, source: string, days: number): Promise<Detection[]> {
  const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${key}/${source}/${KSA_BBOX}/${days}`
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 15000)
  try {
    const r = await fetch(url, { signal: ctrl.signal })
    const text = await r.text()
    if (!r.ok || /invalid|error/i.test(text.slice(0, 80))) throw new Error(`FIRMS ${r.status}: ${text.slice(0, 120)}`)
    return parseCSV(text).map((row) => {
      const lat = Number(row.latitude), lon = Number(row.longitude)
      return {
        lat, lon, date: row.acq_date, time: (row.acq_time ?? '').padStart(4, '0'), satellite: row.satellite, source,
        conf: normConf(row.confidence), frp: row.frp ? Number(row.frp) : null, daynight: row.daynight,
        static: staticReason(lat, lon, row.type ? Number(row.type) : null),
      }
    }).filter((d) => Number.isFinite(d.lat) && inKSA(d.lon, d.lat))
  } finally {
    clearTimeout(t)
  }
}

function mock(source: string, days: number): Detection[] {
  // Deterministic synthetic detections around real KSA burning areas (clearly labelled mock: true).
  const seeds = [[18.2, 42.5], [19.9, 41.5], [29.9, 39.7], [27.5, 41.7], [26.3, 43.9], [17.0, 42.8], [25.4, 49.6], [24.1, 47.3]]
  let s = days * 7919 + source.length * 104729
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647)
  const today = new Date().toISOString().slice(0, 10)
  return Array.from({ length: 30 * days }, (_, i) => {
    const [la, lo] = seeds[i % seeds.length]
    const lat = la + (rnd() - 0.5) * 0.8, lon = lo + (rnd() - 0.5) * 0.8
    return {
      lat, lon, date: today, time: String(Math.floor(rnd() * 2359)).padStart(4, '0'), satellite: source.includes('21') ? 'N21' : 'N20',
      source, conf: (['l', 'n', 'h'] as const)[Math.floor(rnd() * 3)], frp: Math.round(rnd() * 400) / 10,
      daynight: rnd() > 0.5 ? 'D' : 'N', static: staticReason(lat, lon),
    }
  })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const q = req.query as Record<string, string>
  const days = Math.min(5, Math.max(1, Number(q.days ?? 1) || 1)) // FIRMS Area API allows 1–5 days
  const requested = (q.source ?? 'VIIRS_NOAA20_NRT,VIIRS_NOAA21_NRT').split(',')
  const sources = requested.filter((s): s is (typeof SOURCES)[number] => (SOURCES as readonly string[]).includes(s))
  if (!sources.length) return sendJSON(res, 400, { error: `source must be one of ${SOURCES.join(', ')}` })

  const key = process.env.FIRMS_MAP_KEY
  const errors: string[] = []
  let isMock = !key
  const out: Detection[] = []
  for (const src of sources) {
    if (!key) { out.push(...mock(src, days)); continue }
    try {
      const { value } = await cached(`firms:${src}:${days}`, 600, () => fetchSource(key, src, days))
      out.push(...value)
    } catch (e) {
      errors.push(`${src}: ${(e as Error).message}`)
      out.push(...mock(src, days))
      isMock = true
    }
  }
  sendJSON(res, 200, {
    fetchedAt: new Date().toISOString(),
    sources, days, mock: isMock, errors,
    count: out.length,
    vegetation: out.filter((d) => !d.static).length,
    detections: out,
  }, isMock ? 60 : 600)
}
