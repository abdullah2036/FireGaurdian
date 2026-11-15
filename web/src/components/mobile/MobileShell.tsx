// Phone layout (used when useIsPhone() is true): app bar, full-screen map with view chips and a
// draggable bottom sheet, other pages as scrolling screens, and an iOS/Android-style tab bar.
// AI-assisted: written with Claude Code (Anthropic) for NASA Space Apps 2026.
import { lazy, Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { BarChart3, Info, Map as MapIcon, Plane } from 'lucide-react'
import { useApp } from '@/lib/store'
import { useLive } from '@/lib/live'
import { LangToggle, useT, type Key } from '@/lib/i18n'
import type { ViewId } from '@/lib/types'
import { Logo } from '@/components/Shell'
import { FireMap } from '@/components/FireMap'
import { Legend, ModePanel, ModeSwitch } from '@/components/MapPanels'
import { OperationsView } from '@/views/OperationsView'
import { AboutView } from '@/views/AboutView'
import { cn } from '@/lib/utils'

const AnalyticsView = lazy(() => import('@/views/AnalyticsView').then((m) => ({ default: m.AnalyticsView })))

const TABS: { id: ViewId; key: Key; icon: typeof MapIcon }[] = [
  { id: 'overview', key: 'nav.map', icon: MapIcon },
  { id: 'calendar', key: 'nav.analytics', icon: BarChart3 },
  { id: 'operations', key: 'nav.drones', icon: Plane },
  { id: 'about', key: 'nav.about', icon: Info },
]
const APPBAR = 56
const TABBAR = 62

function LiveDot() {
  const { firms, loading, error } = useLive()
  const { t } = useT()
  const ok = !error && !firms?.mock && !(loading && !firms)
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-muted">
      <span className={cn('h-2 w-2 rounded-full', ok ? 'bg-emerald-400' : error ? 'bg-red-500' : 'bg-amber-400')} />
      {t(error ? 'status.offline' : loading && !firms ? 'status.connecting' : firms?.mock ? 'status.mock' : 'status.live')}
    </span>
  )
}

function AppBar({ overlay }: { overlay?: boolean }) {
  const { t } = useT()
  return (
    <header className={cn('fixed inset-x-0 top-0 z-30 flex items-center gap-3 px-4', overlay ? 'bg-gradient-to-b from-[#04060b]/95 via-[#04060b]/70 to-transparent' : 'border-b border-white/[0.06] bg-[#05070c]/92 backdrop-blur-xl')}
      style={{ height: APPBAR, paddingTop: 'env(safe-area-inset-top)', boxSizing: 'content-box' }}>
      <Logo size={22} />
      <span className="font-display text-[17px] font-medium">{t('app.name')}</span>
      <span className="ms-auto"><LiveDot /></span>
      <LangToggle className="!h-8 !px-2.5 !text-[12px]" />
    </header>
  )
}

function TabBar() {
  const { view, set } = useApp()
  const { t } = useT()
  const active = view === 'method' || view === 'aimodel' ? 'calendar' : view
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.07] bg-[#06080e]/95 backdrop-blur-xl" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="grid grid-cols-4" style={{ height: TABBAR }}>
        {TABS.map((tb) => {
          const on = active === tb.id
          return (
            <button key={tb.id} onClick={() => set({ view: tb.id })} aria-current={on ? 'page' : undefined}
              className={cn('flex flex-col items-center justify-center gap-1 text-[11px] transition-colors', on ? 'text-white' : 'text-faint')}>
              <span className={cn('grid h-7 w-12 place-items-center rounded-full transition-colors', on && 'bg-white/12')}><tb.icon size={20} strokeWidth={on ? 2.2 : 1.8} /></span>
              {t(tb.key)}
            </button>
          )
        })}
      </div>
    </nav>
  )
}

type Snap = 'peek' | 'half' | 'full'

/** Bottom sheet with three snap points; drag the handle or tap it to cycle. */
function BottomSheet({ snap, setSnap, children, header }: { snap: Snap; setSnap: (s: Snap) => void; children: ReactNode; header: ReactNode }) {
  const [vh, setVh] = useState(() => window.innerHeight)
  useEffect(() => {
    const on = () => setVh(window.innerHeight)
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  const heights: Record<Snap, number> = { peek: 168, half: Math.round(vh * 0.52), full: vh - APPBAR - TABBAR - 24 }
  const [drag, setDrag] = useState<number | null>(null)
  const start = useRef<{ y: number; h: number; moved: boolean } | null>(null)
  const h = drag ?? heights[snap]

  const onDown = (e: React.PointerEvent) => {
    start.current = { y: e.clientY, h: heights[snap], moved: false }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onMove = (e: React.PointerEvent) => {
    if (!start.current) return
    const dy = start.current.y - e.clientY
    if (Math.abs(dy) > 4) start.current.moved = true
    setDrag(Math.max(110, Math.min(heights.full, start.current.h + dy)))
  }
  const onUp = () => {
    if (!start.current) return
    const moved = start.current.moved
    start.current = null
    if (!moved) { setSnap(snap === 'peek' ? 'half' : snap === 'half' ? 'full' : 'peek'); setDrag(null); return }
    const cur = drag ?? heights[snap]
    const nearest = (Object.keys(heights) as Snap[]).reduce((a, b) => (Math.abs(heights[b] - cur) < Math.abs(heights[a] - cur) ? b : a))
    setSnap(nearest)
    setDrag(null)
  }

  return (
    <section className={cn('fixed inset-x-0 z-20 flex flex-col rounded-t-[22px] border-t border-white/10 bg-[#0a0d15]/96 shadow-[0_-12px_40px_rgba(0,0,0,0.55)] backdrop-blur-xl', drag == null && 'transition-[height] duration-300 ease-out')}
      style={{ bottom: `calc(${TABBAR}px + env(safe-area-inset-bottom))`, height: h }} aria-label="Details">
      <div className="shrink-0 cursor-grab touch-none select-none px-4 pb-2 pt-2" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        role="button" aria-label="Resize details" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSnap(snap === 'peek' ? 'half' : snap === 'half' ? 'full' : 'peek') }}>
        <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-white/25" />
        {header}
      </div>
      <div className={cn('min-h-0 flex-1 px-3 pb-4', snap === 'peek' && drag == null ? 'overflow-hidden' : 'overflow-y-auto overscroll-contain')}>{children}</div>
    </section>
  )
}

function MobileMap() {
  const { layer } = useApp()
  const live = useLive()
  const { t } = useT()
  const [snap, setSnap] = useState<Snap>('peek')
  const onSelect = useCallback(() => setSnap((s) => (s === 'peek' ? 'half' : s)), [])
  const summary = layer === 'live'
    ? `${t('live.count')}: ${live.firms ? live.clusters.length : '…'}`
    : layer === 'sources' ? `${t('src.count')}: ${live.firms ? live.firms.detections.filter((d) => d.cls?.category === 'industrial' || d.cls?.category === 'offshore').length : '…'}`
    : layer === 'forecast' ? t('mode.forecast.hint') : t('mode.danger.hint')
  return (
    <>
      <div className="fixed inset-x-0 top-0 z-0" style={{ bottom: `calc(${TABBAR}px + env(safe-area-inset-bottom))` }}>
        <FireMap mode={layer} phone onSelect={onSelect} className="h-full w-full"
          padding={{ top: APPBAR + 64, bottom: 190, left: 16, right: 16 }} />
      </div>
      <AppBar overlay />
      <div className="fixed inset-x-0 z-30" style={{ top: `calc(${APPBAR}px + env(safe-area-inset-top))` }}><ModeSwitch phone /></div>
      <BottomSheet snap={snap} setSnap={setSnap} header={
        <div className="flex items-center gap-2">
          <span className="text-[15px] font-medium">{summary}</span>
          <span className="ms-auto text-[12px] text-faint">{t(snap === 'peek' ? 'common.details' : 'common.close')}</span>
        </div>
      }>
        <Legend mode={layer} className="mb-3 !bg-white/[0.03]" />
        <ModePanel />
      </BottomSheet>
    </>
  )
}

export function MobileShell() {
  const { view } = useApp()
  const { t } = useT()
  const page = (node: ReactNode) => (
    <>
      <AppBar />
      <main className="min-h-[100dvh] pb-6" style={{ paddingTop: `calc(${APPBAR + 8}px + env(safe-area-inset-top))`, paddingBottom: `calc(${TABBAR + 20}px + env(safe-area-inset-bottom))` }}>
        {node}
      </main>
    </>
  )
  return (
    <div className="fg-phone">
      {view === 'overview' && <MobileMap />}
      {(view === 'calendar' || view === 'method' || view === 'aimodel') && page(
        <Suspense fallback={<div className="py-20 text-center text-sm text-muted">{t('common.loading')}</div>}><AnalyticsView /></Suspense>,
      )}
      {view === 'operations' && page(<OperationsView />)}
      {view === 'about' && page(<AboutView />)}
      <TabBar />
    </div>
  )
}
