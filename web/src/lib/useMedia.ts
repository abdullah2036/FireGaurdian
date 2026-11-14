// Phone detection: narrow screens, or touch devices in landscape with little height.
// AI-assisted: written with Claude Code (Anthropic) for NASA Space Apps 2026.
import { useSyncExternalStore } from 'react'

const PHONE_QUERY = '(max-width: 767px), (pointer: coarse) and (max-height: 520px)'

function subscribe(cb: () => void) {
  const mq = window.matchMedia(PHONE_QUERY)
  mq.addEventListener('change', cb)
  return () => mq.removeEventListener('change', cb)
}

export function useIsPhone() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(PHONE_QUERY).matches, () => false)
}
