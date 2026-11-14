// App shell: landing screen, or dock + top bar + active view.
// AI-assisted: written with Claude Code (Anthropic) for NASA Space Apps 2026.
import { useState } from 'react'
import { useApp } from '@/lib/store'
import { Starfield } from '@/components/Starfield'
import { Landing } from '@/components/Landing'
import { Dock } from '@/components/Dock'
import { TopBar } from '@/components/TopBar'
import { CommandPalette } from '@/components/CommandPalette'
import { TooltipProvider } from '@/components/ui'
import { CalendarView } from '@/views/CalendarView'
import { MethodView } from '@/views/MethodView'
import { AboutView } from '@/views/AboutView'
import { DroneView, LiveView, RiskView } from '@/views/Upcoming'

export default function App() {
  const { entered, view } = useApp()
  const [palette, setPalette] = useState(false)
  return (
    <TooltipProvider>
      <Starfield density={entered ? 0.00006 : 0.00014} />
      <CommandPalette open={palette} setOpen={setPalette} />
      {!entered ? (
        <Landing />
      ) : (
        <div className="flex h-full gap-3 p-3">
          <Dock />
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <TopBar onPalette={() => setPalette(true)} />
            <main id="main" className="min-h-0 flex-1 overflow-y-auto pr-1" key={view}>
              {view === 'calendar' && <CalendarView />}
              {view === 'method' && <MethodView />}
              {view === 'live' && <LiveView />}
              {view === 'risk' && <RiskView />}
              {view === 'drone' && <DroneView />}
              {view === 'about' && <AboutView />}
            </main>
          </div>
        </div>
      )}
    </TooltipProvider>
  )
}
