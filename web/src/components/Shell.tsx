// Fire Guardian shell: header with a glass navigation pill, Overview hero and planet, footer.
// AI-assisted: written with Claude Code (Anthropic) for NASA Space Apps 2026.
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { BarChart3, BrainCircuit, Info, Map as MapIcon, Plane, Search, FlaskConical, type LucideIcon } from 'lucide-react'
import type { ViewId } from '@/lib/types'
import { useApp } from '@/lib/store'
import { useLive } from '@/lib/live'
import { RegionSelect } from './TopBar'
import { cn } from '@/lib/utils'
import { LangToggle, useT, type Key } from '@/lib/i18n'
import { NovaMark } from './Brand'

export const VIEW_META: { id: ViewId; label: string; icon: LucideIcon; hint: string; nav?: boolean; key?: Key }[] = [
  { id: 'overview', label: 'Map', icon: MapIcon, hint: 'Live fires, forecast, danger zones', nav: true, key: 'nav.map' },
  { id: 'calendar', label: 'Analytics', icon: BarChart3, hint: 'Harmonized MODIS + VIIRS burning calendar', nav: true, key: 'nav.analytics' },
  { id: 'method', label: 'Harmonization & validation', icon: FlaskConical, hint: 'Method, ratios, leave-one-year-out, flare mask' },
  { id: 'aimodel', label: 'AI model validation', icon: BrainCircuit, hint: 'Research model: inputs, coverage, 2024/2025 validation vs baseline' },
  { id: 'operations', label: 'Drone demo', icon: Plane, hint: 'How drones could respond (concept)', nav: true, key: 'nav.drones' },
  { id: 'about', label: 'About', icon: Info, hint: 'Project, data sources, credits, AI use', nav: true, key: 'nav.about' },
]

export function Header({ onPalette }: { onPalette: () => void }) {
  const { view, set } = useApp()
  const { firms, loading, error } = useLive()
  const { t, lang } = useT()
  const active = view === 'method' || view === 'aimodel' ? 'calendar' : view
  const liveState = error ? 'Offline' : loading && !firms ? 'Connecting' : firms?.mock ? 'Mock data' : 'Live'
  const liveLabel = t(liveState === 'Offline' ? 'status.offline' : liveState === 'Connecting' ? 'status.connecting' : liveState === 'Mock data' ? 'status.mock' : 'status.live')

  // nav pill floats (wide screens) and gets denser once the page scrolls
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8)
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])

  // sliding highlight behind the active tab
  const navRef = useRef<HTMLElement>(null)
  const [ind, setInd] = useState<{ left: number; width: number } | null>(null)
  useLayoutEffect(() => {
    const nav = navRef.current
    if (!nav) return
    const measure = () => {
      const el = nav.querySelector<HTMLElement>('[aria-current="page"]')
      setInd(el ? { left: el.offsetLeft, width: el.offsetWidth } : null)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(nav)
    document.fonts?.ready.then(measure).catch(() => {})
    return () => ro.disconnect()
  }, [active, lang])

  return (
    <header className="relative z-40 flex h-[72px] items-center gap-6 px-4 sm:px-8">
      <button onClick={() => set({ view: 'overview' })} className="group flex items-center gap-2.5 text-ink cursor-pointer" aria-label="Fire Guardian home">
        <NovaMark className="h-8 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-105" />
        <span className="font-display text-[19px] font-medium tracking-tight">{t('app.name')}</span>
      </button>
      {/* Glass pill around the sections. On wide screens it is centred and floats at the top
          once the page scrolls; below xl it stays in the header row. */}
      <nav ref={navRef} aria-label="Main" className={cn(
        'relative mx-auto hidden items-center rounded-2xl border p-1 transition-[background-color,border-color,box-shadow] duration-300 md:flex',
        'xl:left-1/2 xl:top-[13px] xl:mx-0 xl:-translate-x-1/2',
        scrolled
          ? 'border-white/[0.14] bg-[#070a12]/80 shadow-[0_14px_40px_-14px_rgba(0,0,0,0.85)] backdrop-blur-xl xl:fixed'
          : 'border-white/[0.08] bg-white/[0.04] backdrop-blur-md xl:absolute',
      )}>
        {ind && <span aria-hidden className="absolute inset-y-1 rounded-xl bg-white/[0.1] ring-1 ring-inset ring-white/[0.1] transition-[left,width] duration-300 ease-out" style={{ left: ind.left, width: ind.width }} />}
        {VIEW_META.filter((v) => v.nav).map((v) => (
          <button key={v.id} onClick={() => set({ view: v.id })} aria-current={active === v.id ? 'page' : undefined}
            className={cn('relative z-10 rounded-xl px-4 py-2 text-[14px] transition-colors duration-200 cursor-pointer',
              active === v.id ? 'text-ink' : 'text-muted hover:bg-white/[0.05] hover:text-ink')}>
            {v.key ? t(v.key) : v.label}
          </button>
        ))}
      </nav>
      <div className="ms-auto flex items-center gap-3 md:ms-0 xl:ms-auto">
        <button onClick={onPalette} className="hidden h-9 items-center gap-2 rounded-full border border-line px-3 text-[12px] text-muted transition-colors hover:border-line-strong hover:text-ink lg:inline-flex cursor-pointer" aria-label="Open command palette">
          <Search size={13} /> <kbd className="num text-[10px]">Ctrl K</kbd>
        </button>
        <span className="inline-flex items-center gap-2 text-[13px] text-muted" title={firms ? `FIRMS fetched ${firms.fetchedAt}` : undefined}>
          <span className={cn('relative flex h-2 w-2')}>
            {liveState === 'Live' && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60 motion-reduce:hidden" />}
            <span className={cn('relative h-2 w-2 rounded-full', liveState === 'Live' ? 'bg-emerald-400' : liveState === 'Connecting' ? 'bg-amber-400' : 'bg-red-500')} />
          </span>
          {liveLabel}
        </span>
        <LangToggle />
        {view !== 'overview' && <RegionSelect compact />}
      </div>
    </header>
  )
}

/** Planet limb in the corner: NASA Blue Marble (GIBS) rendered as an orthographic globe over
 *  Arabia, with soft lighting, atmosphere and a feathered edge (pre-rendered, ~70 KB WebP). */
export function EarthLimb() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[560px] select-none overflow-hidden [mask-image:linear-gradient(180deg,#000_58%,transparent)]">
      <img src="/media/earth-limb.webp" alt="" width={1800} height={560} decoding="async"
        className="fg-earth absolute left-[22%] top-0 h-[560px] w-[1800px] max-w-none sm:left-[30%]" />
    </div>
  )
}

export function Hero() {
  const { t } = useT()
  return (
    <section className="relative z-10 px-4 pb-5 pt-2 sm:px-8 sm:pt-4">
      <h1 className="font-display text-[40px] font-light leading-[1.05] tracking-tight sm:text-[48px]">
        <span className="text-white/45">{t('hero.a')} {t('hero.b')} </span><span className="font-semibold text-white">{t('hero.c')}</span>
      </h1>
      <p className="mt-2 max-w-[560px] text-[16px] leading-relaxed text-white/60">{t('hero.sub')}</p>
    </section>
  )
}

export function Footer() {
  const { t } = useT()
  return (
    <footer className="relative z-10 mt-6 flex items-center gap-5 px-4 pb-6 text-[12px] text-faint sm:px-8">
      <NovaMark className="h-6 opacity-80" />
      <span className="tracking-[0.2em] text-muted">{t('footer.motto')}</span>
      <span className="hidden h-px flex-1 bg-line sm:block" />
      <span className="hidden sm:inline">{t('footer.powered')}</span>
    </footer>
  )
}
