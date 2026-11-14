// Landing / hero screen with a 3-step explainer of the sensor-jump problem.
// AI-assisted: written with Claude Code (Anthropic) for NASA Space Apps 2026.
import { ArrowRight, Satellite, TrendingUp, GitMerge } from 'lucide-react'
import { useApp } from '@/lib/store'
import { useCalendar } from '@/lib/data'
import { Button } from './ui'
import { fmt } from '@/lib/utils'

function MiniJump({ raw, harm, years }: { raw: (number | null)[]; harm: (number | null)[]; years: number[] }) {
  const W = 300, H = 90, P = 6
  const max = Math.max(...raw.map((v) => v ?? 0), 1)
  const x = (i: number) => P + (i / (years.length - 1)) * (W - 2 * P)
  const y = (v: number) => H - P - (v / max) * (H - 2 * P)
  const path = (arr: (number | null)[]) =>
    arr.map((v, i) => (v === null ? '' : `${i === 0 || arr[i - 1] === null ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`)).join('')
  const i2012 = years.indexOf(2012)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-[110px] w-full" role="img" aria-label="Annual hotspot totals: raw series jumps in 2012, harmonized series stays continuous">
      {i2012 > 0 && <line x1={x(i2012)} x2={x(i2012)} y1={4} y2={H - 4} stroke="rgb(148 163 184 / .3)" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />}
      <path d={path(raw)} fill="none" stroke="#ff7a3d" strokeWidth={1.8} opacity={0.9} vectorEffect="non-scaling-stroke" />
      <path d={path(harm)} fill="none" stroke="#22d3ee" strokeWidth={2} vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

export function Landing() {
  const { set } = useApp()
  const { data } = useCalendar('ksa')
  const years = data?.years.filter((y) => !y.partial) ?? []
  const raw = years.map((y) => (y.viirs ?? y.modis))
  const harm = years.map((y) => y.harmonized)
  const ratio = data?.ratio.overall

  const steps = [
    { icon: Satellite, title: 'MODIS · since 2001', body: 'Terra and Aqua map active fires at 1 km. Twenty-five years of record — but the sensors are ageing out.' },
    { icon: TrendingUp, title: 'VIIRS · the 2012 jump', body: `VIIRS sees fires at 375 m, so it counts ${ratio ? `≈${fmt(ratio, 1)}×` : 'many times'} more hotspots over Saudi Arabia. Splice the two and you get a fake surge.` },
    { icon: GitMerge, title: 'Harmonized · one record', body: 'We learn a calendar-month VIIRS/MODIS ratio from 15 overlap years and put everything on one scale — 2001 to today, sensor-agnostic.' },
  ]

  return (
    <main className="relative flex min-h-full flex-col items-center justify-center px-6 py-16">
      <div className="max-w-4xl text-center fade-up">
        <p className="label mb-5 text-cyan">NASA Space Apps 2026 · Harmonization of MODIS and VIIRS Hot Spots</p>
        <h1 className="font-display text-6xl font-bold tracking-tight md:text-7xl">
          Nova<span className="text-ember">Shift</span>
        </h1>
        <p className="mt-5 font-display text-2xl text-ink/90 md:text-3xl">Two satellites. One fire record.</p>
        <p className="mx-auto mt-4 max-w-2xl text-muted">
          A harmonized burning-activity calendar for Saudi Arabia from NASA FIRMS — with gas flares masked out,
          live VIIRS monitoring, a risk outlook and a drone-response simulator.
        </p>
        <Button variant="ember" className="mt-8 h-12 px-6 text-base" onClick={() => set({ entered: true, view: 'calendar' })} autoFocus>
          Enter mission control <ArrowRight size={18} />
        </Button>
      </div>

      <ol className="mt-16 grid w-full max-w-5xl gap-4 md:grid-cols-3">
        {steps.map((s, i) => (
          <li key={s.title} className="glass p-5 fade-up" style={{ animationDelay: `${120 + i * 90}ms` }}>
            <div className="mb-3 flex items-center gap-3">
              <span className="num grid h-7 w-7 place-items-center rounded-full border border-line-strong text-xs text-muted">{i + 1}</span>
              <s.icon size={18} className={i === 1 ? 'text-ember' : 'text-cyan'} />
              <h2 className="font-display font-semibold">{s.title}</h2>
            </div>
            <p className="text-sm leading-relaxed text-muted">{s.body}</p>
          </li>
        ))}
      </ol>

      {years.length > 0 && (
        <div className="glass mt-4 w-full max-w-5xl p-5 fade-up" style={{ animationDelay: '420ms' }}>
          <div className="mb-2 flex flex-wrap items-center gap-4 text-xs text-muted">
            <span className="label">KSA annual hotspots (flares masked)</span>
            <span className="inline-flex items-center gap-1.5"><i className="h-0.5 w-4 bg-ember" /> naive splice (MODIS → raw VIIRS)</span>
            <span className="inline-flex items-center gap-1.5"><i className="h-0.5 w-4 bg-cyan" /> NovaShift harmonized</span>
          </div>
          <MiniJump raw={raw} harm={harm} years={years.map((y) => y.year)} />
        </div>
      )}
      <p className="mt-8 text-xs text-faint">Data: NASA FIRMS (MODIS C6.1, VIIRS S-NPP C2) · Boundaries: Natural Earth</p>
    </main>
  )
}
