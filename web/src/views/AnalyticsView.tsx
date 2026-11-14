// Analytics: the harmonized MODIS + VIIRS record (challenge core) — calendar and validation.
// AI-assisted: written with Claude Code (Anthropic) for NASA Space Apps 2026.
import { useApp } from '@/lib/store'
import { AnalyticsToolbar } from '@/components/TopBar'
import { CalendarView } from './CalendarView'
import { MethodView } from './MethodView'
import { AIModelView } from './AIModelView'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n'

export function AnalyticsView() {
  const { view, set } = useApp()
  const { t, lang } = useT()
  const tabs = [
    { id: 'calendar', label: t('an.tab.calendar') },
    { id: 'method', label: t('an.tab.method') },
    { id: 'aimodel', label: t('an.tab.ai') },
  ] as const
  return (
    <div className="grid min-w-0 gap-4 px-3 pt-2 sm:px-8 sm:pt-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[26px] font-light tracking-tight">{t('an.title1')} <span className="font-semibold">{t('an.title2')}</span></h1>
          <p className="mt-1 max-w-[720px] text-sm text-muted">{t('an.sub')}</p>
          {lang === 'ar' && <p className="mt-1 text-[12px] text-faint">{t('an.enOnly')}</p>}
        </div>
        <div role="tablist" aria-label="Analytics sections" className="no-scrollbar flex max-w-full overflow-x-auto rounded-full border border-line p-1">
          {tabs.map((t) => (
            <button key={t.id} role="tab" aria-selected={view === t.id} onClick={() => set({ view: t.id })}
              className={cn('shrink-0 rounded-full px-4 py-1.5 text-[13px] cursor-pointer', view === t.id ? 'bg-white/10 text-ink' : 'text-muted hover:text-ink')}>{t.label}</button>
          ))}
        </div>
      </div>
      {view !== 'aimodel' && <div dir="ltr"><AnalyticsToolbar /></div>}
      <div key={view} dir="ltr" lang="en" className="min-w-0">{view === 'method' ? <MethodView /> : view === 'aimodel' ? <AIModelView /> : <CalendarView />}</div>
    </div>
  )
}
