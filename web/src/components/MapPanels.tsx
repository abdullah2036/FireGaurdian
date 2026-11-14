// Map page building blocks: view switch, legend, and one plain-language panel per view.
// Shared by the desktop side panel and the phone bottom sheet.
// AI-assisted: written with Claude Code (Anthropic) for NASA Space Apps 2026.
import { useMemo, useState, type ReactNode } from 'react'
import { AlertTriangle, ChevronRight, CloudSun, Droplets, Flame, Plane, Radar, Sparkles, Thermometer, Wind } from 'lucide-react'
import { useApp, type MapLayer } from '@/lib/store'
import { useLive, aiCellAt, type Cluster, type AICell } from '@/lib/live'
import { compass, provinceOf } from '@/lib/geo'
import { useT, type Key } from '@/lib/i18n'
import { gibsSnapshot, useWeather } from './panels'
import { cn, fmt } from '@/lib/utils'

// ---------- helpers ----------
export const fireLevel = (c: Cluster): 'small' | 'moderate' | 'strong' => (c.frpSum >= 15 ? 'strong' : c.frpSum >= 3 ? 'moderate' : 'small')
const LEVEL_PILL = {
  low: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300',
  elevated: 'border-amber-400/40 bg-amber-400/10 text-amber-300',
  high: 'border-red-500/40 bg-red-500/15 text-red-300',
} as const

function useAgo() {
  const { t } = useT()
  return (latest: string) => {
    const ms = Date.now() - Date.parse(latest.replace(' ', 'T') + ':00Z')
    const min = Math.max(1, Math.round(ms / 60000))
    if (min < 60) return t('fire.ago.m', { n: min })
    const h = Math.round(min / 60)
    return h < 48 ? t('fire.ago.h', { n: h }) : t('fire.ago.d', { n: Math.round(h / 24) })
  }
}

export function Section({ icon, title, right, children, className }: { icon?: ReactNode; title: string; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4', className)}>
      <header className="mb-2.5 flex items-center gap-2">
        {icon && <span className="text-ink/75">{icon}</span>}
        <h3 className="text-[14px] font-medium">{title}</h3>
        <div className="ms-auto">{right}</div>
      </header>
      {children}
    </section>
  )
}

// ---------- view switch ----------
const MODES: { id: MapLayer; icon: typeof Flame; key: Key; hint: Key; tone: string }[] = [
  { id: 'live', icon: Flame, key: 'mode.live', hint: 'mode.live.hint', tone: 'text-red-400' },
  { id: 'forecast', icon: Sparkles, key: 'mode.forecast', hint: 'mode.forecast.hint', tone: 'text-amber-300' },
  { id: 'danger', icon: AlertTriangle, key: 'mode.danger', hint: 'mode.danger.hint', tone: 'text-orange-400' },
]

export function ModeSwitch({ phone = false }: { phone?: boolean }) {
  const { layer, set } = useApp()
  const { t } = useT()
  return (
    <div role="tablist" aria-label="Map view" className={cn('flex gap-1.5', phone ? 'overflow-x-auto px-3 no-scrollbar' : 'flex-wrap')}>
      {MODES.map((m) => {
        const on = layer === m.id
        return (
          <button key={m.id} role="tab" aria-selected={on} onClick={() => set({ layer: m.id })}
            className={cn('inline-flex shrink-0 items-center gap-2 rounded-full border transition-colors cursor-pointer',
              phone ? 'h-9 gap-1.5 px-3 text-[13px] backdrop-blur-md' : 'h-11 px-5 text-[14px]',
              on ? 'border-white/30 bg-white text-[#0b0f1a] font-medium' : 'border-white/12 bg-black/45 text-ink hover:bg-white/10')}>
            <m.icon size={phone ? 15 : 16} className={on ? '' : m.tone} />
            {t(m.key)}
            {!phone && on && <span className="hidden text-[12px] font-normal text-[#0b0f1a]/60 xl:inline">· {t(m.hint)}</span>}
          </button>
        )
      })}
    </div>
  )
}

// ---------- legend ----------
function Swatch({ kind }: { kind: 'fire' | 'flare' | 'season' | 'zone' | 'aiLow' | 'aiMid' | 'aiHigh' | 'sel' }) {
  if (kind === 'fire') return <span className="fg-fire !static !h-5 !w-5 shrink-0"><svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor"><path d="M12 2c1 3 4 5 4 9a4 4 0 0 1-8 0c0-1.5.5-2.5 1.5-3.5C9 9 9.5 10.5 10.5 11 10 7 12 4 12 2Z" /></svg></span>
  if (kind === 'flare') return <span className="h-2.5 w-2.5 shrink-0 rounded-full border border-slate-900 bg-slate-400" />
  if (kind === 'season') return <span className="h-3 w-5 shrink-0 rounded-full" style={{ background: 'radial-gradient(circle, rgba(249,115,22,0.9), rgba(253,224,71,0.25) 70%, transparent)' }} />
  if (kind === 'zone') return <span className="h-3.5 w-3.5 shrink-0 rounded-[3px] border border-orange-300 bg-orange-500/60" />
  if (kind === 'sel') return <span className="fg-sel !static !h-4 !w-4 shrink-0" />
  const c = kind === 'aiHigh' ? 'bg-red-500/70' : kind === 'aiMid' ? 'bg-amber-400/60' : 'bg-emerald-400/40'
  return <span className={cn('h-3.5 w-3.5 shrink-0 rounded-[3px] border border-dashed border-white/80', c)} />
}

export function Legend({ mode, showFlares, className }: { mode: MapLayer; showFlares?: boolean; className?: string }) {
  const { t } = useT()
  const row = (k: Parameters<typeof Swatch>[0]['kind'], label: ReactNode) => (
    <li className="flex items-center gap-2"><Swatch kind={k} /><span>{label}</span></li>
  )
  return (
    <div className={cn('rounded-xl border border-white/10 bg-black/60 p-3 text-[12px] text-ink/90 backdrop-blur-md', className)}>
      <div className="label mb-1.5">{t('legend.title')}</div>
      <ul className="grid gap-1.5">
        {mode === 'live' && <>{row('fire', <>{t('legend.fire')} <span className="text-faint">· {t('legend.fire.big')}</span></>)}{showFlares && row('flare', t('legend.flare'))}</>}
        {mode === 'forecast' && <>
          {row('season', t('legend.season'))}
          <li className="flex flex-wrap items-center gap-x-2 gap-y-1"><span className="w-full text-muted">{t('legend.ai')}</span>
            <span className="inline-flex items-center gap-1"><Swatch kind="aiLow" />{t('level.low')}</span>
            <span className="inline-flex items-center gap-1"><Swatch kind="aiMid" />{t('level.elevated')}</span>
            <span className="inline-flex items-center gap-1"><Swatch kind="aiHigh" />{t('level.high')}</span></li>
        </>}
        {mode === 'danger' && <>{row('fire', t('dg.fires'))}{row('zone', t('legend.zone'))}{row('aiHigh', t('legend.aiHigh'))}</>}
        {row('sel', t('legend.you'))}
      </ul>
    </div>
  )
}

// ---------- weather for the selected place ----------
export function WeatherMini() {
  const { focus } = useLive()
  const { t } = useT()
  const { data, error } = useWeather(focus!.lat, focus!.lon)
  const dry = data && (data.now.humidity ?? 100) < 25 && (data.now.wind ?? 0) > 20
  const item = (icon: ReactNode, label: string, value: string) => (
    <div className="rounded-xl bg-white/[0.04] px-2 py-2 text-center">
      <div className="flex items-center justify-center gap-1 text-[11px] text-muted">{icon}{label}</div>
      <div className="mt-0.5 num text-[17px]" dir="ltr">{value}</div>
    </div>
  )
  return (
    <Section icon={<CloudSun size={17} />} title={t('wx.title')} right={data?.mock && <span className="text-[11px] text-danger">{t('wx.mock')}</span>}>
      {!data && !error && <div className="h-[62px] animate-pulse rounded-xl bg-white/[0.03]" />}
      {error && <p className="text-[12px] text-muted">{t('wx.unavailable')}</p>}
      {data && (
        <div className="grid grid-cols-3 gap-2">
          {item(<Wind size={12} />, t('wx.wind'), `${data.now.wind?.toFixed(0) ?? '—'} km/h ${compass(data.now.windDir)}`)}
          {item(<Droplets size={12} />, t('wx.humidity'), `${data.now.humidity?.toFixed(0) ?? '—'}%`)}
          {item(<Thermometer size={12} />, t('wx.temp'), `${data.now.temp?.toFixed(0) ?? '—'}°C`)}
        </div>
      )}
      {dry && <p className="mt-2 rounded-lg border border-amber-400/30 bg-amber-400/10 px-2.5 py-1.5 text-[12px] text-amber-200">{t('wx.dry')}</p>}
      <p className="mt-2 text-[11.5px] text-faint">{t('wx.hint')}</p>
    </Section>
  )
}

/** Name of the selected place, localized. */
export function usePlaceName() {
  const { regions } = useLive()
  const { place, latlon } = useT()
  return (lat: number, lon: number) => {
    const p = provinceOf(regions, lat, lon)
    return p ? place(p) : latlon(lat, lon)
  }
}

// ---------- LIVE ----------
function FireRow({ c, on, onPick }: { c: Cluster; on: boolean; onPick: () => void }) {
  const { t } = useT()
  const ago = useAgo()
  const name = usePlaceName()
  const lvl = fireLevel(c)
  return (
    <button onClick={onPick} className={cn('flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-start transition-colors cursor-pointer', on ? 'bg-white/10' : 'hover:bg-white/[0.05]')}>
      <span className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-full', lvl === 'strong' ? 'bg-red-500' : lvl === 'moderate' ? 'bg-red-500/80' : 'bg-red-500/60')}><Flame size={15} className="text-white" /></span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px]">{name(c.lat, c.lon)}</span>
        <span className="block text-[12px] text-muted">{t(`fire.${lvl}` as Key)} · {ago(c.latest)}</span>
      </span>
      <ChevronRight size={16} className="shrink-0 text-faint rtl:rotate-180" />
    </button>
  )
}

function SelectedFire({ c }: { c: Cluster }) {
  const { t } = useT()
  const { set } = useApp()
  const name = usePlaceName()
  const ago = useAgo()
  const snap = gibsSnapshot('VIIRS_NOAA20_CorrectedReflectance_BandsM11-I2-I1', c.lat, c.lon, c.latest.slice(0, 10))
  const [loaded, setLoaded] = useState(false)
  return (
    <Section icon={<Flame size={17} className="text-red-400" />} title={t('fire.title')}>
      <div className="text-[16px] font-medium">{name(c.lat, c.lon)}</div>
      <div className="mt-0.5 text-[12.5px] text-muted">{t(`fire.${fireLevel(c)}` as Key)} · {ago(c.latest)} · {t('fire.points', { n: c.n })}</div>
      <div className="relative mt-3 aspect-[16/9] overflow-hidden rounded-xl border border-line bg-black">
        <img src={snap.url} alt={t('fire.thermal')} onLoad={() => setLoaded(true)}
          className={cn('h-full w-full object-cover transition-opacity duration-500 [filter:grayscale(1)_contrast(1.35)_brightness(0.85)]', loaded ? 'opacity-100' : 'opacity-0')} />
        {c.members.map((d, i) => {
          const [x0, y0, x1, y1] = snap.bbox
          const left = ((d.lon - x0) / (x1 - x0)) * 100, top = (1 - (d.lat - y0) / (y1 - y0)) * 100
          return left >= 0 && left <= 100 && top >= 0 && top <= 100 ? <span key={i} className="fg-hot" style={{ left: `${left}%`, top: `${top}%` }} /> : null
        })}
        <span className="absolute start-2 top-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[10.5px] text-white/85">{t('fire.thermal')}</span>
        {c.maxBrightK && <span className="absolute bottom-2 end-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] num">{t('fire.temp', { t: (c.maxBrightK - 273.15).toFixed(0) })}</span>}
      </div>
      <p className="mt-1.5 text-[11px] text-faint">{t('fire.thermal.note')}</p>
      <button onClick={() => set({ view: 'operations' })} className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-line-strong text-[13px] hover:bg-white/[0.05] cursor-pointer">
        <Plane size={15} /> {t('fire.drone')}
      </button>
    </Section>
  )
}

export function LivePanel({ showFlares, setShowFlares }: { showFlares: boolean; setShowFlares: (b: boolean) => void }) {
  const live = useLive()
  const { t } = useT()
  const selected = live.focus?.kind === 'fire' ? live.clusters.find((c) => c.id === live.focus!.id) : undefined
  const updated = live.firms ? new Date(live.firms.fetchedAt).toISOString().slice(11, 16) + ' UTC' : '—'
  const flares = (live.firms?.detections ?? []).filter((d) => d.static).length
  return (
    <div className="grid gap-3">
      <Section icon={<Radar size={17} className="text-red-400" />} title={t('live.count')}
        right={<span className="font-display text-[26px] leading-none num">{live.firms ? live.clusters.length : '…'}</span>}>
        <div className="flex gap-1.5">
          {[1, 2, 5].map((d) => (
            <button key={d} onClick={() => live.setDays(d)} className={cn('h-8 flex-1 rounded-lg border text-[12px] cursor-pointer', live.days === d ? 'border-white/30 bg-white/10 text-ink' : 'border-line text-muted')}>
              {t(`win.${d}` as Key)}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11.5px] text-faint">{t('live.updated', { time: updated })}</p>
        {live.firms?.mock && <p className="mt-1 text-[11.5px] text-danger">{t('status.mock')}</p>}
        <label className="mt-2 flex cursor-pointer items-center gap-2 text-[12.5px] text-muted">
          <input type="checkbox" checked={showFlares} onChange={(e) => setShowFlares(e.target.checked)} className="h-4 w-4 accent-slate-400" />
          {t('live.showFiltered')} <span className="text-faint">({flares})</span>
        </label>
      </Section>
      {live.clusters.length === 0 && live.firms && (
        <Section title={t('live.none')}><p className="text-[12.5px] text-muted">{t('live.none.sub')}</p></Section>
      )}
      {selected && <SelectedFire c={selected} />}
      {live.clusters.length > 0 && (
        <Section title={t('live.list')}>
          <div className="grid gap-0.5">
            {live.clusters.slice(0, 12).map((c) => (
              <FireRow key={c.id} c={c} on={selected?.id === c.id}
                onPick={() => live.setFocus({ lat: c.lat, lon: c.lon, label: `Fire ${c.id}`, kind: 'fire', id: c.id })} />
            ))}
          </div>
          {!selected && <p className="mt-2 text-[11.5px] text-faint">{t('live.tap')}</p>}
        </Section>
      )}
      <WeatherMini />
    </div>
  )
}

// ---------- FORECAST ----------
function AISummary() {
  const { ai, aiError, focus, setFocus } = useLive()
  const { t } = useT()
  const { set } = useApp()
  const name = usePlaceName()
  const scored = (ai?.cells ?? []).filter((c) => c.scoreIndex != null).sort((a, b) => b.scoreIndex! - a.scoreIndex!)
  const here = focus && focus.kind === 'ai' ? aiCellAt(ai, focus.lat, focus.lon) : null
  const cell: AICell | undefined = here && here.scoreIndex != null ? here : scored[0]
  const n = (l: string) => scored.filter((c) => c.level === l).length
  const lvl = cell?.level ? ai!.levels.find((l) => l.id === cell.level) : null
  return (
    <Section icon={<Sparkles size={17} className="text-violet-300" />} title={t('fc.ai.title')}>
      <p className="text-[12px] text-muted">{t('fc.ai.area')}</p>
      {!ai && !aiError && <div className="mt-2 h-16 animate-pulse rounded-xl bg-white/[0.03]" />}
      {!ai && aiError && <p className="mt-2 text-[12.5px] text-amber-300">{t('fc.ai.unavailable')}</p>}
      {ai && cell && lvl && (
        <>
          <p className="mt-2 text-[12.5px]">{t('fc.ai.counts', { h: n('high'), m: n('elevated'), l: n('low') })}</p>
          <div className="mt-3 rounded-xl bg-white/[0.04] p-3">
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-muted">{here ? t('fc.ai.selected') : t('fc.ai.top')}</span>
              <span className={cn('ms-auto rounded-full border px-2.5 py-0.5 text-[12px] font-medium', LEVEL_PILL[cell.level!])}>{t(`level.${cell.level}` as Key)}</span>
            </div>
            <div className="mt-1 text-[16px] font-medium">{name(cell.lat, cell.lon)}</div>
            <p className="mt-1 text-[12.5px] text-muted">{t(`fc.ai.meaning.${cell.level}` as Key)}</p>
            <p className="mt-1.5 text-[11.5px] text-faint">{t('fc.ai.hit', { p: (lvl.observed2025 * 100).toFixed(1), level: t(`level.${cell.level}` as Key) })}</p>
          </div>
          <div className="mt-2 flex gap-2">
            {!here && <button onClick={() => setFocus({ lat: cell.lat, lon: cell.lon, label: 'AI', kind: 'ai', id: `${cell.lat},${cell.lon}` })} className="h-9 flex-1 rounded-lg border border-line-strong text-[12.5px] cursor-pointer hover:bg-white/[0.05]">{t('fc.ai.focus')}</button>}
            <button onClick={() => set({ view: 'aimodel' })} className="h-9 flex-1 rounded-lg border border-line-strong text-[12.5px] cursor-pointer hover:bg-white/[0.05]">{t('fc.ai.reliable')}</button>
          </div>
          <p className="mt-2 text-[11px] text-faint">{t('fc.ai.note')}</p>
        </>
      )}
    </Section>
  )
}

function useSeasonAreas(minP: number) {
  const { risk, regions } = useLive()
  return useMemo(() => {
    const counts = new Map<string, number>()
    for (const c of risk) if (c.p >= minP) {
      const p = provinceOf(regions, c.lat, c.lon)
      if (p) counts.set(p, (counts.get(p) ?? 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }, [risk, regions, minP])
}

export function ForecastPanel() {
  const { t, month, place } = useT()
  const live = useLive()
  const areas = useSeasonAreas(0.2).slice(0, 5)
  const zone = live.focus?.kind === 'zone' ? live.risk.find((r) => `${r.lat},${r.lon}` === live.focus!.id) : undefined
  return (
    <div className="grid gap-3">
      <AISummary />
      <Section icon={<Flame size={17} className="text-amber-300" />} title={t('fc.season.title')}>
        <p className="text-[12.5px] text-muted">{t('fc.season.text', { month: month(live.month) })}</p>
        <ul className="mt-2 grid gap-1">
          {areas.map(([p, n], i) => (
            <li key={p} className="flex items-center gap-2 text-[13.5px]">
              <span className="grid h-5 w-5 place-items-center rounded-full bg-amber-400/15 text-[11px] text-amber-300 num">{i + 1}</span>
              {place(p)} <span className="ms-auto text-[11.5px] text-faint num">{n}</span>
            </li>
          ))}
        </ul>
        {zone && <p className="mt-2 text-[12px] text-ink/90">{t('fc.season.zone', { p: Math.round(zone.p * 100), month: month(live.month) })}</p>}
      </Section>
      <WeatherMini />
    </div>
  )
}

// ---------- DANGER ----------
export function DangerPanel() {
  const { t, month, place } = useT()
  const live = useLive()
  const name = usePlaceName()
  const ago = useAgo()
  const aiHigh = (live.ai?.cells ?? []).filter((c) => c.level === 'high')
  const zones = useSeasonAreas(0.5)
  const zoneCells = live.risk.filter((r) => r.level === 'high').length
  const total = live.clusters.length + aiHigh.length + zoneCells
  const sel = live.focus
  const zone = sel?.kind === 'zone' ? live.risk.find((r) => `${r.lat},${r.lon}` === sel.id) : undefined
  return (
    <div className="grid gap-3">
      <Section icon={<AlertTriangle size={17} className="text-orange-400" />} title={t('dg.count')}
        right={<span className="font-display text-[26px] leading-none num">{total}</span>}>
        <p className="text-[12.5px] text-muted">{t('dg.explain', { month: month(live.month) })}</p>
      </Section>
      {zone && (
        <Section title={name(zone.lat, zone.lon)}>
          <p className="text-[12.5px] text-ink/90">{t('fc.season.zone', { p: Math.round(zone.p * 100), month: month(live.month) })}</p>
        </Section>
      )}
      {live.clusters.length > 0 && (
        <Section icon={<Flame size={16} className="text-red-400" />} title={t('dg.fires')} right={<span className="num text-muted">{live.clusters.length}</span>}>
          <div className="grid gap-0.5">
            {live.clusters.slice(0, 6).map((c) => (
              <button key={c.id} onClick={() => live.setFocus({ lat: c.lat, lon: c.lon, label: c.id, kind: 'fire', id: c.id })}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-start text-[13.5px] hover:bg-white/[0.05] cursor-pointer">
                <span className="h-2 w-2 rounded-full bg-red-500" />{name(c.lat, c.lon)}<span className="ms-auto text-[11.5px] text-faint">{ago(c.latest)}</span>
              </button>
            ))}
          </div>
        </Section>
      )}
      {aiHigh.length > 0 && (
        <Section icon={<Sparkles size={16} className="text-red-300" />} title={t('dg.ai')} right={<span className="num text-muted">{aiHigh.length}</span>}>
          {aiHigh.map((c) => (
            <button key={`${c.lat},${c.lon}`} onClick={() => live.setFocus({ lat: c.lat, lon: c.lon, label: 'AI', kind: 'ai', id: `${c.lat},${c.lon}` })}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-start text-[13.5px] hover:bg-white/[0.05] cursor-pointer">
              <span className="h-2.5 w-2.5 rounded-[3px] border border-dashed border-white/80 bg-red-500/70" />{name(c.lat, c.lon)}
            </button>
          ))}
        </Section>
      )}
      {zones.length > 0 && (
        <Section icon={<span className="h-3 w-3 rounded-[3px] border border-orange-300 bg-orange-500/60" />} title={t('dg.season', { month: month(live.month) })} right={<span className="num text-muted">{zoneCells}</span>}>
          <ul className="grid gap-1 text-[13.5px]">
            {zones.slice(0, 6).map(([p, n]) => <li key={p} className="flex px-2">{place(p)}<span className="ms-auto text-[11.5px] text-faint num">{fmt(n)}</span></li>)}
          </ul>
        </Section>
      )}
      {total === 0 && <Section title={t('dg.none')}><span /></Section>}
      <WeatherMini />
    </div>
  )
}

export function ModePanel({ showFlares, setShowFlares }: { showFlares: boolean; setShowFlares: (b: boolean) => void }) {
  const { layer } = useApp()
  if (layer === 'forecast') return <ForecastPanel />
  if (layer === 'danger') return <DangerPanel />
  return <LivePanel showFlares={showFlares} setShowFlares={setShowFlares} />
}
