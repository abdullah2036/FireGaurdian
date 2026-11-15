// Map page building blocks: view switch, legend, and one plain-language panel per view
// (Live fires · Heat sources · Forecast · Danger zones). Shared by the desktop side panel and the
// phone bottom sheet. Every classified hotspot carries a short "why we think so" with its evidence.
// AI-assisted: written with Claude Code (Anthropic) for NASA Space Apps 2026.
import { useMemo, useState, type ReactNode } from 'react'
import { AlertTriangle, ChevronDown, ChevronRight, CloudSun, Droplets, Factory, Flame, HelpCircle, Plane, Radar, Sparkles, Thermometer, Wind } from 'lucide-react'
import { useApp, type MapLayer } from '@/lib/store'
import { useLive, aiCellAt, type Cluster, type AICell, type SourceClass } from '@/lib/live'
import { useJSON } from '@/lib/data'
import { compass, provinceOf } from '@/lib/geo'
import { useT, type Key } from '@/lib/i18n'
import { gibsSnapshot, useWeather } from './panels'
import { ICON, iconFor } from './FireMap'
import { cn, fmt } from '@/lib/utils'

// ---------- helpers ----------
export const fireLevel = (c: Cluster): 'small' | 'moderate' | 'strong' => (c.frpSum >= 15 ? 'strong' : c.frpSum >= 3 ? 'moderate' : 'small')
const LEVEL_PILL = {
  low: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300',
  elevated: 'border-amber-400/40 bg-amber-400/10 text-amber-300',
  high: 'border-red-500/40 bg-red-500/15 text-red-300',
} as const
const TYPE_KEYS = ['power', 'cement', 'steel', 'refinery', 'petrochemical', 'aluminium', 'chemical', 'flare', 'oil_gas', 'offshore', 'industrial'] as const

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
function useTypeLabel() {
  const { t } = useT()
  return (sub: string | null | undefined) => t((sub && (TYPE_KEYS as readonly string[]).includes(sub) ? `type.${sub}` : 'type.unknown') as Key)
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

/** Name of the place, localized (province, else coordinates). */
export function usePlaceName() {
  const { regions } = useLive()
  const { place, latlon } = useT()
  return (lat: number, lon: number) => {
    const p = provinceOf(regions, lat, lon)
    return p ? place(p) : latlon(lat, lon)
  }
}

// ---------- view switch ----------
const MODES: { id: MapLayer; icon: typeof Flame; key: Key; hint: Key; tone: string }[] = [
  { id: 'live', icon: Flame, key: 'mode.live', hint: 'mode.live.hint', tone: 'text-red-400' },
  { id: 'sources', icon: Factory, key: 'mode.sources', hint: 'mode.sources.hint', tone: 'text-slate-300' },
  { id: 'forecast', icon: Sparkles, key: 'mode.forecast', hint: 'mode.forecast.hint', tone: 'text-amber-300' },
  { id: 'danger', icon: AlertTriangle, key: 'mode.danger', hint: 'mode.danger.hint', tone: 'text-orange-400' },
]

export function ModeSwitch({ phone = false }: { phone?: boolean }) {
  const { layer, set } = useApp()
  const { setOutlookOffset } = useLive()
  const { t } = useT()
  return (
    <div role="tablist" aria-label="Map view" className={cn('flex gap-1.5', phone ? 'no-scrollbar overflow-x-auto px-3' : 'flex-wrap')}>
      {MODES.map((m) => {
        const on = layer === m.id
        return (
          <button key={m.id} role="tab" aria-selected={on} onClick={() => { set({ layer: m.id }); setOutlookOffset(0) }}
            className={cn('inline-flex shrink-0 items-center gap-2 rounded-full border transition-colors cursor-pointer',
              phone ? 'h-9 gap-1.5 px-3 text-[13px] backdrop-blur-md' : 'h-11 px-5 text-[14px]',
              on ? 'border-white/30 bg-white text-[#0b0f1a] font-medium' : 'border-white/12 bg-black/45 text-ink hover:bg-white/10')}>
            <m.icon size={phone ? 15 : 16} className={on ? '' : m.tone} />
            {t(m.key)}
            {!phone && on && <span className="hidden text-[12px] font-normal text-[#0b0f1a]/60 2xl:inline">· {t(m.hint)}</span>}
          </button>
        )
      })}
    </div>
  )
}

// ---------- legend ----------
function SrcIcon({ kind, off }: { kind: keyof typeof ICON; off?: boolean }) {
  return <span className={cn('fg-src !static !h-5 !w-5 shrink-0', off && 'fg-src-off')}><svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor"><path d={ICON[kind]} /></svg></span>
}
function Swatch({ kind }: { kind: 'fire' | 'unc' | 'season' | 'zone' | 'aiLow' | 'aiMid' | 'aiHigh' | 'sel' | 'site' }) {
  if (kind === 'fire') return <span className="fg-fire !static !h-5 !w-5 shrink-0"><svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor"><path d={ICON.flame} /></svg></span>
  if (kind === 'unc') return <span className="fg-unc !static !h-5 !w-5 shrink-0 !text-[11px]">?</span>
  if (kind === 'site') return <span className="h-3 w-3 shrink-0 rounded-full border border-slate-300/70 bg-slate-400/35" />
  if (kind === 'season') return <span className="h-3 w-5 shrink-0 rounded-full" style={{ background: 'radial-gradient(circle, rgba(249,115,22,0.9), rgba(253,224,71,0.25) 70%, transparent)' }} />
  if (kind === 'zone') return <span className="h-3.5 w-3.5 shrink-0 rounded-[3px] border border-orange-300 bg-orange-500/60" />
  if (kind === 'sel') return <span className="fg-sel !static !h-4 !w-4 shrink-0" />
  const c = kind === 'aiHigh' ? 'bg-red-500/70' : kind === 'aiMid' ? 'bg-amber-400/60' : 'bg-emerald-400/40'
  return <span className={cn('h-3.5 w-3.5 shrink-0 rounded-[3px] border border-dashed border-white/80', c)} />
}

export function Legend({ mode, className }: { mode: MapLayer; className?: string }) {
  const { t } = useT()
  const { aiOnMap } = useLive()
  const row = (sw: ReactNode, label: ReactNode) => <li className="flex items-center gap-2">{sw}<span>{label}</span></li>
  return (
    <div className={cn('rounded-xl border border-white/10 bg-black/60 p-3 text-[12px] text-ink/90 backdrop-blur-md', className)}>
      <div className="label mb-1.5">{t('legend.title')}</div>
      <ul className="grid gap-1.5">
        {mode === 'live' && <>{row(<Swatch kind="fire" />, <>{t('legend.fire')} <span className="text-faint">· {t('legend.fire.big')}</span></>)}{row(<Swatch kind="unc" />, t('legend.unc'))}</>}
        {mode === 'sources' && <>
          {row(<SrcIcon kind="factory" />, t('legend.src.factory'))}
          {row(<SrcIcon kind="power" />, t('legend.src.power'))}
          {row(<SrcIcon kind="flare" />, t('legend.src.flare'))}
          {row(<SrcIcon kind="offshore" off />, t('legend.src.offshore'))}
          {row(<Swatch kind="site" />, t('legend.sites'))}
        </>}
        {mode === 'forecast' && <>
          {row(<Swatch kind="season" />, t('legend.season'))}
          {aiOnMap && <li className="flex flex-wrap items-center gap-x-2 gap-y-1"><span className="w-full text-muted">{t('legend.ai')}</span>
            <span className="inline-flex items-center gap-1"><Swatch kind="aiLow" />{t('level.low')}</span>
            <span className="inline-flex items-center gap-1"><Swatch kind="aiMid" />{t('level.elevated')}</span>
            <span className="inline-flex items-center gap-1"><Swatch kind="aiHigh" />{t('level.high')}</span></li>}
        </>}
        {mode === 'danger' && <>{row(<Swatch kind="fire" />, t('dg.fires'))}{row(<Swatch kind="zone" />, t('legend.zone'))}</>}
        {row(<Swatch kind="sel" />, t('legend.you'))}
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

// ---------- evidence ("why we think so") ----------
interface Eval { overall: { fire: { n: number; fire: number }; industrial: { n: number; industrial: number } } }
function useTested() {
  const { data } = useJSON<Eval>('/data/heat-eval.json')
  return data ? { f: Math.round((data.overall.fire.fire / data.overall.fire.n) * 100), i: Math.round((data.overall.industrial.industrial / data.overall.industrial.n) * 100) } : null
}

function Why({ cls }: { cls: SourceClass | null }) {
  const { t, lang } = useT()
  const live = useLive()
  const typeLabel = useTypeLabel()
  const tested = useTested()
  const per = live.firms?.nasaLabelPeriod
  if (!cls) return null
  const s = cls.staticIndex == null ? null : Math.round(cls.staticIndex * 100)
  const main: Record<SourceClass['reason'], string> = {
    nasa_offshore: t('why.nasa_offshore', { n: cls.nasa.offshore }),
    nasa_static: t('why.nasa_static', { n: cls.nasa.static + cls.nasa.offshore, from: per?.from ?? '2024', to: per?.to ?? '2026' }),
    gihs: t('why.gihs'), long_running: t('why.long_running', { m: cls.nasa.months }),
    nasa_fire_history: t('why.nasa_fire_history', { n: cls.nasa.fire, from: per?.from ?? '2024', to: per?.to ?? '2026' }),
    thermal_model: cls.category === 'fire' ? t('why.thermal_fire', { s: s ?? '—' }) : t('why.thermal_ind', { s: s ?? '—' }),
    persistent: t('why.persistent'), live_repeat: t('why.live_repeat'), facility: t('why.none'), none: t('why.none'),
  }
  const f = cls.facility
  const extra: string[] = []
  if (cls.reason !== 'thermal_model' && s != null) extra.push(cls.staticIndex! >= 0.5 ? t('why.thermal_ind', { s }) : t('why.thermal_fire', { s }))
  extra.push(f ? t('why.facility', { name: (lang === 'ar' && f.nameAr) || f.name || typeLabel(f.type), type: typeLabel(f.type), km: f.km, src: f.source }) : t('why.noFacility'))
  return (
    <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-[12.5px]">
      <div className="mb-1.5 flex items-center gap-2"><span className="font-medium">{t('why.title')}</span>
        <span className="ms-auto text-[11px] text-muted">{t(`why.conf.${cls.confidence}` as Key)}</span></div>
      <ul className="grid gap-1 text-ink/90">
        <li className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan" />{main[cls.reason]}</li>
        {extra.map((x) => <li key={x} className="flex gap-2 text-muted"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-white/30" />{x}</li>)}
      </ul>
      {tested && <p className="mt-2 text-[11px] text-faint">{t('why.tested', tested)}</p>}
    </div>
  )
}

function ThermalImage({ c }: { c: Cluster }) {
  const { t } = useT()
  const snap = gibsSnapshot('VIIRS_NOAA20_CorrectedReflectance_BandsM11-I2-I1', c.lat, c.lon, c.latest.slice(0, 10))
  const [loaded, setLoaded] = useState(false)
  return (
    <>
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
    </>
  )
}

function SelectedCluster({ c, kind }: { c: Cluster; kind: 'fire' | 'uncertain' | 'static' }) {
  const { t, lang } = useT()
  const { set } = useApp()
  const name = usePlaceName()
  const ago = useAgo()
  const typeLabel = useTypeLabel()
  const f = c.cls?.facility
  const title = kind === 'fire' ? t('fire.title') : kind === 'uncertain' ? t('src.unc.title') : typeLabel(c.subtype)
  const icon = kind === 'fire' ? <Flame size={17} className="text-red-400" /> : kind === 'uncertain' ? <HelpCircle size={17} className="text-amber-300" /> : <Factory size={17} className="text-slate-300" />
  return (
    <Section icon={icon} title={title}>
      <div className="text-[16px] font-medium">{kind === 'static' && f?.name ? ((lang === 'ar' && f.nameAr) || f.name) : name(c.lat, c.lon)}</div>
      <div className="mt-0.5 text-[12.5px] text-muted">
        {kind === 'fire' && <>{t(`fire.${fireLevel(c)}` as Key)} · </>}{ago(c.latest)} · {t('fire.points', { n: c.n })}{kind === 'static' && f?.name ? ` · ${name(c.lat, c.lon)}` : ''}
      </div>
      <Why cls={c.cls} />
      <ThermalImage c={c} />
      {kind === 'fire' && (
        <button onClick={() => set({ view: 'operations' })} className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-line-strong text-[13px] hover:bg-white/[0.05] cursor-pointer">
          <Plane size={15} /> {t('fire.drone')}
        </button>
      )}
    </Section>
  )
}

// ---------- LIVE ----------
function ClusterRow({ c, on, onPick, kind }: { c: Cluster; on: boolean; onPick: () => void; kind: 'fire' | 'uncertain' | 'static' }) {
  const { t, lang } = useT()
  const ago = useAgo()
  const name = usePlaceName()
  const typeLabel = useTypeLabel()
  const lvl = fireLevel(c)
  const f = c.cls?.facility
  const badge = kind === 'fire'
    ? <span className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-full', lvl === 'strong' ? 'bg-red-500' : lvl === 'moderate' ? 'bg-red-500/80' : 'bg-red-500/60')}><Flame size={15} className="text-white" /></span>
    : kind === 'uncertain' ? <span className="fg-unc !static !h-8 !w-8 shrink-0">?</span>
      : <span className={cn('fg-src !static !h-8 !w-8 shrink-0', c.category === 'offshore' && 'fg-src-off')}><svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d={ICON[iconFor(c.subtype)]} /></svg></span>
  return (
    <button onClick={onPick} className={cn('flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-start transition-colors cursor-pointer', on ? 'bg-white/10' : 'hover:bg-white/[0.05]')}>
      {badge}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px]">{kind === 'static' && f?.name ? ((lang === 'ar' && f.nameAr) || f.name) : name(c.lat, c.lon)}</span>
        <span className="block truncate text-[12px] text-muted">
          {kind === 'fire' ? t(`fire.${lvl}` as Key) : kind === 'static' ? typeLabel(c.subtype) : t('legend.unc')} · {ago(c.latest)}
        </span>
      </span>
      <ChevronRight size={16} className="shrink-0 text-faint rtl:rotate-180" />
    </button>
  )
}

function WindowSwitch() {
  const live = useLive()
  const { t } = useT()
  return (
    <div className="flex gap-1.5">
      {[1, 2, 5].map((d) => (
        <button key={d} onClick={() => live.setDays(d)} className={cn('h-8 flex-1 rounded-lg border text-[12px] cursor-pointer', live.days === d ? 'border-white/30 bg-white/10 text-ink' : 'border-line text-muted')}>
          {t(`win.${d}` as Key)}
        </button>
      ))}
    </div>
  )
}

export function LivePanel() {
  const live = useLive()
  const { t } = useT()
  const { set } = useApp()
  const sel = live.focus
  const selected = sel?.kind === 'fire' ? live.clusters.find((c) => c.id === sel.id) : sel?.kind === 'uncertain' ? live.uncertainClusters.find((c) => c.id === sel.id) : undefined
  const updated = live.firms ? new Date(live.firms.fetchedAt).toISOString().slice(11, 16) + ' UTC' : '—'
  const dets = live.firms?.detections ?? []
  const n = (c: string) => dets.filter((d) => (d.cls?.category ?? (d.static ? 'industrial' : 'fire')) === c).length
  return (
    <div className="grid gap-3">
      <Section icon={<Radar size={17} className="text-red-400" />} title={t('live.count')}
        right={<span className="font-display text-[26px] leading-none num">{live.firms ? live.clusters.length : '…'}</span>}>
        <WindowSwitch />
        {live.firms && <p className="mt-2 text-[12.5px] text-ink/90">{t('live.classified', { total: dets.length, f: n('fire'), i: n('industrial') + n('offshore'), u: n('uncertain') })}</p>}
        <p className="mt-1 text-[11.5px] text-faint">{t('live.updated', { time: updated })}</p>
        {live.firms?.mock && <p className="mt-1 text-[11.5px] text-danger">{t('status.mock')}</p>}
        <button onClick={() => set({ layer: 'sources' })} className="mt-2 inline-flex items-center gap-1.5 text-[12.5px] text-cyan hover:underline cursor-pointer">
          <Factory size={14} /> {t('live.seeSources')} <ChevronRight size={14} className="rtl:rotate-180" />
        </button>
      </Section>
      {live.clusters.length === 0 && live.firms && (
        <Section title={t('live.none')}><p className="text-[12.5px] text-muted">{t('live.none.sub')}</p></Section>
      )}
      {selected && <SelectedCluster c={selected} kind={sel!.kind as 'fire' | 'uncertain'} />}
      {live.clusters.length > 0 && (
        <Section title={t('live.list')}>
          <div className="grid gap-0.5">
            {live.clusters.slice(0, 12).map((c) => (
              <ClusterRow key={c.id} c={c} kind="fire" on={selected?.id === c.id}
                onPick={() => live.setFocus({ lat: c.lat, lon: c.lon, label: `Fire ${c.id}`, kind: 'fire', id: c.id })} />
            ))}
          </div>
          {!selected && <p className="mt-2 text-[11.5px] text-faint">{t('live.tap')}</p>}
        </Section>
      )}
      {live.uncertainClusters.length > 0 && (
        <Section icon={<HelpCircle size={16} className="text-amber-300" />} title={t('live.unc')} right={<span className="num text-muted">{live.uncertainClusters.length}</span>}>
          <div className="grid gap-0.5">
            {live.uncertainClusters.slice(0, 5).map((c) => (
              <ClusterRow key={c.id} c={c} kind="uncertain" on={selected?.id === c.id}
                onPick={() => live.setFocus({ lat: c.lat, lon: c.lon, label: `Unclear ${c.id}`, kind: 'uncertain', id: c.id })} />
            ))}
          </div>
        </Section>
      )}
      <WeatherMini />
    </div>
  )
}

// ---------- HEAT SOURCES ----------
export function SourcesPanel() {
  const live = useLive()
  const { t } = useT()
  const typeLabel = useTypeLabel()
  const sel = live.focus
  const selected = sel?.kind === 'static' ? live.staticClusters.find((c) => c.id === sel.id) : undefined
  const site = sel?.kind === 'site' && live.heatSites ? live.heatSites[Number(sel.id)] : undefined
  const per = live.heatSitesPeriod
  const byType = useMemo(() => {
    const m = new Map<string, number>()
    for (const c of live.staticClusters) m.set(c.subtype ?? 'unknown', (m.get(c.subtype ?? 'unknown') ?? 0) + 1)
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [live.staticClusters])
  const pts = (live.firms?.detections ?? []).filter((d) => d.cls?.category === 'industrial' || d.cls?.category === 'offshore').length
  return (
    <div className="grid gap-3">
      <Section icon={<Factory size={17} className="text-slate-300" />} title={t('src.count')}
        right={<span className="font-display text-[26px] leading-none num">{live.firms ? pts : '…'}</span>}>
        <p className="text-[12.5px] text-muted">{t('src.explain')}</p>
        <div className="mt-2"><WindowSwitch /></div>
        {byType.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {byType.map(([k, v]) => (
              <span key={k} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[12px]">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" className="text-slate-300"><path d={ICON[iconFor(k)]} /></svg>{typeLabel(k)} <span className="num text-faint">{v}</span>
              </span>
            ))}
          </div>
        )}
        {live.heatSites && <p className="mt-2 text-[11.5px] text-faint">{t('src.known', { n: live.heatSites.length })}</p>}
      </Section>
      {selected && <SelectedCluster c={selected} kind="static" />}
      {site && (
        <Section icon={<span className="h-3 w-3 rounded-full border border-slate-300/70 bg-slate-400/35" />} title={t('src.site.title')}>
          <div className="text-[16px] font-medium">{site.name || typeLabel(site.type)}</div>
          <div className="mt-0.5 text-[12.5px] text-muted">{typeLabel(site.type)}{site.source ? ` · ${site.source}${site.km != null ? `, ${site.km} km` : ''}` : ''}</div>
          <p className="mt-2 text-[12.5px] text-ink/90">{t('src.site.n', { n: fmt(site.n), from: per?.[0] ?? '', to: per?.[1] ?? '', night: Math.round(site.nightShare * 100) })}</p>
        </Section>
      )}
      {live.staticClusters.length > 0 && (
        <Section title={t('src.list')} right={<span className="num text-muted">{live.staticClusters.length}</span>}>
          <div className="grid gap-0.5">
            {live.staticClusters.slice(0, 14).map((c) => (
              <ClusterRow key={c.id} c={c} kind="static" on={selected?.id === c.id}
                onPick={() => live.setFocus({ lat: c.lat, lon: c.lon, label: `Source ${c.id}`, kind: 'static', id: c.id })} />
            ))}
          </div>
          {!selected && !site && <p className="mt-2 text-[11.5px] text-faint">{t('src.tap')}</p>}
        </Section>
      )}
    </div>
  )
}

// ---------- FORECAST ----------
interface Outlook { years: [number, number]; nYears: number; provinces: { id: string; name: string; months: { years: number; median: number }[] }[] }

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
    <div className="mt-2">
      <p className="text-[12px] text-muted">{t('fc.ai.area')}</p>
      {!ai && aiError && <p className="mt-2 text-[12.5px] text-amber-300">{t('fc.ai.unavailable')}</p>}
      {ai && cell && lvl && (
        <>
          <p className="mt-2 text-[12.5px]">{t('fc.ai.counts', { h: n('high'), m: n('elevated'), l: n('low') })}</p>
          <div className="mt-2 rounded-xl bg-white/[0.04] p-3">
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-muted">{here ? t('fc.ai.selected') : t('fc.ai.top')}</span>
              <span className={cn('ms-auto rounded-full border px-2.5 py-0.5 text-[12px] font-medium', LEVEL_PILL[cell.level!])}>{t(`level.${cell.level}` as Key)}</span>
            </div>
            <div className="mt-1 text-[15px] font-medium">{name(cell.lat, cell.lon)}</div>
            <p className="mt-1.5 text-[11.5px] text-faint">{t('fc.ai.hit', { p: (lvl.observed2025 * 100).toFixed(1), level: t(`level.${cell.level}` as Key) })}</p>
          </div>
          <div className="mt-2 flex gap-2">
            {!here && <button onClick={() => setFocus({ lat: cell.lat, lon: cell.lon, label: 'AI', kind: 'ai', id: `${cell.lat},${cell.lon}` })} className="h-9 flex-1 rounded-lg border border-line-strong text-[12.5px] cursor-pointer hover:bg-white/[0.05]">{t('fc.ai.focus')}</button>}
            <button onClick={() => set({ view: 'aimodel' })} className="h-9 flex-1 rounded-lg border border-line-strong text-[12.5px] cursor-pointer hover:bg-white/[0.05]">{t('fc.ai.reliable')}</button>
          </div>
        </>
      )}
    </div>
  )
}

export function ForecastPanel() {
  const { t, month, place } = useT()
  const live = useLive()
  const { data } = useJSON<Outlook>('/data/outlook.json')
  const [open, setOpen] = useState(false)
  const m = live.riskMonth
  const rows = useMemo(() => (data?.provinces ?? []).map((p) => {
    const avg = p.months.reduce((a, x) => a + x.median, 0) / 12
    const med = p.months[m].median
    const ratio = avg > 0 ? med / avg : 1
    return { ...p, med, season: ratio >= 1.25 ? 'up' : ratio <= 0.8 ? 'down' : 'avg' }
  }).sort((a, b) => b.med - a.med), [data, m])
  const zone = live.focus?.kind === 'zone' ? live.risk.find((r) => `${r.lat},${r.lon}` === live.focus!.id) : undefined
  return (
    <div className="grid gap-3">
      <Section icon={<Flame size={17} className="text-amber-300" />} title={t('fc.outlook.title', { month: month(m) })}>
        <div className="mb-2 flex gap-1.5">
          {[0, 1].map((o) => (
            <button key={o} onClick={() => live.setOutlookOffset(o)} className={cn('h-8 flex-1 rounded-lg border text-[12.5px] cursor-pointer', live.outlookOffset === o ? 'border-white/30 bg-white/10 text-ink' : 'border-line text-muted')}>
              {o === 0 ? t('fc.month.this') : t('fc.month.next')} · {month((live.month + o) % 12)}
            </button>
          ))}
        </div>
        <p className="text-[12px] text-muted">{t('fc.outlook.text')}</p>
        <ul className="mt-2 grid gap-1">
          {rows.slice(0, 8).map((r) => (
            <li key={r.id} className="flex items-center gap-2 text-[13.5px]">
              <span className="min-w-0 flex-1 truncate">{place(r.name)}</span>
              <span className={cn('rounded-full px-2 py-0.5 text-[11px]', r.season === 'up' ? 'bg-orange-500/15 text-orange-300' : r.season === 'down' ? 'bg-sky-500/10 text-sky-300' : 'bg-white/5 text-muted')}>
                {t(r.season === 'up' ? 'fc.outlook.up' : r.season === 'down' ? 'fc.outlook.down' : 'fc.outlook.avg')}
              </span>
              <span className="w-12 text-end num text-[12.5px]">{fmt(r.med)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-1 text-end text-[11px] text-faint">{t('fc.outlook.typical')}</p>
        {zone && <p className="mt-2 text-[12px] text-ink/90">{t('fc.season.zone', { p: Math.round(zone.p * 100), month: month(m) })}</p>}
      </Section>
      <Section icon={<Sparkles size={16} className="text-violet-300" />} title={t('fc.exp.title')}
        right={<button onClick={() => setOpen(!open)} aria-expanded={open} className="rounded p-1 text-muted hover:text-ink cursor-pointer"><ChevronDown size={16} className={cn('transition-transform', open && 'rotate-180')} /></button>}>
        <p className="text-[12px] text-muted">{t('fc.exp.note')}</p>
        <label className="mt-2 flex cursor-pointer items-center gap-2 text-[12.5px]">
          <input type="checkbox" checked={live.aiOnMap} onChange={(e) => { live.setAiOnMap(e.target.checked); if (e.target.checked) setOpen(true) }} className="h-4 w-4 accent-violet-400" />
          {t('fc.exp.show')}
        </label>
        {open && <AISummary />}
        <p className="mt-2 text-[11px] text-faint">{t('fc.ai.note')}</p>
      </Section>
      <WeatherMini />
    </div>
  )
}

// ---------- DANGER ----------
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

export function DangerPanel() {
  const { t, month, place } = useT()
  const live = useLive()
  const name = usePlaceName()
  const ago = useAgo()
  const zones = useSeasonAreas(0.5)
  const zoneCells = live.risk.filter((r) => r.level === 'high').length
  const total = live.clusters.length + zoneCells
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

export function ModePanel() {
  const { layer } = useApp()
  if (layer === 'sources') return <SourcesPanel />
  if (layer === 'forecast') return <ForecastPanel />
  if (layer === 'danger') return <DangerPanel />
  return <LivePanel />
}
