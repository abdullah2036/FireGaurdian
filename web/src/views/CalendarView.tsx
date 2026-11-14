// CORE view: the harmonized burning-activity calendar.
// AI-assisted: written with Claude Code (Anthropic) for NASA Space Apps 2026.
import { useMemo, useState } from 'react'
import { Download, SlidersHorizontal, AlertTriangle, Info } from 'lucide-react'
import { useApp } from '@/lib/store'
import { calendarCSV, useCalendar } from '@/lib/data'
import { MONTHS, type CalendarData } from '@/lib/types'
import { downloadText, fmt } from '@/lib/utils'
import { CalendarHeatmap, RampLegend, type CellSel } from '@/components/CalendarHeatmap'
import { Badge, Button, Drawer, Panel, Segmented, StateBox, Tip } from '@/components/ui'
import { EChart, axis, baseOption, C } from '@/components/EChart'

export function CalendarView() {
  const { region, mode, from, to } = useApp()
  const { data, error, loading } = useCalendar(region)
  const [sel, setSel] = useState<CellSel | null>(null)
  const [scale, setScale] = useState<'log' | 'linear'>('log')
  const [showAnom, setShowAnom] = useState(true)
  const [drawer, setDrawer] = useState(false)

  if (error) return <Panel><StateBox kind="error">Could not load calendar for “{region}”: {error}</StateBox></Panel>
  if (loading || !data) return <Panel><StateBox kind="loading">Loading harmonized calendar…</StateBox></Panel>

  const selYear = sel?.year ?? Number(data.summary.lastCompleteMonth.slice(0, 4))
  const series = mode === 'raw' ? data.raw : data.harmonized
  let max = 1
  data.months.forEach((m, i) => { if (m >= from && m <= to && series[i] !== null && !data.partial[m]) max = Math.max(max, series[i] as number) })

  return (
    <div className="grid gap-3">
      <Kpis data={data} />
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Panel
          title={<span>Burning-activity calendar <span className="text-muted font-normal">· {data.name}</span></span>}
          subtitle={mode === 'raw'
            ? 'RAW: MODIS until 2011, raw VIIRS from 2012 — note the artificial jump when VIIRS arrives.'
            : 'HARMONIZED: hotspots per month on the MODIS scale, one consistent series 2001 → today.'}
          actions={
            <>
              <RampLegend max={max} scale={scale} />
              <Tip side="bottom" label="Display options"><Button variant="ghost" aria-label="Display options" onClick={() => setDrawer(true)}><SlidersHorizontal size={15} /></Button></Tip>
              <Button onClick={() => downloadText(`novashift_${data.id}_${from}_${to}_monthly.csv`, calendarCSV(data, from, to))}>
                <Download size={15} /> CSV
              </Button>
            </>
          }
        >
          <CalendarHeatmap data={data} mode={mode} from={from} to={to} scale={scale} showAnomalies={showAnom} selected={sel} onSelect={setSel} />
          <Legend />
        </Panel>
        <div className="grid content-start gap-3">
          <Profile data={data} year={selYear} month={sel?.month} />
          <Rankings data={data} from={from} to={to} />
        </div>
      </div>
      <Caveats />
      <Drawer open={drawer} onOpenChange={setDrawer} title="Display options">
        <div className="grid gap-5 text-sm">
          <div className="grid gap-2"><span className="label">Color scale</span>
            <Segmented label="Color scale" value={scale} onChange={setScale} options={[{ value: 'log', label: 'Log' }, { value: 'linear', label: 'Linear' }]} />
            <p className="text-xs text-faint">Log keeps quiet months readable next to extreme ones.</p>
          </div>
          <div className="grid gap-2"><span className="label">Anomaly outlines</span>
            <Segmented label="Anomaly outlines" value={showAnom ? 'on' : 'off'} onChange={(v) => setShowAnom(v === 'on')} options={[{ value: 'on', label: 'Show' }, { value: 'off', label: 'Hide' }]} />
            <p className="text-xs text-faint">A month is anomalous when its robust z-score (log scale, vs the same calendar month in all other years) is ≥ 2 and it is at least 1.5× the median.</p>
          </div>
        </div>
      </Drawer>
    </div>
  )
}

function Kpis({ data }: { data: CalendarData }) {
  const s = data.summary
  const lc = s.lastCompleteMonth
  const diff = s.lastCompleteValue !== null && s.lastCompleteMedian ? (s.lastCompleteValue / s.lastCompleteMedian - 1) * 100 : null
  const medians = data.climatology.median.map((v, i) => ({ m: i, v: v ?? 0 })).sort((a, b) => b.v - a.v).slice(0, 3)
  const recentAnoms = data.months.map((m, i) => ({ m, a: data.anomaly[i] })).filter((x) => x.a === 1).slice(-3).reverse()
  const card = 'glass p-4 fade-up'
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div className={card}>
        <div className="label">Latest full month · {MONTHS[Number(lc.slice(5, 7)) - 1]} {lc.slice(0, 4)}</div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="num text-3xl font-medium">{fmt(s.lastCompleteValue, 1)}</span>
          <span className="text-xs text-muted">vs median <span className="num">{fmt(s.lastCompleteMedian, 1)}</span></span>
        </div>
        {diff !== null && (
          <div className="mt-1.5"><Badge tone={diff > 50 ? 'ember' : diff < -30 ? 'cyan' : 'muted'}>{diff >= 0 ? '▲' : '▼'} {fmt(Math.abs(diff))}% vs typical · z {fmt(s.lastCompleteZ, 1)}</Badge></div>
        )}
      </div>
      <div className={card}>
        <div className="label">Peak season (median month)</div>
        <div className="mt-2 font-display text-3xl">{MONTHS[s.peakMonth - 1]}</div>
        <div className="mt-1.5 text-xs text-muted">Top months: {medians.map((x) => `${MONTHS[x.m]} (${fmt(x.v, 1)})`).join(' · ')}</div>
      </div>
      <div className={card}>
        <div className="label">Most active years</div>
        <ol className="mt-2 grid gap-1">
          {s.topYears.slice(0, 3).map((t, i) => (
            <li key={t.year} className="flex items-baseline justify-between">
              <span className="num text-lg">{i === 0 ? <span className="text-ember">{t.year}</span> : t.year}</span>
              <span className="num text-xs text-muted">{fmt(t.harmonized)} hotspots</span>
            </li>
          ))}
        </ol>
      </div>
      <div className={card}>
        <div className="label">Anomalous months</div>
        <div className="mt-2 flex items-baseline gap-2"><span className="num text-3xl">{s.anomalyCount}</span><span className="text-xs text-muted">since 2001</span></div>
        <div className="mt-1.5 flex flex-wrap gap-1">{recentAnoms.map((a) => <Badge key={a.m} tone="cyan">{MONTHS[Number(a.m.slice(5, 7)) - 1]} {a.m.slice(0, 4)}</Badge>)}</div>
      </div>
    </div>
  )
}

function Profile({ data, year, month }: { data: CalendarData; year: number; month?: number }) {
  const { mode } = useApp()
  const option = useMemo(() => {
    const series = mode === 'raw' ? data.raw : data.harmonized
    const vals = MONTHS.map((_, i) => {
      const k = data.months.indexOf(`${year}-${String(i + 1).padStart(2, '0')}`)
      return k < 0 ? null : series[k]
    })
    const p25 = data.climatology.p25.map((v) => v ?? 0)
    const iqr = data.climatology.p75.map((v, i) => (v ?? 0) - p25[i])
    return {
      ...baseOption,
      grid: { left: 40, right: 10, top: 30, bottom: 24 },
      xAxis: { type: 'category', data: MONTHS, ...axis({ splitLine: { show: false } }) },
      yAxis: { type: 'value', ...axis() },
      series: [
        { name: 'p25', type: 'line', data: p25, stack: 'iqr', symbol: 'none', lineStyle: { opacity: 0 }, tooltip: { show: false } },
        { name: 'Typical range (IQR)', type: 'line', data: iqr, stack: 'iqr', symbol: 'none', lineStyle: { opacity: 0 }, areaStyle: { color: 'rgba(148,163,184,0.14)' } },
        {
          name: `${year}`, type: 'bar', data: vals.map((v, i) => ({ value: v, itemStyle: { color: i + 1 === month ? '#fff' : mode === 'raw' && year >= 2012 ? C.ember : C.cyan, borderRadius: [3, 3, 0, 0] } })),
          barWidth: '55%',
        },
        { name: 'Median', type: 'line', data: data.climatology.median, symbol: 'circle', symbolSize: 4, lineStyle: { color: C.ember, width: 1.5, type: 'dashed' }, itemStyle: { color: C.ember } },
      ],
      legend: { ...baseOption.legend, data: [`${year}`, 'Median', 'Typical range (IQR)'] },
    }
  }, [data, year, month, mode])
  return (
    <Panel title={<span>Monthly profile · <span className="num text-cyan">{year}</span></span>} subtitle="Selected year vs the historical median and interquartile range (harmonized). Click a heatmap row to change year.">
      <EChart option={option} height={230} label={`Monthly hotspots in ${year} compared with the median`} />
    </Panel>
  )
}

function Rankings({ data, from, to }: { data: CalendarData; from: string; to: string }) {
  const top = data.months
    .map((m, i) => ({ m, v: data.harmonized[i] }))
    .filter((x) => x.m >= from && x.m <= to && x.v !== null && !data.partial[x.m])
    .sort((a, b) => (b.v as number) - (a.v as number))
    .slice(0, 6)
  return (
    <Panel title="Most active months in range" subtitle="Harmonized hotspot counts (MODIS scale)">
      <ol className="grid gap-1.5">
        {top.map((t, i) => (
          <li key={t.m} className="flex items-center gap-3 text-sm">
            <span className="num w-4 text-faint">{i + 1}</span>
            <span className="num w-20">{MONTHS[Number(t.m.slice(5, 7)) - 1]} {t.m.slice(0, 4)}</span>
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.05]"><span className="block h-full rounded-full bg-ember" style={{ width: `${((t.v as number) / (top[0].v as number)) * 100}%` }} /></span>
            <span className="num w-12 text-right text-muted">{fmt(t.v, 0)}</span>
          </li>
        ))}
      </ol>
    </Panel>
  )
}

function Legend() {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[11px] text-muted">
      <span className="inline-flex items-center gap-1.5"><i className="h-3 w-3 rounded-[3px] ring-[1.5px] ring-cyan ring-offset-1 ring-offset-space" /> anomaly (high)</span>
      <span className="inline-flex items-center gap-1.5"><i className="h-3 w-3 rounded-[3px] outline outline-1 outline-dashed outline-muted" /> partial month</span>
      <span className="inline-flex items-center gap-1.5"><i className="h-3 w-3 rounded-[3px]" style={{ background: 'repeating-linear-gradient(135deg, rgba(148,163,184,.3) 0 2px, transparent 2px 4px)' }} /> no coverage</span>
      <span className="inline-flex items-center gap-1.5"><i className="h-1.5 w-1.5 rounded-full bg-ember" /> VIIRS begins (2012)</span>
      <span className="text-faint">Arrow keys move between cells.</span>
    </div>
  )
}

function Caveats() {
  const items = [
    { t: 'Terra-only before Jul 2002', d: 'Aqua MODIS launched mid-2002; 2001–Jun 2002 has one MODIS overpass pair per day, so counts are biased low.' },
    { t: 'Missing ≠ zero fire', d: 'No detection can mean cloud, smoke, a fire too small for the sensor, or no overpass at the right time.' },
    { t: 'Hotspots ≠ individual fires', d: 'One fire can produce many hotspot pixels across days and overpasses; counts measure activity, not fire numbers.' },
    { t: 'Never sum MODIS + VIIRS', d: 'They observe the same fires. The harmonized value is a mean of MODIS-scale estimates, never a sum.' },
    { t: 'Flares & industry masked', d: 'Type 2/3 removed, plus persistence, night-time and GIHS industrial masks. Some residual industrial heat may remain in the Eastern Province.' },
  ]
  return (
    <div className="glass flex flex-wrap items-center gap-2 px-4 py-3 fade-up">
      <span className="label mr-1 inline-flex items-center gap-1.5"><AlertTriangle size={13} className="text-ember" /> Read with care</span>
      {items.map((c) => (
        <Tip key={c.t} side="top" label={<span className="block max-w-[280px]">{c.d}</span>}>
          <button className="inline-flex items-center gap-1 rounded-full border border-line-strong px-2.5 py-1 text-[11px] text-muted hover:text-ink cursor-help">
            {c.t} <Info size={11} />
          </button>
        </Tip>
      ))}
    </div>
  )
}
