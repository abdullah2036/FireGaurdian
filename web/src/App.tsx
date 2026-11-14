// App shell: phones get MobileShell; larger screens get top navigation, hero, active view, footer.
// AI-assisted: written with Claude Code (Anthropic) for NASA Space Apps 2026.
import { lazy, Suspense, useState } from 'react'
import { useApp } from '@/lib/store'
import { LiveProvider } from '@/lib/live'
import { Starfield } from '@/components/Starfield'
import { EarthLimb, Footer, Header, Hero } from '@/components/Shell'
import { CommandPalette } from '@/components/CommandPalette'
import { TooltipProvider } from '@/components/ui'
import { OverviewView } from '@/views/OverviewView'
import { OperationsView } from '@/views/OperationsView'
import { AboutView } from '@/views/AboutView'
import { MobileShell } from '@/components/mobile/MobileShell'
import { useIsPhone } from '@/lib/useMedia'

// Analytics pulls in ECharts; load it on demand so the Overview opens fast.
const AnalyticsView = lazy(() => import('@/views/AnalyticsView').then((m) => ({ default: m.AnalyticsView })))

export default function App() {
  const { view } = useApp()
  const [palette, setPalette] = useState(false)
  const phone = useIsPhone()
  if (phone) return (
    <TooltipProvider>
      <LiveProvider>
        <MobileShell />
      </LiveProvider>
    </TooltipProvider>
  )
  return (
    <TooltipProvider>
      <LiveProvider>
        <Starfield density={0.00008} />
        <CommandPalette open={palette} setOpen={setPalette} />
        <div className="relative min-h-full overflow-x-hidden">
          {view === 'overview' && <EarthLimb />}
          <Header onPalette={() => setPalette(true)} />
          <main id="main" className="relative z-10 mx-auto max-w-[1680px] pt-6 md:pt-0">
            {view === 'overview' && (<><Hero /><OverviewView /></>)}
            {(view === 'calendar' || view === 'method' || view === 'aimodel') && (
              <Suspense fallback={<div className="px-8 py-20 text-center text-sm text-muted">Loading analytics…</div>}><AnalyticsView /></Suspense>
            )}
            {view === 'operations' && <OperationsView />}
            {view === 'about' && <AboutView />}
          </main>
          <Footer />
        </div>
      </LiveProvider>
    </TooltipProvider>
  )
}
