// Map page (desktop): pick a view (Live fires / Heat sources / Forecast / Danger zones), see only that on the map,
// with a matching legend and a side panel. Drones live on their own page.
// AI-assisted: written with Claude Code (Anthropic) for NASA Space Apps 2026.
import { useApp } from '@/lib/store'
import { FireMap } from '@/components/FireMap'
import { Legend, ModePanel, ModeSwitch } from '@/components/MapPanels'

export function OverviewView() {
  const { layer } = useApp()
  return (
    <div className="grid gap-4 px-4 sm:px-8">
      <ModeSwitch />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="relative h-[calc(100vh-250px)] min-h-[540px] fade-up">
          <FireMap mode={layer} className="h-full" />
          <Legend mode={layer} className="pointer-events-none absolute bottom-3 start-3 z-10 max-w-[300px]" />
        </div>
        <aside className="fade-up lg:h-[calc(100vh-250px)] lg:min-h-[540px] lg:overflow-y-auto lg:pe-1" aria-label="Details">
          <ModePanel />
        </aside>
      </div>
    </div>
  )
}
