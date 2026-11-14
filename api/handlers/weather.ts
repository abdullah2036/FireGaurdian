// GET /api/weather?lat=18.2&lon=42.5
// Proxies Meteomatics (credentials stay server-side) for fire-weather at a point:
// 2 m temperature, relative humidity, 10 m wind speed and direction, from 12 h ago to 12 h ahead.
// Coordinates are snapped to 0.25° and responses cached for 30 min to stay within the
// 1,000 queries/day quota. Falls back to clearly-labelled mock data when credentials are missing.
// AI-assisted: written with Claude Code (Anthropic) for NASA Space Apps 2026.
import { cached, sendJSON, type Req, type Res } from '../lib/http.js'

const PARAMS = ['t_2m:C', 'relative_humidity_2m:p', 'wind_speed_10m:kmh', 'wind_dir_10m:d'] as const
const KEYS = ['temp', 'humidity', 'wind', 'windDir'] as const
type Key = (typeof KEYS)[number]

export interface WeatherResp {
  lat: number; lon: number; source: 'meteomatics' | 'mock'; mock: boolean; fetchedAt: string; error?: string
  now: Record<Key, number | null> & { time: string }
  series: { time: string; temp: number | null; humidity: number | null; wind: number | null; windDir: number | null }[]
}

const snap = (v: number) => Math.round(v * 4) / 4
const hourISO = (d: Date) => d.toISOString().slice(0, 13) + ':00:00Z'

async function fetchMeteomatics(user: string, pass: string, lat: number, lon: number, start: Date, end: Date) {
  const url = `https://api.meteomatics.com/${hourISO(start)}--${hourISO(end)}:PT1H/${PARAMS.join(',')}/${lat},${lon}/json`
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 12000)
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: { Authorization: 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64') },
    })
    if (!r.ok) throw new Error(`Meteomatics ${r.status}: ${(await r.text()).slice(0, 120)}`)
    const j = (await r.json()) as { data: { parameter: string; coordinates: { dates: { date: string; value: number }[] }[] }[] }
    const byTime = new Map<string, WeatherResp['series'][number]>()
    j.data.forEach((p, k) => {
      for (const { date, value } of p.coordinates[0].dates) {
        const row = byTime.get(date) ?? { time: date, temp: null, humidity: null, wind: null, windDir: null }
        row[KEYS[k]] = value < -900 ? null : value // Meteomatics uses -999 for missing
        byTime.set(date, row)
      }
    })
    return [...byTime.values()].sort((a, b) => a.time.localeCompare(b.time))
  } finally {
    clearTimeout(t)
  }
}

function mockSeries(lat: number, lon: number, start: Date): WeatherResp['series'] {
  // Smooth diurnal cycle, deterministic per location. Clearly labelled mock: true.
  const seed = Math.abs(Math.sin(lat * 12.9898 + lon * 78.233))
  return Array.from({ length: 25 }, (_, h) => {
    const d = new Date(start.getTime() + h * 3600e3)
    const local = (d.getUTCHours() + 3) % 24
    const diurnal = Math.cos(((local - 14) / 24) * 2 * Math.PI)
    return {
      time: d.toISOString().replace('.000', ''),
      temp: Math.round((27 + 6 * diurnal + seed * 4) * 10) / 10,
      humidity: Math.round(30 - 12 * diurnal + seed * 10),
      wind: Math.round((14 + 6 * diurnal + seed * 8) * 10) / 10,
      windDir: Math.round((300 + seed * 60 + h * 2) % 360),
    }
  })
}

export default async function handler(req: Req, res: Res) {
  const q = req.query as Record<string, string>
  const lat = snap(Number(q.lat ?? 18.25)), lon = snap(Number(q.lon ?? 42.5))
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180)
    return sendJSON(res, 400, { error: 'lat/lon required' })

  const now = new Date()
  const start = new Date(Math.floor(now.getTime() / 3600e3) * 3600e3 - 12 * 3600e3)
  const end = new Date(start.getTime() + 24 * 3600e3)
  const user = process.env.METEOMATICS_USER, pass = process.env.METEOMATICS_PASS

  let series: WeatherResp['series']
  let mock = false
  let error: string | undefined
  if (user && pass) {
    try {
      series = (await cached(`wx:${lat}:${lon}:${hourISO(start)}`, 1800, () => fetchMeteomatics(user, pass, lat, lon, start, end))).value
    } catch (e) {
      error = (e as Error).message
      series = mockSeries(lat, lon, start)
      mock = true
    }
  } else {
    series = mockSeries(lat, lon, start)
    mock = true
  }
  const cur = series.reduce((best, r) =>
    Math.abs(Date.parse(r.time) - now.getTime()) < Math.abs(Date.parse(best.time) - now.getTime()) ? r : best, series[0])
  const body: WeatherResp = {
    lat, lon, source: mock ? 'mock' : 'meteomatics', mock, fetchedAt: now.toISOString(), error,
    now: { time: cur.time, temp: cur.temp, humidity: cur.humidity, wind: cur.wind, windDir: cur.windDir },
    series,
  }
  sendJSON(res, 200, body, mock ? 60 : 1800)
}
