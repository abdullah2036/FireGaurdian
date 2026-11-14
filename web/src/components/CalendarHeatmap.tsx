// Year × month heatmap of hotspot activity (inferno ramp, anomaly outlines, keyboard navigable).
// AI-assisted: written with Claude Code (Anthropic) for NASA Space Apps 2026.
import { useMemo, useRef, useState, type KeyboardEvent } from 'react'
import type { CalendarData, Mode } from '@/lib/types'
import { MONTHS } from '@/lib/types'
import { cn, fmt, inferno } from '@/lib/utils'

export interface CellSel { year: number; month: number }

interface Props {
  data: CalendarData
  mode: Mode
  from: string
  to: string
  scale: 'log' | 'linear'
  showAnomalies: boolean
  selected: CellSel | null
  onSelect: (s: CellSel) => void
}

export function CalendarHeatmap({ data, mode, from, to, scale, showAnomalies, selected, onSelect }: Props) {
  const series = mode === 'raw' ? data.raw : data.harmonized
  const idx = useMemo(() => new Map(data.months.map((m, i) => [m, i])), [data.months])
  const years = useMemo(() => {
    const a = Number(from.slice(0, 4)), b = Number(to.slice(0, 4))
    return Array.from({ length: b - a + 1 }, (_, i) => a + i)
  }, [from, to])
  const max = useMemo(() => {
    let mx = 1
    data.months.forEach((m, i) => {
      if (m >= from && m <= to && series[i] !== null && !data.partial[m]) mx = Math.max(mx, series[i] as number)
    })
    return mx
  }, [data, series, from, to])
  const yearTotals = useMemo(() => years.map((y) => {
    let s = 0, any = false
    for (let mo = 1; mo <= 12; mo++) {
      const i = idx.get(`${y}-${String(mo).padStart(2, '0')}`)
      if (i !== undefined && series[i] !== null) { s += series[i] as number; any = true }
    }
    return any ? s : null
  }), [years, idx, series])
  const maxTotal = Math.max(1, ...yearTotals.map((v) => v ?? 0))

  const norm = (v: number) => (scale === 'log' ? Math.log1p(v) / Math.log1p(max) : v / max)
  const [hover, setHover] = useState<{ year: number; month: number; x: number; y: number } | null>(null)
  const wrap = useRef<HTMLDivElement>(null)

  const onKey = (e: KeyboardEvent) => {
    const s = selected ?? { year: years[years.length - 1], month: 1 }
    const mv: Record<string, [number, number]> = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] }
    const d = mv[e.key]
    if (!d) return
    e.preventDefault()
    const year = Math.min(years[years.length - 1], Math.max(years[0], s.year + d[0]))
    const month = Math.min(12, Math.max(1, s.month + d[1]))
    onSelect({ year, month })
    const btn = wrap.current?.querySelector<HTMLButtonElement>(`[data-cell="${year}-${month}"]`)
    btn?.focus()
  }

  const tipCell = hover ?? null
  const tip = tipCell && (() => {
    const key = `${tipCell.year}-${String(tipCell.month).padStart(2, '0')}`
    const i = idx.get(key)
    if (i === undefined) return null
    const med = data.climatology.median[tipCell.month - 1]
    return { key, i, med }
  })()

  return (
    <div className="relative" ref={wrap}>
      <div
        role="grid"
        aria-label={`Monthly hotspot activity, ${mode} series, ${data.name}`}
        onKeyDown={onKey}
        className="grid gap-[3px] select-none"
        style={{ gridTemplateColumns: `44px repeat(12, minmax(0, 1fr)) 88px` }}
      >
        <div />
        {MONTHS.map((m) => <div key={m} className="label pb-1 text-center !text-[10px]">{m}</div>)}
        <div className="label pb-1 pl-2 !text-[10px]">Year total</div>
        {years.map((y, yi) => (
          <div role="row" key={y} className="contents">
            <div role="rowheader" className={cn('num flex items-center text-[11px] text-muted', selected?.year === y && 'text-cyan')}>
              {y}{y === 2012 && <span className="ml-1 h-1.5 w-1.5 rounded-full bg-ember" title="VIIRS starts" />}
            </div>
            {MONTHS.map((_, mi) => {
              const month = mi + 1
              const key = `${y}-${String(month).padStart(2, '0')}`
              const i = idx.get(key)
              const v = i === undefined ? null : series[i]
              const inRange = key >= from && key <= to
              const partial = !!data.partial[key]
              const anom = i !== undefined && showAnomalies ? data.anomaly[i] : 0
              const isSel = selected?.year === y && selected?.month === month
              const missing = v === null || i === undefined
              return (
                <button
                  role="gridcell"
                  key={key}
                  data-cell={`${y}-${month}`}
                  tabIndex={isSel || (!selected && yi === years.length - 1 && mi === 0) ? 0 : -1}
                  aria-label={`${MONTHS[mi]} ${y}: ${missing ? 'no data' : fmt(v, 1) + ' hotspots'}${anom === 1 ? ', anomaly' : ''}`}
                  aria-selected={isSel}
                  onClick={() => onSelect({ year: y, month })}
                  onFocus={(e) => {
                    const r = e.currentTarget.getBoundingClientRect(), w = wrap.current!.getBoundingClientRect()
                    setHover({ year: y, month, x: r.left - w.left + r.width / 2, y: r.top - w.top })
                  }}
                  onBlur={() => setHover(null)}
                  onMouseEnter={(e) => {
                    const r = e.currentTarget.getBoundingClientRect(), w = wrap.current!.getBoundingClientRect()
                    setHover({ year: y, month, x: r.left - w.left + r.width / 2, y: r.top - w.top })
                  }}
                  onMouseLeave={() => setHover(null)}
                  className={cn(
                    'relative h-[18px] rounded-[3px] transition-[transform,opacity] hover:scale-110 hover:z-10 cursor-pointer focus-visible:z-20',
                    !inRange && 'opacity-25',
                    partial && 'outline outline-1 outline-dashed outline-muted/70 -outline-offset-1',
                    anom === 1 && 'ring-[1.5px] ring-cyan ring-offset-1 ring-offset-space',
                    anom === -1 && 'ring-1 ring-violet-400/70',
                    isSel && 'ring-2 ring-white z-10',
                  )}
                  style={missing ? {
                    background: 'repeating-linear-gradient(135deg, rgba(148,163,184,.10) 0 3px, transparent 3px 6px)',
                  } : { background: (v as number) <= 0 ? 'rgb(18 22 40)' : inferno(0.08 + 0.92 * norm(v as number)) }}
                />
              )
            })}
            <div className="flex items-center gap-2 pl-2">
              <div className="h-[8px] flex-1 overflow-hidden rounded-full bg-white/[0.04]">
                <div className="h-full rounded-full" style={{ width: `${((yearTotals[yi] ?? 0) / maxTotal) * 100}%`, background: mode === 'raw' && y >= 2012 ? '#ff7a3d' : '#22d3ee', opacity: 0.8 }} />
              </div>
              <span className="num w-9 text-right text-[10px] text-muted">{yearTotals[yi] === null ? '—' : fmt(yearTotals[yi], 0)}</span>
            </div>
          </div>
        ))}
      </div>

      {tip && hover && (
        <div
          className="pop pointer-events-none absolute z-30 w-[230px] -translate-x-1/2 -translate-y-full p-3 text-xs"
          style={{ left: Math.min(Math.max(hover.x, 120), (wrap.current?.clientWidth ?? 600) - 120), top: hover.y - 8 }}
        >
          <div className="mb-1.5 flex items-center justify-between font-display text-sm">
            {MONTHS[hover.month - 1]} {hover.year}
            {data.anomaly[tip.i] === 1 && <span className="text-[10px] text-cyan">▲ anomaly</span>}
          </div>
          <dl className="grid grid-cols-[1fr_auto] gap-y-1">
            <dt className="text-muted">Raw MODIS</dt><dd className="num">{fmt(data.modis[tip.i])}</dd>
            <dt className="text-muted">Raw VIIRS</dt><dd className="num">{fmt(data.viirs[tip.i])}</dd>
            <dt className="text-cyan">Harmonized</dt><dd className="num text-cyan">{fmt(data.harmonized[tip.i], 1)}</dd>
            <dt className="text-muted">Median ({MONTHS[hover.month - 1]})</dt><dd className="num">{fmt(tip.med, 1)}</dd>
            <dt className="text-muted">Robust z</dt><dd className="num">{fmt(data.z[tip.i], 2)}</dd>
          </dl>
          {(tip.key <= '2002-06' || data.partial[tip.key] || data.harmonized[tip.i] === null) && (
            <p className="mt-2 border-t border-line pt-1.5 text-[11px] text-faint">
              {tip.key <= '2002-06' && 'Terra-only MODIS (Aqua from Jul 2002). '}
              {data.partial[tip.key] && `${data.partial[tip.key]}. `}
              {data.harmonized[tip.i] === null && 'No sensor coverage — missing ≠ zero.'}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export function RampLegend({ max, scale }: { max: number; scale: 'log' | 'linear' }) {
  const stops = Array.from({ length: 24 }, (_, i) => inferno(0.08 + 0.92 * (i / 23)))
  return (
    <div className="flex items-center gap-2 text-[10px] text-muted">
      <span className="num">0</span>
      <span className="h-2 w-28 rounded-full" style={{ background: `linear-gradient(90deg, ${stops.join(',')})` }} />
      <span className="num">{fmt(max)}</span>
      <span className="text-faint">({scale})</span>
    </div>
  )
}
