// Static data loading (precomputed by the Python pipeline) with an in-memory cache.
// AI-assisted: written with Claude Code (Anthropic) for NASA Space Apps 2026.
import { useEffect, useState } from 'react'
import type { CalendarData, IndexData } from './types'

const cache = new Map<string, Promise<unknown>>()

export function getJSON<T>(url: string): Promise<T> {
  if (!cache.has(url)) {
    const p = fetch(url).then((r) => {
      if (!r.ok) throw new Error(`${r.status} ${r.statusText} — ${url}`)
      return r.json()
    })
    p.catch(() => cache.delete(url))
    cache.set(url, p)
  }
  return cache.get(url) as Promise<T>
}

export interface Loadable<T> {
  data: T | null
  error: string | null
  loading: boolean
}

export function useJSON<T>(url: string | null): Loadable<T> {
  const [state, setState] = useState<Loadable<T>>({ data: null, error: null, loading: !!url })
  useEffect(() => {
    if (!url) return
    let alive = true
    setState((s) => ({ ...s, loading: true, error: null }))
    getJSON<T>(url)
      .then((data) => alive && setState({ data, error: null, loading: false }))
      .catch((e) => alive && setState({ data: null, error: String(e.message ?? e), loading: false }))
    return () => {
      alive = false
    }
  }, [url])
  return state
}

export const useIndex = () => useJSON<IndexData>('/data/index.json')
export const useCalendar = (id: string) => useJSON<CalendarData>(`/data/calendar/${id}.json`)

/** CSV of the monthly series for the selected range. */
export function calendarCSV(d: CalendarData, from: string, to: string): string {
  const head = ['month', 'modis_raw', 'viirs_raw', 'viirs_on_modis_scale', 'harmonized_modis_scale',
    'naive_raw_series', 'robust_z', 'anomaly', 'ratio_used', 'note']
  const rows = [
    `# Fire Guardian harmonized MODIS/VIIRS hotspot counts — region: ${d.name}`,
    `# Units: hotspot detections per month on the MODIS (1 km) scale. Hotspots != individual fires; missing != zero.`,
    `# Harmonized = mean of available MODIS-scale estimates (never MODIS + VIIRS). Overall VIIRS/MODIS ratio: ${d.ratio.overall}`,
    head.join(','),
  ]
  d.months.forEach((m, i) => {
    if (m < from || m > to) return
    const cal = Number(m.slice(5, 7))
    const note = [
      m <= '2002-06' ? 'Terra-only MODIS' : '',
      d.partial[m] ?? '',
    ].filter(Boolean).join('; ')
    rows.push([
      m, d.modis[i], d.viirs[i], d.viirsH[i], d.harmonized[i], d.raw[i], d.z[i], d.anomaly[i],
      d.ratio.byMonth[cal - 1], note ? `"${note}"` : '',
    ].map((v) => (v === null || v === undefined ? '' : v)).join(','))
  })
  return rows.join('\n')
}
