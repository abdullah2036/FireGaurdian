// Method & Data: harmonization method, validation (per-year, ratio, LOYO, scatter), mask report, sources.
// AI-assisted: written with Claude Code (Anthropic) for NASA Space Apps 2026.
import { useMemo, useState } from 'react'
import { useApp } from '@/lib/store'
import { useCalendar, useIndex } from '@/lib/data'
import { MONTHS, type CalendarData, type IndexData } from '@/lib/types'
import { fmt } from '@/lib/utils'
import { Badge, Panel, Segmented, StateBox } from '@/components/ui'
import { EChart, axis, baseOption, C } from '@/components/EChart'

export function MethodView() {
  const { region } = useApp()
  const { data, error, loading } = useCalendar(region)
  const idx = useIndex()
  if (error) return <Panel><StateBox kind="error">{error}</StateBox></Panel>
  if (loading || !data) return <Panel><StateBox kind="loading" /></Panel>
  return (
    <div className="grid gap-3">
      <Headline data={data} />
      <div className="grid gap-3 xl:grid-cols-2">
        <PerYear data={data} />
        <Ratio data={data} />
        <Loyo data={data} />
        <Scatter data={data} />
      </div>
      <div className="grid gap-3 xl:grid-cols-[1.2fr_1fr]">
        <Method data={data} />
        {idx.data && <MaskReport idx={idx.data} />}
      </div>
      <Sources />
    </div>
  )
}

function Headline({ data }: { data: CalendarData }) {
  const v = data.validation
  const a = v.loyoSummary.medianAnnualAPE
  const stat = (label: string, value: string, note?: string, tone?: string) => (
    <div className="glass p-4 fade-up">
      <div className="label">{label}</div>
      <div className={`num mt-2 text-3xl ${tone ?? ''}`}>{value}</div>
      {note && <div className="mt-1 text-xs text-muted">{note}</div>}
    </div>
  )
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {stat('VIIRS / MODIS ratio', `${fmt(data.ratio.overall, 2)}×`, `${data.name}, ${v.overlapMonths} overlap months`, 'text-ember')}
      {stat('Monthly correlation', v.pearsonMonthly === null ? '—' : fmt(v.pearsonMonthly, 2), `Pearson r, MODIS vs VIIRS (log: ${fmt(v.pearsonMonthlyLog, 2)})`)}
      {stat('Leave-one-year-out error', a.monthly === null ? '—' : `${fmt(a.monthly, 1)}%`, 'median annual error, harmonized VIIRS vs MODIS', 'text-cyan')}
      {stat('Without harmonization', a.naive === null ? '—' : `${fmt(a.naive, 0)}%`, 'error if raw VIIRS were spliced onto MODIS')}
    </div>
  )
}

function PerYear({ data }: { data: CalendarData }) {
  const [log, setLog] = useState<'log' | 'linear'>('log')
  const option = useMemo(() => {
    const ys = data.years.filter((y) => !y.partial || y.year === 2026)
    return {
      ...baseOption,
      grid: { left: 52, right: 12, top: 32, bottom: 28 },
      xAxis: { type: 'category', data: ys.map((y) => (y.partial ? `${y.year}*` : String(y.year))), ...axis({ splitLine: { show: false } }) },
      yAxis: { type: log, ...axis(), min: log === 'log' ? 1 : 0 },
      series: [
        { name: 'Raw MODIS', type: 'line', data: ys.map((y) => y.modis), symbol: 'circle', symbolSize: 5, lineStyle: { color: C.modis, width: 2 }, itemStyle: { color: C.modis } },
        { name: 'Raw VIIRS', type: 'line', data: ys.map((y) => y.viirs), symbol: 'circle', symbolSize: 5, lineStyle: { color: C.viirs, width: 2 }, itemStyle: { color: C.viirs } },
        { name: 'Harmonized VIIRS (÷ ratio)', type: 'line', data: ys.map((y) => y.viirsH), symbol: 'diamond', symbolSize: 6, lineStyle: { color: C.harm, width: 2, type: 'dashed' }, itemStyle: { color: C.harm } },
      ],
    }
  }, [data, log])
  return (
    <Panel title="Per-year totals: raw MODIS vs raw VIIRS vs harmonized VIIRS" subtitle="After dividing by the learned monthly ratio, VIIRS lands on the MODIS line. * partial year."
      actions={<Segmented label="Y scale" value={log} onChange={setLog} options={[{ value: 'log', label: 'Log' }, { value: 'linear', label: 'Linear' }]} />}>
      <EChart option={option} height={280} label="Annual hotspot totals by sensor" />
    </Panel>
  )
}

function Ratio({ data }: { data: CalendarData }) {
  const option = useMemo(() => ({
    ...baseOption,
    grid: { left: 40, right: 12, top: 32, bottom: 28 },
    xAxis: { type: 'category', data: MONTHS, ...axis({ splitLine: { show: false } }) },
    yAxis: { type: 'value', name: 'VIIRS / MODIS', ...axis() },
    series: [
      { name: 'Raw month ratio', type: 'bar', data: data.ratio.rawByMonth, itemStyle: { color: 'rgba(255,122,61,0.35)', borderRadius: [3, 3, 0, 0] }, barGap: '-100%', barWidth: '55%' },
      { name: 'Used (shrunk) ratio', type: 'bar', data: data.ratio.byMonth, itemStyle: { color: C.ember, borderRadius: [3, 3, 0, 0] }, barWidth: '30%' },
      { name: 'Overall', type: 'line', data: MONTHS.map(() => data.ratio.overall), symbol: 'none', lineStyle: { color: C.cyan, type: 'dashed', width: 1.5 } },
    ],
    tooltip: { ...baseOption.tooltip, formatter: (p: { dataIndex: number }[]) => {
      const i = p[0].dataIndex
      return `<b>${MONTHS[i]}</b><br/>raw ${fmt(data.ratio.rawByMonth[i], 2)} · used ${fmt(data.ratio.byMonth[i], 2)}<br/>MODIS n=${data.ratio.modisByMonth[i]} · VIIRS n=${data.ratio.viirsByMonth[i]}`
    } },
  }), [data])
  return (
    <Panel title="Calendar-month ratio" subtitle={`Ratio of sums over the overlap, shrunk toward the overall ratio when a month is sparse (weight n/(n+${data.ratio.shrinkK})).`}>
      <EChart option={option} height={280} label="VIIRS to MODIS ratio by calendar month" />
    </Panel>
  )
}

function Loyo({ data }: { data: CalendarData }) {
  const rows = data.validation.loyo
  const m = data.validation.loyoSummary.meanMonthlyMAE
  const option = useMemo(() => ({
    ...baseOption,
    grid: { left: 48, right: 12, top: 32, bottom: 28 },
    xAxis: { type: 'category', data: rows.map((r) => String(r.year)), ...axis({ splitLine: { show: false } }) },
    yAxis: { type: 'value', name: 'hotspots / yr', ...axis() },
    series: [
      { name: 'Actual MODIS', type: 'bar', data: rows.map((r) => r.actual), itemStyle: { color: 'rgba(251,191,36,0.55)', borderRadius: [3, 3, 0, 0] } },
      { name: 'Predicted from VIIRS (monthly ratio)', type: 'line', data: rows.map((r) => r.monthly), symbol: 'circle', symbolSize: 6, lineStyle: { color: C.cyan, width: 2 }, itemStyle: { color: C.cyan } },
      { name: 'Overall ratio only', type: 'line', data: rows.map((r) => r.overall), symbol: 'none', lineStyle: { color: C.violet, width: 1.5, type: 'dotted' } },
    ],
  }), [rows])
  return (
    <Panel title="Leave-one-year-out check" subtitle="Each year is held out, ratios are re-learned from the other years, and that year's MODIS total is predicted from VIIRS alone."
      actions={<Badge tone="cyan">monthly MAE {fmt(m.monthly, 1)} vs naive {fmt(m.naive, 0)}</Badge>}>
      {rows.length ? <EChart option={option} height={280} label="Leave-one-year-out validation" /> : <StateBox kind="empty">Too few overlap detections for this region.</StateBox>}
    </Panel>
  )
}

function Scatter({ data }: { data: CalendarData }) {
  const option = useMemo(() => {
    const pts: [number, number, string][] = []
    data.months.forEach((mm, i) => {
      if (data.modis[i] !== null && data.viirs[i] !== null && mm >= '2012-02') pts.push([data.modis[i] as number, data.viirs[i] as number, mm])
    })
    const mx = Math.max(1, ...pts.map((p) => p[0]))
    return {
      ...baseOption,
      grid: { left: 52, right: 16, top: 28, bottom: 36 },
      tooltip: { ...baseOption.tooltip, trigger: 'item', formatter: (p: { data: [number, number, string] }) => `${p.data[2]}<br/>MODIS ${p.data[0]} · VIIRS ${p.data[1]}` },
      xAxis: { type: 'value', name: 'MODIS / month', nameLocation: 'middle', nameGap: 24, ...axis() },
      yAxis: { type: 'value', name: 'VIIRS / month', ...axis() },
      series: [
        { name: 'Months', type: 'scatter', data: pts, symbolSize: 5, itemStyle: { color: 'rgba(255,122,61,0.6)' } },
        { name: `y = ${fmt(data.ratio.overall, 2)}x`, type: 'line', data: [[0, 0], [mx, mx * data.ratio.overall]], symbol: 'none', lineStyle: { color: C.cyan, type: 'dashed' } },
      ],
    }
  }, [data])
  return (
    <Panel title="Monthly MODIS vs VIIRS counts" subtitle={`Each dot is one overlap month. r = ${fmt(data.validation.pearsonMonthly, 2)}. Scatter grows with counts — small-fire regimes are noisier.`}>
      <EChart option={option} height={280} label="Scatter of monthly MODIS and VIIRS counts" />
    </Panel>
  )
}

function Method({ data }: { data: CalendarData }) {
  return (
    <Panel title="How the harmonization works">
      <ol className="grid gap-3 text-sm leading-relaxed text-muted">
        <li><b className="text-ink">1 · Clean.</b> Merge FIRMS archive + NRT files (archive wins in overlapping months), normalize the schema (MODIS confidence 0–100 and VIIRS l/n/h → one scale), keep type 0 or missing, and clip to the real region polygon (Natural Earth), not a bounding box.</li>
        <li><b className="text-ink">2 · Mask static heat.</b> Gas flares and industry are removed with the type, persistence, night-time and GIHS layers (see right).</li>
        <li><b className="text-ink">3 · Aggregate.</b> Hotspots per month per sensor family: MODIS (Terra + Aqua) and VIIRS (Suomi NPP).</li>
        <li><b className="text-ink">4 · Learn the ratio.</b> For each calendar month, VIIRS/MODIS = ΣVIIRS ÷ ΣMODIS over {data.validation.overlapMonths} overlap months since {data.validation.overlapStart}; sparse months shrink toward the overall ratio.</li>
        <li><b className="text-ink">5 · One scale.</b> VIIRS ÷ ratio puts it on the MODIS scale. The harmonized value is the <i>mean</i> of the MODIS-scale estimates available that month — never a sum — so the record runs 2001 → today and stays valid after MODIS ends.</li>
        <li><b className="text-ink">6 · Validate.</b> Leave-one-year-out prediction of MODIS from VIIRS, and correlation of monthly counts.</li>
      </ol>
      <p className="mt-4 rounded-lg border border-line p-3 text-xs text-muted">
        <b className="text-ink">Why the ratio is high in KSA.</b> Published comparisons for large-wildfire regions such as Portugal find VIIRS ≈ 2.8× MODIS. Saudi fires are mostly small agricultural and waste burns that 1 km MODIS often misses but 375 m VIIRS detects, so the ratio is regional (≈5–7 in Asir, Al Jawf and Ha'il; higher where small industrial sources may remain). That is why Fire Guardian learns it per region and month instead of using one global factor.
      </p>
    </Panel>
  )
}

function MaskReport({ idx }: { idx: IndexData }) {
  const m = idx.mask
  const rows = [
    ['Type 2 / 3 (static land, offshore)', m.removedByLayer.type],
    ['~1 km type-cells + persistence (dilated)', m.removedByLayer.fine],
    ['~5 km night-time persistence', m.removedByLayer.nightCoarse],
    ['GIHS industrial polygons', m.removedByLayer.gihs],
  ] as const
  return (
    <Panel title="Flare & industrial mask" subtitle={`${fmt(m.inputDetections)} detections in the KSA download → ${fmt(m.kept)} kept (${fmt((m.kept / m.inputDetections) * 100, 1)}%).`}>
      <ul className="grid gap-2 text-sm">
        {rows.map(([label, n]) => (
          <li key={label} className="flex items-center gap-3">
            <span className="flex-1 text-muted">{label}</span>
            <span className="h-1.5 w-28 overflow-hidden rounded-full bg-white/[0.05]"><span className="block h-full bg-ember" style={{ width: `${(n / m.inputDetections) * 100}%` }} /></span>
            <span className="num w-16 text-right">−{fmt(n)}</span>
          </li>
        ))}
      </ul>
      <dl className="mt-4 grid gap-1.5 text-xs text-faint">
        {Object.entries(m.rules).map(([k, v]) => <div key={k}><dt className="inline text-muted">{k}: </dt><dd className="inline">{String(v)}</dd></div>)}
        <div><dt className="inline text-muted">GIHS: </dt><dd className="inline">{m.gihs} · {m.gihsPolygons} polygons in the KSA window</dd></div>
      </dl>
    </Panel>
  )
}

function Sources() {
  const src = [
    ['NASA FIRMS', 'MODIS C6.1 (MCD14) and VIIRS S-NPP C2 (VNP14IMG) active fire archive + NRT', 'https://firms.modaps.eosdis.nasa.gov/'],
    ['GIHS v3.0', 'Global Remote Industrial Heat Sources, Ma et al. 2024, Scientific Data (CC BY 4.0)', 'https://doi.org/10.5281/zenodo.8308133'],
    ['Natural Earth', '1:10m admin-0 countries and admin-1 provinces (public domain)', 'https://www.naturalearthdata.com/'],
    ['NASA GIBS', 'VIIRS true colour & thermal anomaly WMTS overlays (Live Map)', 'https://www.earthdata.nasa.gov/engage/open-data-services-software/earthdata-developer-portal/gibs-api'],
    ['NASA POWER · Meteomatics', 'Historical and forecast weather for the Risk Outlook', 'https://power.larc.nasa.gov/'],
  ]
  return (
    <Panel title="Data sources">
      <ul className="grid gap-2 text-sm md:grid-cols-2">
        {src.map(([n, d, u]) => (
          <li key={n} className="rounded-lg border border-line p-3">
            <a href={u} target="_blank" rel="noreferrer" className="font-medium text-cyan hover:underline">{n}</a>
            <p className="mt-0.5 text-xs text-muted">{d}</p>
          </li>
        ))}
      </ul>
    </Panel>
  )
}
