// App state kept in the URL hash, so views and regions are linkable.
// AI-assisted: written with Claude Code (Anthropic) for NASA Space Apps 2026.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Mode, ViewId } from './types'

export interface AppState {
  entered: boolean
  view: ViewId
  region: string
  from: string
  to: string
  mode: Mode
}

const VIEWS: ViewId[] = ['calendar', 'live', 'risk', 'drone', 'method', 'about']
export const DEFAULT_FROM = '2001-01'
export const DEFAULT_TO = '2026-11'

function parse(hash: string): AppState {
  const [path, q] = hash.replace(/^#\/?/, '').split('?')
  const p = new URLSearchParams(q ?? '')
  const view = (VIEWS.includes(path as ViewId) ? path : 'calendar') as ViewId
  return {
    entered: path !== '' && path !== undefined,
    view,
    region: p.get('r') ?? 'ksa',
    from: p.get('from') ?? DEFAULT_FROM,
    to: p.get('to') ?? DEFAULT_TO,
    mode: p.get('mode') === 'raw' ? 'raw' : 'harmonized',
  }
}

function serialize(s: AppState): string {
  if (!s.entered) return '#/'
  const p = new URLSearchParams({ r: s.region })
  if (s.from !== DEFAULT_FROM) p.set('from', s.from)
  if (s.to !== DEFAULT_TO) p.set('to', s.to)
  if (s.mode === 'raw') p.set('mode', 'raw')
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
