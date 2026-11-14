// Live operational state shared by Overview and Operations:
//  - NRT detections from /api/firms (NOAA-20/21 VIIRS, optional MODIS), flare-masked server-side
//  - active-fire clusters, seasonal risk cells (historical baseline until the AI model lands)
//  - a drone-fleet SIMULATION (hardware not tested) with auto-response and manual squadron launch
// AI-assisted: written with Claude Code (Anthropic) for NASA Space Apps 2026.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { FeatureCollection, Geometry } from 'geojson'
import { getJSON, useJSON } from './data'
import { haversineKm, provinceOf, type RegionProps } from './geo'

// ---------- types ----------
export interface Detection {
  lat: number; lon: number; date: string; time: string; satellite: string; source: string
  conf: 'l' | 'n' | 'h' | 'u'; frp: number | null; brightK: number | null; daynight: string; static: string | null
}
export interface FirmsResp { fetchedAt: string; sources: string[]; days: number; mock: boolean; errors: string[]; count: number; vegetation: number; detections: Detection[] }
export interface Cluster {
  id: string; lat: number; lon: number; n: number; frpSum: number; maxFrp: number; maxBrightK: number | null
  latest: string; province: string | null; members: Detection[]
}
export interface RiskData { cellDeg: number; years: [number, number]; cells: [number, number, number[]][] }
export type RiskLevel = 'high' | 'elevated' | 'low'
export interface RiskCell { lat: number; lon: number; p: number; level: RiskLevel }

export const SOURCE_OPTIONS = [
  { id: 'VIIRS_NOAA20_NRT,VIIRS_NOAA21_NRT', label: 'VIIRS (NOAA-20/21)' },
  { id: 'VIIRS_NOAA20_NRT,VIIRS_NOAA21_NRT,MODIS_NRT', label: 'MODIS / VIIRS' },
  { id: 'MODIS_NRT', label: 'MODIS (Terra/Aqua)' },
] as const
export const riskLevel = (p: number): RiskLevel => (p >= 0.5 ? 'high' : p >= 0.2 ? 'elevated' : 'low')

// ---------- drone fleet simulation ----------
export const SIM_SPEED = 30 // simulated seconds per real second
export const CRUISE_KMH = 110
export const RANGE_KM = 180

export interface Base { id: string; name: string; lat: number; lon: number }
export const BASES: Base[] = [
  { id: 'ABH', name: 'Abha', lat: 18.22, lon: 42.5 },
  { id: 'BAH', name: 'Al Baha', lat: 20.01, lon: 41.47 },
  { id: 'JZN', name: 'Jazan', lat: 16.89, lon: 42.55 },
  { id: 'NJR', name: 'Najran', lat: 17.49, lon: 44.13 },
  { id: 'TIF', name: 'Taif', lat: 21.27, lon: 40.42 },
  { id: 'MED', name: 'Madinah', lat: 24.47, lon: 39.61 },
  { id: 'TBK', name: 'Tabuk', lat: 28.38, lon: 36.57 },
  { id: 'HAS', name: "Ha'il", lat: 27.52, lon: 41.69 },
  { id: 'BRD', name: 'Buraydah', lat: 26.33, lon: 43.97 },
  { id: 'RUH', name: 'Riyadh', lat: 24.71, lon: 46.68 },
  { id: 'SKK', name: 'Sakaka', lat: 29.97, lon: 40.21 },
  { id: 'HOF', name: 'Al-Ahsa', lat: 25.38, lon: 49.59 },
]
// D-01..D-09 = Squadron A (suppression, water/retardant); D-10..D-18 = Squadron B (preventive cooling spray)
const BASE_ORDER = ['ABH', 'BAH', 'JZN', 'TIF', 'HAS', 'RUH', 'NJR', 'MED', 'TBK', 'ABH', 'BAH', 'JZN', 'TIF', 'HAS', 'RUH', 'BRD', 'SKK', 'HOF']
export type Squadron = 'A' | 'B'
export interface Drone { id: string; squadron: Squadron; model: string; base: Base }
export const FLEET: Drone[] = BASE_ORDER.map((b, i) => ({
  id: `D-${String(i + 1).padStart(2, '0')}`,
  squadron: i < 9 ? 'A' : 'B',
  model: i < 9 ? 'AQUA-X (suppression)' : 'COOL-S (preventive spray)',
  base: BASES.find((x) => x.id === b)!,
}))

export interface Mission {
  id: string; droneId: string; kind: 'suppress' | 'scout' | 'cool'
  target: { lat: number; lon: number; label: string; ref: string }
  distKm: number; startSim: number; workMin: number; reason: string; trigger: 'auto' | 'manual'
}
export type DroneStatus = 'Standby' | 'Deploying' | 'Active' | 'Returning'
export interface DroneState {
  drone: Drone; status: DroneStatus; lat: number; lon: number; mission: Mission | null
  progress: number; coolant: number; etaMin: number | null; heading: number
}

const travelMin = (km: number) => (km / CRUISE_KMH) * 60

export function droneState(d: Drone, missions: Mission[], simNow: number): DroneState {
  const m = [...missions].reverse().find((x) => x.droneId === d.id)
  const idle: DroneState = { drone: d, status: 'Standby', lat: d.base.lat, lon: d.base.lon, mission: null, progress: 0, coolant: 100, etaMin: null, heading: 0 }
  if (!m) return idle
  const tMin = (simNow - m.startSim) / 60000
  const tr = travelMin(m.distKm)
  const lerp = (f: number) => ({ lat: d.base.lat + (m.target.lat - d.base.lat) * f, lon: d.base.lon + (m.target.lon - d.base.lon) * f })
  const heading = (Math.atan2(m.target.lon - d.base.lon, m.target.lat - d.base.lat) * 180) / Math.PI
  if (tMin < 0) return idle
  if (tMin < tr) return { ...idle, status: 'Deploying', ...lerp(tMin / tr), mission: m, etaMin: tr - tMin, heading }
  if (tMin < tr + m.workMin) {
    const p = (tMin - tr) / m.workMin
    return { ...idle, status: 'Active', lat: m.target.lat, lon: m.target.lon, mission: m, progress: p, coolant: Math.max(5, 100 - 88 * p), etaMin: 0, heading }
  }
  if (tMin < 2 * tr + m.workMin) {
    return { ...idle, status: 'Returning', ...lerp(1 - (tMin - tr - m.workMin) / tr), mission: m, progress: 1, coolant: 12, heading: heading + 180 }
  }
  return idle
}

/** QGroundControl .plan for one mission (simulation export; hardware not tested). */
export function qgcPlan(m: Mission, d: Drone) {
  const alt = m.kind === 'scout' ? 120 : 60
  const item = (id: number, command: number, lat: number, lon: number, a: number, params4 = [0, 0, 0, null]) => ({
    autoContinue: true, command, doJumpId: id, frame: 3, params: [...params4, lat, lon, a], type: 'SimpleItem',
  })
  return {
    fileType: 'Plan', version: 1, groundStation: 'QGroundControl',
    geoFence: { circles: [], polygons: [], version: 2 }, rallyPoints: { points: [], version: 2 },
    mission: {
      version: 2, firmwareType: 12, vehicleType: 2, cruiseSpeed: Math.round(CRUISE_KMH / 3.6), hoverSpeed: 5, globalPlanAltitudeMode: 1,
      plannedHomePosition: [d.base.lat, d.base.lon, 0],
      items: [
        item(1, 22, d.base.lat, d.base.lon, alt), // TAKEOFF
        item(2, 16, m.target.lat, m.target.lon, alt), // WAYPOINT to target
        item(3, 19, m.target.lat, m.target.lon, alt, [m.workMin * 60, 0, 0, null]), // LOITER_TIME over target
        item(4, 20, 0, 0, 0, [0, 0, 0, 0]), // RETURN_TO_LAUNCH
      ],
    },
    _note: `Fire Guardian SIMULATION export for ${d.id} (${m.kind}) — hardware not tested. ${m.reason}`,
  }
}

// ---------- clustering ----------
function clusterDetections(dets: Detection[], regions: FeatureCollection<Geometry, RegionProps> | null, wantStatic = false, prefix = 'C'): Cluster[] {
  const veg = dets.filter((d) => (wantStatic ? !!d.static : !d.static)).sort((a, b) => (b.frp ?? 0) - (a.frp ?? 0))
  const cs: { lat: number; lon: number; members: Detection[] }[] = []
  for (const d of veg) {
    const c = cs.find((c) => haversineKm(c.lat, c.lon, d.lat, d.lon) < 6)
    if (c) {
      c.members.push(d)
      c.lat += (d.lat - c.lat) / c.members.length
      c.lon += (d.lon - c.lon) / c.members.length
    } else cs.push({ lat: d.lat, lon: d.lon, members: [d] })
  }
  return cs.map((c, i) => {
    const frps = c.members.map((m) => m.frp ?? 0)
    const br = c.members.map((m) => m.brightK ?? 0).filter(Boolean)
    const latest = c.members.map((m) => `${m.date} ${m.time.slice(0, 2)}:${m.time.slice(2)}`).sort().at(-1)!
    return {
      id: `${prefix}${i + 1}`, lat: c.lat, lon: c.lon, n: c.members.length,
      frpSum: frps.reduce((a, b) => a + b, 0), maxFrp: Math.max(...frps), maxBrightK: br.length ? Math.max(...br) : null,
      latest, province: provinceOf(regions, c.lat, c.lon), members: c.members,
    }
  }).sort((a, b) => b.frpSum - a.frpSum)
}

export function severityOf(c: Cluster): 1 | 2 | 3 | 4 {
  return c.frpSum >= 100 ? 4 : c.frpSum >= 40 ? 3 : c.frpSum >= 10 ? 2 : 1
}

// ---------- context ----------
interface LiveCtx {
  sources: string; setSources: (s: string) => void
  days: number; setDays: (d: number) => void
  firms: FirmsResp | null; loading: boolean; error: string | null; reload: () => void
  clusters: Cluster[]; staticClusters: Cluster[]; risk: RiskCell[]; riskYears: [number, number] | null; month: number
  regions: FeatureCollection<Geometry, RegionProps> | null
  focus: { lat: number; lon: number; label: string } | null; setFocus: (f: { lat: number; lon: number; label: string }) => void
  simNow: () => number; tick: number
  missions: Mission[]; drones: DroneState[]
  autoResponse: boolean; setAutoResponse: (b: boolean) => void
  deploySquadron: (s: Squadron) => number
  log: { t: number; text: string; tone: 'info' | 'warn' | 'ok' }[]
}

const Ctx = createContext<LiveCtx | null>(null)

export function LiveProvider({ children }: { children: ReactNode }) {
  const [sources, setSources] = useState<string>(SOURCE_OPTIONS[0].id)
  const [days, setDays] = useState(2)
  const [nonce, setNonce] = useState(0)
  const [firms, setFirms] = useState<FirmsResp | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { data: regions } = useJSON<FeatureCollection<Geometry, RegionProps>>('/data/regions.geojson')
  const { data: riskRaw } = useJSON<RiskData>('/data/risk.json')
  const month = new Date().getUTCMonth()

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError(null)
    fetch(`/api/firms?source=${sources}&days=${days}${nonce ? `&_=${nonce}` : ''}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`FIRMS proxy ${r.status}`))))
      .then((j: FirmsResp) => alive && setFirms(j))
      .catch((e) => alive && setError(String(e.message ?? e)))
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [sources, days, nonce])
  // refresh every 10 minutes (server caches FIRMS for 10 min)
  useEffect(() => {
    const t = setInterval(() => setNonce((n) => n + 1), 600_000)
    return () => clearInterval(t)
  }, [])

  const clusters = useMemo(() => (firms ? clusterDetections(firms.detections, regions) : []), [firms, regions])
  const staticClusters = useMemo(() => (firms ? clusterDetections(firms.detections, regions, true, 'S') : []), [firms, regions])
  const risk = useMemo<RiskCell[]>(
    () => (riskRaw?.cells ?? []).map(([lat, lon, ps]) => ({ lat, lon, p: ps[month], level: riskLevel(ps[month]) })).filter((c) => c.p > 0),
    [riskRaw, month],
  )

  const [focusSel, setFocus] = useState<LiveCtx['focus']>(null)
  const focus = focusSel ?? (clusters[0]
    ? { lat: clusters[0].lat, lon: clusters[0].lon, label: `Hotspot ${clusters[0].id}${clusters[0].province ? ` · ${clusters[0].province}` : ''}` }
    : { lat: 20.01, lon: 41.47, label: 'Al Baha' })

  // simulation clock
  const t0 = useRef({ real: performance.now(), sim: Date.now() })
  const simNow = useCallback(() => t0.current.sim + (performance.now() - t0.current.real) * SIM_SPEED, [])
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 1000)
    return () => clearInterval(t)
  }, [])

  const [missions, setMissions] = useState<Mission[]>([])
  const missionsRef = useRef<Mission[]>([])
  const [autoResponse, setAutoResponse] = useState(true)
  const [log, setLog] = useState<LiveCtx['log']>([])
  const addLog = (text: string, tone: 'info' | 'warn' | 'ok' = 'info') => setLog((l) => [{ t: simNow(), text, tone }, ...l].slice(0, 80))

  const busy = (ms: Mission[], now: number) =>
    new Set(FLEET.filter((d) => droneState(d, ms, now).status !== 'Standby').map((d) => d.id))

  /** Plan missions for squadron(s); `stagger` back-dates starts so the demo opens mid-operation. */
  const plan = useCallback((squads: Squadron[], trigger: 'auto' | 'manual', stagger = false) => {
    const now = simNow()
    const ms = missionsRef.current
    {
      const taken = busy(ms, now)
      const servedRefs = new Set(ms.filter((m) => droneState(FLEET.find((d) => d.id === m.droneId)!, ms, now).status !== 'Standby').map((m) => m.target.ref))
      const out: Mission[] = []
      const pick = (sq: Squadron, lat: number, lon: number) =>
        FLEET.filter((d) => d.squadron === sq && !taken.has(d.id))
          .map((d) => ({ d, km: haversineKm(d.base.lat, d.base.lon, lat, lon) }))
          .filter((x) => x.km <= RANGE_KM)
          .sort((a, b) => a.km - b.km)
      if (squads.includes('A')) {
        for (const c of clusters.slice(0, 8)) {
          if (servedRefs.has(c.id)) continue
          const need = c.frpSum >= 50 ? 3 : c.frpSum >= 15 ? 2 : 1
          const cand = pick('A', c.lat, c.lon).slice(0, need)
          if (!cand.length) continue
          cand.forEach(({ d, km }, k) => {
            taken.add(d.id)
            const kind = c.maxFrp < 5 && need === 1 ? 'scout' : 'suppress'
            out.push({
              id: `M${Date.now().toString(36)}${out.length}`, droneId: d.id, kind,
              target: { lat: c.lat + k * 0.01, lon: c.lon + k * 0.01, label: `Hotspot ${c.id}${c.province ? ` · ${c.province}` : ''}`, ref: c.id },
              distKm: km, workMin: kind === 'scout' ? 10 : 20, trigger,
              startSim: now - (stagger ? (travelMin(km) * 60000 * (0.25 + 0.35 * ((out.length * 37) % 10) / 10)) : 0),
              reason: `${c.n} hotspot(s), FRP ${c.frpSum < 10 ? c.frpSum.toFixed(1) : c.frpSum.toFixed(0)} MW → ${kind === 'scout' ? 'scout & report' : 'suppression attempt'}`,
            })
          })
        }
      }
      if (squads.includes('B')) {
        const hot = risk.filter((r) => r.level === 'high').sort((a, b) => b.p - a.p)
        for (const r of hot) {
          const ref = `R${r.lat},${r.lon}`
          if (servedRefs.has(ref)) continue
          const cand = pick('B', r.lat, r.lon).slice(0, 1)
          if (!cand.length) continue
          const { d, km } = cand[0]
          taken.add(d.id)
          out.push({
            id: `M${Date.now().toString(36)}${out.length}`, droneId: d.id, kind: 'cool',
            target: { lat: r.lat, lon: r.lon, label: `Risk zone ${r.lat.toFixed(2)}°N ${r.lon.toFixed(2)}°E`, ref },
            distKm: km, workMin: 15, trigger,
            startSim: now - (stagger ? travelMin(km) * 60000 * 0.5 : 0),
            reason: `seasonal ignition frequency ${(r.p * 100).toFixed(0)}% this month → preventive cooling`,
          })
          if (out.filter((m) => m.kind === 'cool').length >= 5) break
        }
      }
      if (out.length) {
        missionsRef.current = [...ms, ...out]
        setMissions(missionsRef.current)
      }
      return out.length
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clusters, risk, simNow])

  // auto-response: (re)plan whenever live data changes, and every ~2 real minutes
  const firstPlan = useRef(true)
  useEffect(() => {
    if (!autoResponse || !firms || !risk.length) return
    const stagger = firstPlan.current
    firstPlan.current = false
    plan(['A', 'B'], 'auto', stagger)
  }, [autoResponse, firms, risk.length, plan])
  useEffect(() => {
    if (!autoResponse) return
    const t = setInterval(() => plan(['A', 'B'], 'auto'), 120_000)
    return () => clearInterval(t)
  }, [autoResponse, plan])

  const drones = useMemo(() => FLEET.map((d) => droneState(d, missions, simNow())),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [missions, tick])

  // mission log from new missions
  const seen = useRef(new Set<string>())
  useEffect(() => {
    for (const m of missions) {
      if (seen.current.has(m.id)) continue
      seen.current.add(m.id)
      addLog(`${m.droneId} dispatched (${m.trigger}) → ${m.target.label}: ${m.reason}. ${m.distKm.toFixed(0)} km, ETA ${travelMin(m.distKm).toFixed(0)} min.`, m.kind === 'cool' ? 'info' : 'warn')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missions])
  useEffect(() => {
    if (firms) addLog(`FIRMS update: ${firms.count} detections in KSA, ${firms.vegetation} after flare mask${firms.mock ? ' (MOCK DATA)' : ''}.`, 'ok')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firms])

  const value: LiveCtx = {
    sources, setSources, days, setDays, firms, loading, error, reload: () => setNonce((n) => n + 1),
    clusters, staticClusters, risk, riskYears: riskRaw?.years ?? null, month, regions, focus, setFocus, simNow, tick,
    missions, drones, autoResponse,
    setAutoResponse: (b) => { setAutoResponse(b); addLog(`Auto-response ${b ? 'enabled' : 'disabled'} by operator.`, 'info') },
    deploySquadron: (s) => {
      const n = plan([s], 'manual')
      return n
    },
    log,
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useLive() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useLive outside LiveProvider')
  return c
}

export { getJSON }
