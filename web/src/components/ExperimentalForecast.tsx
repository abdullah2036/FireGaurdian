// AI Fire Prediction slot: the teammate's research model (logistic regression on NASA POWER weather,
// 29 coarse cells in Jazan / Asir / Al Baha). A live-input research demonstration, not an
// operational wildfire warning. Original component by a teammate; extended for the whole pilot grid.
// AI-assisted integration: Claude Code (Anthropic) for NASA Space Apps 2026.
import { BrainCircuit, Crosshair } from 'lucide-react'
import { useLive, aiCellAt, type AICell, type AILevel } from '@/lib/live'
import { useApp } from '@/lib/store'
import { cn } from '@/lib/utils'

export const AI_LEVEL_STYLE: Record<AILevel, { text: string; pill: string; fill: string }> = {
  low: { text: 'text-emerald-300', pill: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300', fill: '#34d399' },
  elevated: { text: 'text-amber-300', pill: 'border-amber-400/40 bg-amber-400/10 text-amber-300', fill: '#fbbf24' },
  high: { text: 'text-red-300', pill: 'border-red-500/40 bg-red-500/15 text-red-300', fill: '#ef4444' },
}

export function ExperimentalForecast() {
  const { focus, setFocus, ai, aiError, aiLoading } = useLive()
  const { set } = useApp()
  const here = focus ? aiCellAt(ai, focus.lat, focus.lon) : null
  const scored = (ai?.cells ?? []).filter((c) => c.scoreIndex != null).sort((a, b) => b.scoreIndex! - a.scoreIndex!)
  const top = scored[0]
  const cell: AICell | undefined = here && here.scoreIndex != null ? here : top
  const isTop = cell === top && !(here && here.scoreIndex != null)
  const level = cell?.level ? ai!.levels.find((l) => l.id === cell.level) : null
  const counts = { high: scored.filter((c) => c.level === 'high').length, elevated: scored.filter((c) => c.level === 'elevated').length }

  return (
    <section className="fg-card p-4" aria-label="AI fire prediction (experimental research index)">
      <header className="mb-3 flex items-center gap-2.5">
        <BrainCircuit size={18} className="text-ink/80" />
        <h2 className="text-[14px] font-medium tracking-tight">AI Fire Prediction</h2>
        <span className="ml-auto rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[10.5px] text-amber-300">research</span>
      </header>

      {aiLoading && !ai && <p className="text-xs text-muted" role="status">Running the model on NASA POWER weather…</p>}
      {aiError && !ai && <p className="text-xs text-amber-300" role="status">No research index right now: NASA POWER data are unavailable or outside the model range for the required day.</p>}

      {ai && cell && level && (
        <>
          <div className="text-[11px] text-faint">
            {isTop ? 'Highest cell in the SW pilot area' : 'Selected pilot cell'} · {cell.lat.toFixed(2)}°N {cell.lon.toFixed(3)}°E
          </div>
          <div className="mt-1 flex items-end gap-3">
            <div className="font-display text-[34px] font-light leading-none">{cell.scoreIndex!.toFixed(1)}<span className="text-base text-muted"> / 100</span></div>
            <span className={cn('mb-1 rounded-full border px-2 py-0.5 text-[11px] font-medium', AI_LEVEL_STYLE[cell.level!].pill)}>{level.label}</span>
          </div>
          <p className="mt-2 text-[11.5px] leading-snug text-muted">
            Uncertainty: in the 2025 test, <b className="text-ink">{(level.observed2025 * 100).toFixed(1)}%</b> of “{level.label}” cell-days had a VIIRS vegetation detection.
          </p>
          <div className="mt-2 grid gap-0.5 text-[11px] text-faint">
            <div>Target: {ai.targetStartSaudi} → {ai.targetEndSaudi} (Saudi time)</div>
            <div>NASA POWER weather day: {ai.weatherDateUTC} (UTC) · pilot: {counts.high} high, {counts.elevated} elevated of {scored.length}</div>
          </div>
          <div className="mt-2 flex gap-2">
            {isTop && (
              <button onClick={() => setFocus({ lat: cell.lat, lon: cell.lon, label: `AI pilot cell ${cell.lat.toFixed(2)}°N ${cell.lon.toFixed(3)}°E` })}
                className="inline-flex items-center gap-1 rounded-md border border-line-strong px-2 py-1 text-[11px] text-muted hover:text-ink cursor-pointer">
                <Crosshair size={12} /> Focus this cell
              </button>
            )}
            <button onClick={() => set({ view: 'aimodel' })} className="rounded-md border border-line-strong px-2 py-1 text-[11px] text-muted hover:text-ink cursor-pointer">How good is it?</button>
          </div>
          <p className="mt-3 rounded-lg border border-amber-400/30 bg-amber-400/5 px-3 py-2 text-[11px] leading-snug text-amber-200">
            Research prototype. This score is not a verified probability of wildfire ignition or an emergency warning. It is limited to 29 coarse cells in parts of southwest Saudi Arabia.
          </p>
        </>
      )}
    </section>
  )
}
