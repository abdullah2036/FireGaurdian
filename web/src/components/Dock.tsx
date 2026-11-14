// Left vertical dock of views.
// AI-assisted: written with Claude Code (Anthropic) for NASA Space Apps 2026.
import { CalendarDays, Radar, Flame, Plane, FlaskConical, Info } from 'lucide-react'
import type { ViewId } from '@/lib/types'
import { useApp } from '@/lib/store'
import { Tip } from './ui'
import { cn } from '@/lib/utils'

export const VIEW_META: { id: ViewId; label: string; icon: typeof Radar; hint: string }[] = [
  { id: 'calendar', label: 'Calendar', icon: CalendarDays, hint: 'Harmonized burning-activity calendar' },
  { id: 'live', label: 'Live Map', icon: Radar, hint: 'Latest VIIRS detections over KSA' },
  { id: 'risk', label: 'Risk Outlook', icon: Flame, hint: 'Probabilistic critical-period risk' },
  { id: 'drone', label: 'Drone Ops', icon: Plane, hint: 'Drone response simulation' },
  { id: 'method', label: 'Method & Data', icon: FlaskConical, hint: 'Harmonization method, validation, sources' },
  { id: 'about', label: 'About', icon: Info, hint: 'Team, credits, AI use' },
]

export function Dock() {
  const { view, set } = useApp()
  return (
    <nav aria-label="Views" className="glass flex w-[60px] shrink-0 flex-col items-center gap-1.5 py-3">
      <button
        onClick={() => set({ entered: false })}
        className="mb-3 grid h-10 w-10 place-items-center rounded-xl cursor-pointer"
        aria-label="NovaShift home"
      >
        <img src="/favicon.svg" alt="" className="h-9 w-9" />
      </button>
      {VIEW_META.map(({ id, label, icon: Icon, hint }) => (
        <Tip key={id} label={<span><b className="font-medium">{label}</b><span className="text-muted"> · {hint}</span></span>}>
          <button
            onClick={() => set({ view: id })}
            aria-label={label}
            aria-current={view === id ? 'page' : undefined}
            className={cn(
              'relative grid h-10 w-10 place-items-center rounded-xl text-muted transition-colors cursor-pointer hover:text-ink hover:bg-white/[0.05]',
              view === id && 'text-cyan bg-cyan-soft',
            )}
          >
            {view === id && <span className="absolute -left-[11px] h-5 w-[3px] rounded-r bg-cyan" />}
            <Icon size={19} strokeWidth={1.75} />
          </button>
        </Tip>
      ))}
    </nav>
  )
}
