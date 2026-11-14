// Minimal ECharts React wrapper with tree-shaken modules and a dark theme.
// AI-assisted: written with Claude Code (Anthropic) for NASA Space Apps 2026.
import { useEffect, useRef } from 'react'
import * as echarts from 'echarts/core'
import { BarChart, LineChart, ScatterChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent, MarkLineComponent, MarkAreaComponent, DataZoomComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { EChartsCoreOption } from 'echarts/core'

echarts.use([BarChart, LineChart, ScatterChart, GridComponent, TooltipComponent, LegendComponent, MarkLineComponent, MarkAreaComponent, DataZoomComponent, CanvasRenderer])

export const C = {
  ember: '#ff7a3d', cyan: '#22d3ee', violet: '#a78bfa', muted: '#94a0b8', faint: '#5d6981',
  grid: 'rgba(148,163,184,0.10)', ink: '#e6ebf5', modis: '#fbbf24', viirs: '#ff7a3d', harm: '#22d3ee',
}

export const baseOption = {
  backgroundColor: 'transparent',
  textStyle: { color: C.muted, fontFamily: 'Inter, sans-serif' },
  grid: { left: 48, right: 16, top: 28, bottom: 30, containLabel: false },
  tooltip: {
    trigger: 'axis' as const,
    backgroundColor: 'rgba(10,16,31,0.96)', borderColor: 'rgba(148,163,184,0.28)',
    textStyle: { color: C.ink, fontSize: 12 },
    valueFormatter: (v: unknown) => (typeof v === 'number' ? v.toLocaleString('en-US', { maximumFractionDigits: 1 }) : String(v ?? '—')),
  },
  legend: { textStyle: { color: C.muted, fontSize: 11 }, top: 0, right: 0, itemWidth: 14, itemHeight: 8, icon: 'roundRect' },
}

export const axis = (extra: Record<string, unknown> = {}) => ({
  axisLine: { lineStyle: { color: C.grid } },
  axisTick: { show: false },
  axisLabel: { color: C.muted, fontSize: 11, fontFamily: 'JetBrains Mono, monospace' },
  splitLine: { lineStyle: { color: C.grid } },
  nameTextStyle: { color: C.faint, fontSize: 11 },
  ...extra,
})

export function EChart({ option, height = 260, label }: { option: EChartsCoreOption; height?: number; label: string }) {
  const el = useRef<HTMLDivElement>(null)
  const chart = useRef<echarts.ECharts | null>(null)
  useEffect(() => {
    chart.current = echarts.init(el.current!, undefined, { renderer: 'canvas' })
    const ro = new ResizeObserver(() => chart.current?.resize())
    ro.observe(el.current!)
    return () => {
      ro.disconnect()
      chart.current?.dispose()
    }
  }, [])
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    chart.current?.setOption({ animation: !reduce, ...option }, true)
  }, [option])
  return <div ref={el} role="img" aria-label={label} style={{ height, width: '100%' }} />
}
