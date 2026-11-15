// App state kept in the URL hash, so views and regions are linkable.
// AI-assisted: written with Claude Code (Anthropic) for NASA Space Apps 2026.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Mode, ViewId } from './types'

export interface AppState {
  view: ViewId
  region: string
  from: string
  to: string
  mode: Mode
  /** Which map view the user picked: live fires, forecast or danger zones. */
  layer: MapLayer
}
export type MapLayer = 'live' | 'sources' | 'forecast' | 'danger'
const LAYERS: MapLayer[] = ['live', 'sources', 'forecast', 'danger']

const VIEWS: ViewId[] = ['overview', 'calendar', 'method', 'aimodel', 'operations', 'about']
export const DEFAULT_FROM = '2001-01'
export const DEFAULT_TO = '2026-11'

function parse(hash: string): AppState {
  const [path, q] = hash.replace(/^#\/?/, '').split('?')
  const p = new URLSearchParams(q ?? '')
  const view = (VIEWS.includes(path as ViewId) ? path : 'overview') as ViewId
  return {
    view,
    region: p.get('r') ?? 'ksa',
    from: p.get('from') ?? DEFAULT_FROM,
    to: p.get('to') ?? DEFAULT_TO,
    mode: p.get('mode') === 'raw' ? 'raw' : 'harmonized',
    layer: (LAYERS.includes(p.get('map') as MapLayer) ? p.get('map') : 'live') as MapLayer,
  }
}

function serialize(s: AppState): string {
  const p = new URLSearchParams({ r: s.region })
  if (s.from !== DEFAULT_FROM) p.set('from', s.from)
  if (s.to !== DEFAULT_TO) p.set('to', s.to)
  if (s.mode === 'raw') p.set('mode', 'raw')
  if (s.view === 'overview' && s.layer !== 'live') p.set('map', s.layer)
  return `#/${s.view}?${p.toString()}`
}

interface Ctx extends AppState {
  set: (patch: Partial<AppState>) => void
}

const AppCtx = createContext<Ctx | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => parse(window.location.hash))

  useEffect(() => {
    const onHash = () => setState(parse(window.location.hash))
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const set = useCallback((patch: Partial<AppState>) => {
    setState((s) => {
      const next = { ...s, ...patch }
      const h = serialize(next)
      if (h !== window.location.hash) window.history.replaceState(null, '', h)
      return next
    })
  }, [])

  const value = useMemo(() => ({ ...state, set }), [state, set])
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>
}

export function useApp() {
  const c = useContext(AppCtx)
  if (!c) throw new Error('useApp outside AppProvider')
  return c
}
