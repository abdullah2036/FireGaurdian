// Tiny in-memory TTL cache + response helpers shared by the API proxies.
// AI-assisted: written with Claude Code (Anthropic) for NASA Space Apps 2026.
import type { VercelResponse } from '@vercel/node'

const store = new Map<string, { exp: number; value: unknown }>()

export async function cached<T>(key: string, ttlSec: number, fn: () => Promise<T>): Promise<{ value: T; hit: boolean }> {
  const now = Date.now()
  const hit = store.get(key)
  if (hit && hit.exp > now) return { value: hit.value as T, hit: true }
  const value = await fn()
  store.set(key, { exp: now + ttlSec * 1000, value })
  if (store.size > 200) {
    for (const [k, v] of store) if (v.exp < now) store.delete(k)
  }
  return { value, hit: false }
}

export function sendJSON(res: VercelResponse, status: number, body: unknown, sMaxAge = 0) {
  if (sMaxAge > 0) res.setHeader('Cache-Control', `public, max-age=60, s-maxage=${sMaxAge}, stale-while-revalidate=${sMaxAge * 4}`)
  else res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Content-Type', 'application/json')
  res.status(status).send(JSON.stringify(body))
}

export function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return []
  const head = lines[0].split(',')
  return lines.slice(1).map((l) => {
    const cells = l.split(',')
    return Object.fromEntries(head.map((h, i) => [h, cells[i] ?? '']))
  })
}
