// Analytics: the harmonized MODIS + VIIRS record (challenge core) — calendar and validation.
// AI-assisted: written with Claude Code (Anthropic) for NASA Space Apps 2026.
import { useApp } from '@/lib/store'
import { AnalyticsToolbar } from '@/components/TopBar'
import { CalendarView } from './CalendarView'
import { MethodView } from './MethodView'
import { cn } from '@/lib/utils'

export function AnalyticsView() {
  const { view, set } = useApp()
  const tabs = [
    { id: 'calendar', label: 'Burning calendar' },
    { id: 'method', label: 'Harmonization & validation' },
  ] as const
  return (
    <div className="grid gap-4 px-4 pt-4 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[28px] font-light tracking-tight">Two satellites. <span className="font-semibold">One fire record.</span></h1>
          <p className="mt-1 max-w-[720px] text-sm text-muted">MODIS (1 km, 2001→) and VIIRS (375 m, 2012→) merged into one consistent monthly burning-activity record on the MODIS scale, with gas flares and industrial heat masked.</p>
        </div>
        <div role="tablist" aria-label="Analytics sections" className="inline-flex rounded-full border border-line p-1">
          {tabs.map((t) => (
            <button key={t.id} role="tab" aria-selected={view === t.id} onClick={() => set({ view: t.id })}
              className={cn('rounded-full px-4 py-1.5 text-[13px] cursor-pointer', view === t.id ? 'bg-white/10 text-ink' : 'text-muted hover:text-ink')}>{t.label}</button>
          ))}
        </div>
      </div>
      <AnalyticsToolbar />
      <div key={view}>{view === 'method' ? <MethodView /> : <CalendarView />}</div>
    </div>
  )
}
