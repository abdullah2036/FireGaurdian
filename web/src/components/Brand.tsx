// Team NovaShift brand mark and the small branded loader used while views or data load.
// AI-assisted: written with Claude Code (Anthropic) for NASA Space Apps 2026.
import { cn } from '@/lib/utils'

export const MARK_SRC = '/brand/novashift-mark.webp'

/** NovaShift emblem (star, orbit, globe), recoloured for the dark UI. */
export function NovaMark({ className }: { className?: string }) {
  return <img src={MARK_SRC} alt="" aria-hidden width={256} height={175} className={cn('h-7 w-auto select-none', className)} draggable={false} />
}

/** Branded loading state: breathing emblem and a thin sweep bar. */
export function BrandLoader({ label, className }: { label?: string; className?: string }) {
  return (
    <div role="status" aria-live="polite" className={cn('flex flex-col items-center justify-center gap-3 py-10', className)}>
      <NovaMark className="fg-breathe h-11" />
      <span className="fg-loadbar" />
      <span className={label ? 'text-[12px] text-muted' : 'sr-only'}>{label ?? 'Loading…'}</span>
    </div>
  )
}
