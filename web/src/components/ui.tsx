// shadcn/ui-style wrappers over Radix primitives, themed for NovaShift.
// AI-assisted: written with Claude Code (Anthropic) for NASA Space Apps 2026.
import * as TooltipP from '@radix-ui/react-tooltip'
import * as PopoverP from '@radix-ui/react-popover'
import * as DialogP from '@radix-ui/react-dialog'
import * as ToggleGroupP from '@radix-ui/react-toggle-group'
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export const TooltipProvider = TooltipP.Provider

export function Tip({ label, children, side = 'right' }: { label: ReactNode; children: ReactNode; side?: 'top' | 'right' | 'bottom' | 'left' }) {
  return (
    <TooltipP.Root delayDuration={150}>
      <TooltipP.Trigger asChild>{children}</TooltipP.Trigger>
      <TooltipP.Portal>
        <TooltipP.Content side={side} sideOffset={8} className="pop px-2.5 py-1.5 text-xs">
          {label}
        </TooltipP.Content>
      </TooltipP.Portal>
    </TooltipP.Root>
  )
}

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'ghost' | 'outline' | 'ember' | 'cyan' }>(
  function Button({ className, variant = 'outline', ...props }, ref) {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center gap-2 rounded-lg px-3 h-9 text-sm font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none cursor-pointer',
          variant === 'outline' && 'border border-line-strong/80 bg-white/[0.02] hover:bg-white/[0.06] text-ink',
          variant === 'ghost' && 'hover:bg-white/[0.06] text-muted hover:text-ink',
          variant === 'ember' && 'bg-ember text-[#1a0a02] hover:bg-[#ff8f5c] shadow-[0_0_30px_-6px_rgba(255,122,61,0.7)]',
          variant === 'cyan' && 'bg-cyan-soft text-cyan border border-cyan/40 hover:bg-cyan/20',
          className,
        )}
        {...props}
      />
    )
  },
)

export const Popover = PopoverP.Root
export const PopoverTrigger = PopoverP.Trigger
export function PopoverContent({ className, children, align = 'start' }: { className?: string; children: ReactNode; align?: 'start' | 'center' | 'end' }) {
  return (
    <PopoverP.Portal>
      <PopoverP.Content align={align} sideOffset={8} className={cn('pop p-3 fade-up', className)}>
        {children}
      </PopoverP.Content>
    </PopoverP.Portal>
  )
}

export const Dialog = DialogP.Root
export function DialogContent({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <DialogP.Portal>
      <DialogP.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
      <DialogP.Content className={cn('pop fixed left-1/2 top-[18%] z-[61] w-[min(640px,92vw)] -translate-x-1/2 fade-up', className)}>
        <DialogP.Title className="sr-only">{title}</DialogP.Title>
        <DialogP.Description className="sr-only">{title}</DialogP.Description>
        {children}
      </DialogP.Content>
    </DialogP.Portal>
  )
}

/** Right-hand drawer for secondary options. */
export function Drawer({ open, onOpenChange, title, children }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; children: ReactNode }) {
  return (
    <DialogP.Root open={open} onOpenChange={onOpenChange}>
      <DialogP.Portal>
        <DialogP.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <DialogP.Content className="pop fixed right-3 top-3 bottom-3 z-[61] w-[min(440px,92vw)] overflow-y-auto p-5 fade-up">
          <div className="flex items-center justify-between mb-4">
            <DialogP.Title className="font-display text-lg">{title}</DialogP.Title>
            <DialogP.Close className="rounded-md p-1 text-muted hover:text-ink" aria-label="Close">
              <X size={18} />
            </DialogP.Close>
          </div>
          <DialogP.Description className="sr-only">{title}</DialogP.Description>
          {children}
        </DialogP.Content>
      </DialogP.Portal>
    </DialogP.Root>
  )
}

export function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label: string }) {
  return (
    <ToggleGroupP.Root
      type="single"
      value={value}
      onValueChange={(v) => v && onChange(v as T)}
      aria-label={label}
      className="inline-flex h-9 rounded-lg border border-line-strong/80 bg-white/[0.02] p-0.5"
    >
      {options.map((o) => (
        <ToggleGroupP.Item
          key={o.value}
          value={o.value}
          className="px-3 text-sm rounded-md text-muted data-[state=on]:bg-cyan-soft data-[state=on]:text-cyan transition-colors cursor-pointer"
        >
          {o.label}
        </ToggleGroupP.Item>
      ))}
    </ToggleGroupP.Root>
  )
}

export function Panel({ title, subtitle, actions, children, className }: { title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('glass p-4 fade-up', className)}>
      {(title || actions) && (
        <header className="mb-3 flex items-start justify-between gap-3">
          <div>
            {title && <h2 className="font-display text-[15px] font-semibold tracking-tight">{title}</h2>}
            {subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-1.5">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  )
}

export function Badge({ children, tone = 'muted', className }: { children: ReactNode; tone?: 'muted' | 'ember' | 'cyan' | 'ok' | 'danger'; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium',
        tone === 'muted' && 'border-line-strong text-muted',
        tone === 'ember' && 'border-ember/40 text-ember bg-ember-soft',
        tone === 'cyan' && 'border-cyan/40 text-cyan bg-cyan-soft',
        tone === 'ok' && 'border-ok/40 text-ok bg-ok/10',
        tone === 'danger' && 'border-danger/40 text-danger bg-danger/10',
        className,
      )}
    >
      {children}
    </span>
  )
}

export function StateBox({ kind, children }: { kind: 'loading' | 'error' | 'empty'; children?: ReactNode }) {
  return (
    <div role={kind === 'error' ? 'alert' : 'status'} className="flex min-h-[200px] items-center justify-center p-6 text-sm text-muted">
      {kind === 'loading' && (
        <span className="inline-flex items-center gap-3">
          <span className="h-2 w-2 animate-ping rounded-full bg-cyan" /> {children ?? 'Loading data…'}
        </span>
      )}
      {kind === 'error' && <span className="text-danger">⚠ {children ?? 'Something went wrong.'}</span>}
      {kind === 'empty' && <span>{children ?? 'No data for this selection.'}</span>}
    </div>
  )
}
