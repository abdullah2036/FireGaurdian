// Fire Guardian shell: top navigation, Overview hero, footer.
// AI-assisted: written with Claude Code (Anthropic) for NASA Space Apps 2026.
import { BarChart3, BrainCircuit, Info, LayoutDashboard, Plane, Search, FlaskConical, type LucideIcon } from 'lucide-react'
import type { ViewId } from '@/lib/types'
import { useApp } from '@/lib/store'
import { useLive } from '@/lib/live'
import { RegionSelect } from './TopBar'
import { cn } from '@/lib/utils'

export const VIEW_META: { id: ViewId; label: string; icon: LucideIcon; hint: string; nav?: boolean }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard, hint: 'Live map, risk zones, drone fleet', nav: true },
  { id: 'calendar', label: 'Analytics', icon: BarChart3, hint: 'Harmonized MODIS + VIIRS burning calendar', nav: true },
  { id: 'method', label: 'Harmonization & validation', icon: FlaskConical, hint: 'Method, ratios, leave-one-year-out, flare mask' },
  { id: 'aimodel', label: 'AI model validation', icon: BrainCircuit, hint: 'Research model: inputs, coverage, 2024/2025 validation vs baseline' },
  { id: 'operations', label: 'Operations', icon: Plane, hint: 'Drone fleet, missions, alerts, .plan export', nav: true },
  { id: 'about', label: 'About', icon: Info, hint: 'Project, data sources, credits, AI use', nav: true },
]

export function Logo({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <path d="M16 1.5 C17 11 21 15 30.5 16 C21 17 17 21 16 30.5 C15 21 11 17 1.5 16 C11 15 15 11 16 1.5Z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M16 9 C16.5 14 18 15.5 23 16 C18 16.5 16.5 18 16 23 C15.5 18 14 16.5 9 16 C14 15.5 15.5 14 16 9Z" fill="currentColor" opacity="0.85" />
    </svg>
  )
}

export function Header({ onPalette }: { onPalette: () => void }) {
  const { view, set } = useApp()
  const { firms, loading, error } = useLive()
  const active = view === 'method' || view === 'aimodel' ? 'calendar' : view
  const liveState = error ? 'Offline' : loading && !firms ? 'Connecting' : firms?.mock ? 'Mock data' : 'Live'
  return (
    <header className="relative z-20 flex h-[72px] items-center gap-6 px-4 sm:px-8">
      <button onClick={() => set({ view: 'overview' })} className="flex items-center gap-3 text-ink cursor-pointer" aria-label="Fire Guardian home">
        <Logo />
        <span className="font-display text-[19px] font-medium tracking-tight">Fire Guardian</span>
      </button>
      <nav aria-label="Main" className="mx-auto hidden items-center gap-1 md:flex">
        {VIEW_META.filter((v) => v.nav).map((v) => (
          <button key={v.id} onClick={() => set({ view: v.id })} aria-current={active === v.id ? 'page' : undefined}
            className={cn('relative px-4 py-6 text-[14px] transition-colors cursor-pointer', active === v.id ? 'text-ink' : 'text-muted hover:text-ink')}>
            {v.label}
            {active === v.id && <span className="absolute inset-x-3 bottom-3 h-px bg-ink/80" />}
          </button>
        ))}
      </nav>
      <div className="ml-auto flex items-center gap-3 md:ml-0">
        <button onClick={onPalette} className="hidden h-9 items-center gap-2 rounded-full border border-line px-3 text-[12px] text-muted hover:text-ink lg:inline-flex cursor-pointer" aria-label="Open command palette">
          <Search size={13} /> <kbd className="num text-[10px]">Ctrl K</kbd>
        </button>
        <span className="inline-flex items-center gap-2 text-[13px] text-muted" title={firms ? `FIRMS fetched ${firms.fetchedAt}` : undefined}>
          <span className={cn('relative flex h-2 w-2')}>
            {liveState === 'Live' && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60 motion-reduce:hidden" />}
            <span className={cn('relative h-2 w-2 rounded-full', liveState === 'Live' ? 'bg-emerald-400' : liveState === 'Connecting' ? 'bg-amber-400' : 'bg-red-500')} />
          </span>
          {liveState}
        </span>
        <RegionSelect compact />
      </div>
      {/* mobile nav */}
      <nav aria-label="Main (mobile)" className="absolute inset-x-0 top-[64px] flex justify-center gap-1 md:hidden">
        {VIEW_META.filter((v) => v.nav).map((v) => (
          <button key={v.id} onClick={() => set({ view: v.id })} className={cn('rounded-full px-3 py-1 text-[12px]', active === v.id ? 'bg-white/10 text-ink' : 'text-muted')}>{v.label}</button>
        ))}
      </nav>
    </header>
  )
}

/** Planet limb in the corner: NASA Blue Marble (GIBS) over Arabia, with atmosphere glow. */
const EARTH = 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=BlueMarble_NextGeneration&CRS=EPSG:4326&BBOX=-5,10,50,80&WIDTH=1400&HEIGHT=1100&FORMAT=image/jpeg'

export function EarthLimb() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[520px] select-none overflow-hidden [mask-image:linear-gradient(180deg,#000_55%,transparent)]">
      <div className="absolute left-[34%] top-[-1180px] h-[1600px] w-[2400px] sm:left-[40%]">
        <div className="fg-earth absolute inset-0 rounded-[50%]" style={{ backgroundImage: `url(${EARTH})` }} />
        <div className="absolute inset-0 rounded-[50%] shadow-[0_10px_90px_14px_rgba(96,165,250,0.32),inset_0_-14px_40px_6px_rgba(147,197,253,0.4)]" />
      </div>
    </div>
  )
}

export function Hero() {
  return (
    <section className="relative z-10 px-4 pb-6 pt-6 sm:px-8 sm:pt-10">
      <h1 className="font-display text-[44px] font-light leading-[1.02] tracking-tight sm:text-[64px]">
        <span className="text-white/45">Detect. Predict. </span><span className="font-semibold text-white">Protect.</span>
      </h1>
      <p className="mt-4 max-w-[520px] text-[17px] leading-relaxed text-white/60">
        Real-time wildfire monitoring across Saudi Arabia, powered by NASA satellite data and a harmonized 25-year fire record.
      </p>
      <div className="mt-6 h-px w-10 bg-white/25" />
    </section>
  )
}

export function Footer() {
  return (
    <footer className="relative z-10 mt-6 flex items-center gap-5 px-4 pb-6 text-[12px] text-faint sm:px-8">
      <span className="grid h-8 w-8 place-items-center rounded-full border border-line-strong text-muted"><Logo size={14} /></span>
      <span className="tracking-[0.25em] text-muted">Monitoring a safer tomorrow</span>
      <span className="hidden h-px flex-1 bg-line sm:block" />
      <span className="hidden sm:inline">Powered by NASA Earth observation: FIRMS · GIBS · MODIS · VIIRS · Weather by Meteomatics</span>
    </footer>
  )
}
