// Overview side panels: AI prediction slot, satellite thermal feed, weather, drone fleet,
// response controls, system alerts.
// AI-assisted: written with Claude Code (Anthropic) for NASA Space Apps 2026.
import { useId, useMemo, useState, type ReactNode } from 'react'
import {
  AlertTriangle, ArrowRight, BrainCircuit, ChevronLeft, ChevronRight, Droplets, Layers as LayersIcon,
  Plane, Power, Rocket, Siren, Thermometer, Wind, CloudSun, Bell,
} from 'lucide-react'
import { useApp } from '@/lib/store'
import { useCalendar, useJSON } from '@/lib/data'
import { useLive, FLEET, RANGE_KM, severityOf, type Cluster, type DroneState } from '@/lib/live'
import { compass, haversineKm } from '@/lib/geo'
import { MONTHS } from '@/lib/types'
import { cn, fmt } from '@/lib/utils'
import { useT } from '@/lib/i18n'

// ---------- primitives ----------
export function Card({ icon, title, right, children, className }: { icon: ReactNode; title: string; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('fg-card p-4', className)}>
      <header className="mb-3 flex items-center gap-2.5">
        <span className="text-ink/80">{icon}</span>
        <h2 className="text-[14px] font-medium tracking-tight">{title}</h2>
        <div className="ml-auto flex items-center gap-2">{right}</div>
      </header>
      {children}
    </section>
  )
}

function Pill({ tone, children }: { tone: 'red' | 'green' | 'amber' | 'cyan' | 'muted'; children: ReactNode }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-medium',
      tone === 'red' && 'border-red-500/40 bg-red-500/15 text-red-300',
      tone === 'green' && 'border-emerald-400/40 bg-emerald-400/15 text-emerald-300',
      tone === 'amber' && 'border-amber-400/40 bg-amber-400/15 text-amber-300',
      tone === 'cyan' && 'border-cyan/40 bg-cyan-soft text-cyan',
      tone === 'muted' && 'border-line-strong text-muted')}>{children}</span>
  )
}

export function Sparkline({ values, marker, height = 44, color = '#cbd5e1', className }: { values: (number | null)[]; marker?: number; height?: number; color?: string; className?: string }) {
  const id = 'g' + useId().replace(/[^a-zA-Z0-9]/g, '')
  const vs = values.map((v) => v ?? NaN)
  const ok = vs.filter(Number.isFinite)
  if (ok.length < 2) return <div style={{ height }} />
  const lo = Math.min(...ok), hi = Math.max(...ok), W = 200
  const x = (i: number) => (i / (vs.length - 1)) * W
  const y = (v: number) => height - 3 - ((v - lo) / (hi - lo || 1)) * (height - 8)
  const pts = vs.map((v, i) => (Number.isFinite(v) ? `${x(i).toFixed(1)},${y(v).toFixed(1)}` : null)).filter(Boolean) as string[]
  return (
    <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" className={cn('w-full', className)} style={{ height }} aria-hidden>
      <defs><linearGradient id={id} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={color} stopOpacity="0.35" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      <path d={`M${pts[0]} L${pts.join(' L')} L${W},${height} L0,${height} Z`} fill={`url(#${id})`} />
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      {marker != null && Number.isFinite(vs[marker]) && <circle cx={x(marker)} cy={y(vs[marker])} r="3" fill="#fff" stroke={color} />}
    </svg>
  )
}

// ---------- LEFT ----------
/** Reserved slot for the AI prediction model. Until it lands, shows the harmonized seasonal baseline. */
export function AIPredictionCard() {
  const { region } = useApp()
  const { data } = useCalendar(region)
  const m = new Date().getUTCMonth()
  const med = data?.climatology.mean ?? []
  const avg = med.length ? med.reduce((a: number, b) => a + (b ?? 0), 0) / 12 : 0
  const idx = avg ? (med[m] ?? 0) / avg : null
  return (
    <Card icon={<BrainCircuit size={18} />} title="AI Fire Prediction" right={<Pill tone="muted">model coming soon</Pill>}>
      <div className="flex items-end gap-3">
        <div>
          <div className="font-display text-[34px] font-light leading-none">{idx == null ? '—' : idx.toFixed(1)}<span className="text-lg text-muted">×</span></div>
          <div className="mt-1 text-[11.5px] text-muted">{MONTHS[m]} activity vs. yearly average</div>
        </div>
        <Sparkline values={med} marker={m} className="flex-1" color="#e2e8f0" />
      </div>
      <div className="mt-3 rounded-lg border border-dashed border-line-strong px-3 py-2 text-[11.5px] leading-snug text-faint">
        <b className="font-medium text-muted">AI model slot.</b> The ignition-probability model plugs in here. Until then this card shows the harmonized MODIS + VIIRS seasonal baseline (2001–2025).
      </div>
    </Card>
  )
}

export function gibsSnapshot(layers: string, lat: number, lon: number, date: string, half = 0.18, w = 480, h = 270) {
  const dy = half * (h / w)
  const p = new URLSearchParams({
    SERVICE: 'WMS', REQUEST: 'GetMap', VERSION: '1.3.0', LAYERS: layers, CRS: 'EPSG:4326',
    BBOX: [lat - dy, lon - half, lat + dy, lon + half].map((v) => v.toFixed(4)).join(','),
    WIDTH: String(w), HEIGHT: String(h), FORMAT: 'image/jpeg', TIME: date,
  })
  return { url: `https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?${p}`, bbox: [lon - half, lat - dy, lon + half, lat + dy] as const }
}

export function ThermalFeedCard() {
  const live = useLive()
  const [k, setK] = useState(0)
  // Prefer vegetation fires; with none in the window, show what the flare mask removed.
  const masked = live.clusters.length === 0
  const list = (masked ? live.staticClusters : live.clusters).slice(0, 6)
  const c: Cluster | undefined = list[k % Math.max(1, list.length)]
  const snap = c && gibsSnapshot('VIIRS_NOAA20_CorrectedReflectance_BandsM11-I2-I1', c.lat, c.lon, c.latest.slice(0, 10))
  const [loaded, setLoaded] = useState<string | null>(null)
  return (
    <Card icon={<LayersIcon size={18} />} title="Satellite Thermal Feed" right={masked && c ? <Pill tone="muted">masked source</Pill> : <Pill tone="red">NRT</Pill>}>
      <div className="relative aspect-[16/9] overflow-hidden rounded-xl border border-line bg-black">
        {!c && <div className="grid h-full place-items-center text-xs text-muted">{live.loading ? 'Waiting for FIRMS…' : 'No vegetation fires in the window.'}</div>}
        {snap && (
          <>
            <img src={snap.url} alt={`VIIRS shortwave-infrared composite around hotspot ${c.id}`} onLoad={() => setLoaded(snap.url)}
              className={cn('h-full w-full object-cover transition-opacity duration-500 [filter:grayscale(1)_contrast(1.35)_brightness(0.85)]', loaded === snap.url ? 'opacity-100' : 'opacity-0')} />
            {c.members.map((d, i) => {
              const [x0, y0, x1, y1] = snap.bbox
              const left = ((d.lon - x0) / (x1 - x0)) * 100, top = (1 - (d.lat - y0) / (y1 - y0)) * 100
              if (left < 0 || left > 100 || top < 0 || top > 100) return null
              return <span key={i} className="fg-hot" style={{ left: `${left}%`, top: `${top}%` }} />
            })}
            <div className="absolute left-2 top-2 text-[10.5px] text-white/80 [text-shadow:0_1px_2px_#000]">{masked ? `Flare / industrial (masked) · ${c.province ?? 'KSA'}` : `Hotspot ${c.id}${c.province ? ` · ${c.province}` : ''}`}</div>
            {c.maxBrightK && (
              <div className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-md bg-black/70 px-2 py-1 text-[11px] num">
                <Thermometer size={12} /> {(c.maxBrightK - 273.15).toFixed(0)}°C
              </div>
            )}
            <div className="absolute bottom-2 left-2 text-[10px] text-white/60 num">{c.latest} UTC</div>
          </>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-faint">
        <span>VIIRS SWIR composite (NASA GIBS) · dots = FIRMS hotspots · °C = pixel brightness temp</span>
        {list.length > 1 && (
          <span className="flex shrink-0 gap-1">
            <button className="rounded p-0.5 hover:bg-white/10" aria-label="Previous hotspot" onClick={() => setK((k + list.length - 1) % list.length)}><ChevronLeft size={14} /></button>
            <button className="rounded p-0.5 hover:bg-white/10" aria-label="Next hotspot" onClick={() => setK((k + 1) % list.length)}><ChevronRight size={14} /></button>
          </span>
        )}
      </div>
    </Card>
  )
}

interface WxResp { mock: boolean; source: string; now: { temp: number | null; humidity: number | null; wind: number | null; windDir: number | null; time: string }; series: { time: string; temp: number | null; wind: number | null }[] }
export function useWeather(lat: number, lon: number) {
  const s = (v: number) => (Math.round(v * 4) / 4).toFixed(2)
  return useJSON<WxResp>(`/api/weather?lat=${s(lat)}&lon=${s(lon)}`)
}

export function WeatherCard() {
  const { focus } = useLive()
  const { data, loading, error } = useWeather(focus!.lat, focus!.lon)
  const nowIdx = data ? data.series.findIndex((r) => r.time.slice(0, 13) === data.now.time.slice(0, 13)) : -1
  const dry = data && (data.now.humidity ?? 100) < 25 && (data.now.wind ?? 0) > 20
  const row = (icon: ReactNode, label: string, value: ReactNode) => (
    <div className="flex items-center gap-2.5 text-[13px]"><span className="text-muted">{icon}</span><span className="w-16 text-muted">{label}</span><span className="num">{value}</span></div>
  )
  return (
    <Card icon={<CloudSun size={18} />} title="Weather Data" right={data && <Pill tone={data.mock ? 'red' : 'muted'}>{data.mock ? 'mock' : 'Meteomatics'}</Pill>}>
      <div className="mb-2 truncate text-[11px] text-faint">{focus!.label}</div>
      {loading && !data && <div className="h-[96px] animate-pulse rounded-lg bg-white/[0.03]" />}
      {error && <div className="text-xs text-danger">Weather unavailable: {error}</div>}
      {data && (
        <div className="flex items-end gap-2">
          <div className="grid gap-1.5">
            {row(<Wind size={15} />, 'Wind', `${data.now.wind?.toFixed(0) ?? '—'} km/h ${compass(data.now.windDir)}`)}
            {row(<Droplets size={15} />, 'Humidity', `${data.now.humidity?.toFixed(0) ?? '—'}%`)}
            {row(<Thermometer size={15} />, 'Temp', `${data.now.temp?.toFixed(0) ?? '—'}°C`)}
          </div>
          <Sparkline values={data.series.map((r) => r.temp)} marker={nowIdx >= 0 ? nowIdx : undefined} height={56} className="flex-1" />
        </div>
      )}
      {dry && <div className="mt-2 rounded-md border border-amber-400/30 bg-amber-400/10 px-2 py-1 text-[11px] text-amber-300">Fire-weather: dry air and strong wind favour spread.</div>}
      <div className="mt-1.5 text-[10.5px] text-faint">Temperature, −12 h → +12 h. Click a hotspot or zone on the map to change location.</div>
    </Card>
  )
}

// ---------- RIGHT ----------
const statusTone = (s: DroneState['status']): 'red' | 'amber' | 'cyan' | 'muted' => (s === 'Active' ? 'red' : s === 'Deploying' ? 'amber' : s === 'Returning' ? 'cyan' : 'muted')

export function FleetCard() {
  const { drones } = useLive()
  const { set } = useApp()
  const busy = drones.filter((d) => d.status !== 'Standby')
  const count = (s: DroneState['status']) => drones.filter((d) => d.status === s).length
  return (
    <Card icon={<Plane size={18} />} title="Drone Fleet Operations" right={<button onClick={() => set({ view: 'operations' })} className="inline-flex items-center gap-1 text-[11.5px] text-muted hover:text-ink">View all <ArrowRight size={13} /></button>}>
      <div className="flex items-baseline gap-2">
        <span className="font-display text-[30px] font-light leading-none num">{busy.length}</span>
        <span className="text-sm text-muted">/ {FLEET.length} drones on mission</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Pill tone="amber">Deploying {count('Deploying')}</Pill>
        <Pill tone="red">Active {count('Active')}</Pill>
        <Pill tone="cyan">Returning {count('Returning')}</Pill>
        <Pill tone="muted">Standby {count('Standby')}</Pill>
      </div>
      <ul className="mt-3 grid max-h-[132px] gap-1 overflow-y-auto pr-1 text-[12px]">
        {busy.slice(0, 12).map((d) => (
          <li key={d.drone.id} className="flex items-center gap-2">
            <span className={cn('num w-11', d.drone.squadron === 'A' ? 'text-orange-300' : 'text-cyan')}>{d.drone.id}</span>
            <Pill tone={statusTone(d.status)}>{d.status}</Pill>
            <span className="truncate text-muted">{d.mission?.target.label}</span>
            {d.status === 'Deploying' && <span className="ml-auto num text-faint">{d.etaMin!.toFixed(0)}m</span>}
          </li>
        ))}
        {!busy.length && <li className="text-muted">All drones on standby.</li>}
      </ul>
    </Card>
  )
}

export function ControlsCard() {
  const { autoResponse, setAutoResponse, deploySquadron } = useLive()
  const { t } = useT()
  const [msg, setMsg] = useState<string | null>(null)
  const deploy = (s: 'A' | 'B') => {
    const n = deploySquadron(s)
    setMsg(n ? t('drones.sent', { n }) : t('drones.noneFree'))
    setTimeout(() => setMsg(null), 4000)
  }
  return (
    <section className="fg-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        <button role="switch" aria-checked={autoResponse} onClick={() => setAutoResponse(!autoResponse)}
          className={cn('inline-flex h-9 flex-1 items-center justify-between gap-2 rounded-lg border px-3 text-[12.5px] cursor-pointer',
            autoResponse ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300' : 'border-line-strong text-muted')}>
          <span className="inline-flex items-center gap-1.5"><Power size={14} /> {t('drones.auto')}</span>
          <span className="font-medium">{autoResponse ? t('drones.on') : t('drones.off')}</span>
        </button>
        <button onClick={() => deploy('A')} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-red-500/90 px-3 text-[12.5px] font-medium text-white hover:bg-red-500 cursor-pointer shadow-[0_0_24px_-6px_rgba(239,68,68,0.8)]">
          <Rocket size={14} /> {t('drones.deployA')}
        </button>
        <button onClick={() => deploy('B')} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-cyan/40 bg-cyan-soft px-2.5 text-[12.5px] text-cyan cursor-pointer" aria-label="Deploy Squadron B (preventive cooling)">
          {t('drones.deployB')}
        </button>
      </div>
      {msg && <div role="status" className="mt-2 text-[11.5px] text-muted">{msg}</div>}
    </section>
  )
}

export interface Alert { id: string; level: 1 | 2 | 3 | 4; title: string; where: string; time: string; focus?: { lat: number; lon: number; label: string } }
export function useAlerts(): Alert[] {
  const { clusters } = useLive()
  return useMemo(() => {
    const out: Alert[] = []
    for (const c of clusters.slice(0, 12)) {
      const lvl = severityOf(c)
      // suppression coverage = Squadron A bases only
      const nearest = Math.min(...FLEET.filter((d) => d.squadron === 'A').map((d) => haversineKm(d.base.lat, d.base.lon, c.lat, c.lon)))
      const f = { lat: c.lat, lon: c.lon, label: `Hotspot ${c.id}${c.province ? ` · ${c.province}` : ''}` }
      if (lvl >= 3) out.push({ id: `${c.id}-spread`, level: lvl, title: c.n > 3 ? 'Rapid fire spread detected' : 'Intense fire detected', where: c.province ?? 'KSA', time: c.latest.slice(11), focus: f })
      else out.push({ id: `${c.id}-new`, level: lvl, title: 'New hotspot identified', where: c.province ?? 'KSA', time: c.latest.slice(11), focus: f })
      if (nearest > RANGE_KM) out.push({ id: `${c.id}-range`, level: 2, title: `Outside suppression range (${nearest.toFixed(0)} km) · notify Civil Defense`, where: c.province ?? 'KSA', time: c.latest.slice(11), focus: f })
    }
    return out.sort((a, b) => b.level - a.level)
  }, [clusters])
}

export function AlertsCard() {
  const alerts = useAlerts()
  const { setFocus } = useLive()
  const { set } = useApp()
  return (
    <Card icon={<Bell size={18} />} title="System Alerts"
      right={<>{alerts.length > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-red-500 px-1 text-[11px] font-semibold num">{alerts.length}</span>}
        <button onClick={() => set({ view: 'operations' })} className="inline-flex items-center gap-1 text-[11.5px] text-muted hover:text-ink">View all <ArrowRight size={13} /></button></>}>
      <ul className="grid max-h-[168px] gap-1 overflow-y-auto pr-1">
        {alerts.slice(0, 8).map((a) => (
          <li key={a.id}>
            <button onClick={() => a.focus && setFocus(a.focus)} className="flex w-full items-center gap-3 rounded-lg px-1.5 py-1.5 text-left hover:bg-white/[0.04] cursor-pointer">
              <AlertTriangle size={18} className={a.level >= 3 ? 'text-red-500' : a.level === 2 ? 'text-amber-400' : 'text-yellow-200/70'} fill="currentColor" fillOpacity={0.2} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px]">{a.title}</span>
                <span className="block text-[11px] text-muted">{a.where} · {a.time} UTC</span>
              </span>
              <ChevronRight size={14} className="text-faint" />
            </button>
          </li>
        ))}
        {!alerts.length && <li className="py-3 text-center text-xs text-muted">No active alerts.</li>}
      </ul>
    </Card>
  )
}

export function EmergencyBar() {
  const alerts = useAlerts()
  const { firms } = useLive()
  const lvl = alerts.reduce((m, a) => Math.max(m, a.level), 0)
  const names = ['Normal', 'Level 1 · Advisory', 'Level 2 · Watch', 'Level 3 · Warning', 'Level 4 · Severe']
  const top = alerts[0]
  return (
    <div role="status" className={cn('flex items-center gap-3 overflow-hidden rounded-xl border px-4 py-2 text-[12.5px]',
      lvl >= 4 ? 'border-red-500/50 bg-red-500/15' : lvl === 3 ? 'border-orange-500/40 bg-orange-500/10' : lvl === 2 ? 'border-amber-400/30 bg-amber-400/10' : 'border-line bg-white/[0.02]')}>
      <Siren size={16} className={lvl >= 3 ? 'text-red-400' : 'text-muted'} />
      <b className="shrink-0 font-semibold">{names[lvl]}</b>
      <span className="truncate text-muted">
        {top ? `${top.title} · ${top.where} · ${top.time} UTC` : 'No vegetation fires detected in the current window.'}
        {firms && ` · ${fmt(firms.vegetation)} vegetation hotspots / ${fmt(firms.count)} total (flares masked)`}
      </span>
    </div>
  )
}
