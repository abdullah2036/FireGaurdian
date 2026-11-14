// AI-assisted: written with Claude Code (Anthropic) for NASA Space Apps 2026.
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Inferno (matplotlib) — perceptually uniform and colorblind-safe. Stops sampled at 0, 0.125, ... 1.
const INFERNO = [
  [0, 0, 4], [31, 12, 72], [85, 15, 109], [136, 34, 106], [186, 54, 85],
  [227, 89, 51], [249, 140, 10], [249, 201, 50], [252, 255, 164],
]

export function inferno(t: number): string {
  const x = Math.min(1, Math.max(0, t)) * (INFERNO.length - 1)
  const i = Math.min(INFERNO.length - 2, Math.floor(x))
  const f = x - i
  const a = INFERNO[i], b = INFERNO[i + 1]
  const c = a.map((v, k) => Math.round(v + (b[k] - v) * f))
  return `rgb(${c[0]} ${c[1]} ${c[2]})`
}

export function fmt(v: number | null | undefined, digits = 0): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—'
  return v.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits })
}

export function downloadText(filename: string, text: string, mime = 'text/csv') {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
