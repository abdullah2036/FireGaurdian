// Ctrl/Cmd+K command palette: jump between views and regions.
// AI-assisted: written with Claude Code (Anthropic) for NASA Space Apps 2026.
import { useEffect } from 'react'
import { Command } from 'cmdk'
import { MapPin, Search, Shuffle } from 'lucide-react'
import { useApp } from '@/lib/store'
import { useIndex } from '@/lib/data'
import { Dialog, DialogContent } from './ui'
import { VIEW_META } from './Dock'

export function CommandPalette({ open, setOpen }: { open: boolean; setOpen: (o: boolean) => void }) {
  const { set, mode } = useApp()
  const { data } = useIndex()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(!open)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, setOpen])

  const go = (patch: Parameters<typeof set>[0]) => {
    set({ entered: true, ...patch })
    setOpen(false)
  }
  const item = 'flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm data-[selected=true]:bg-white/[0.07]'
  const group = '[&_[cmdk-group-heading]]:label [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2'

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent title="Command palette">
        <Command label="Command palette">
          <div className="flex items-center gap-2 border-b border-line px-4">
            <Search size={16} className="text-muted" />
            <Command.Input autoFocus placeholder="Jump to a view or region…" className="h-12 w-full bg-transparent outline-none placeholder:text-faint" />
          </div>
          <Command.List className="max-h-[50vh] overflow-y-auto p-2">
            <Command.Empty className="p-4 text-sm text-muted">Nothing matches.</Command.Empty>
            <Command.Group heading="Views" className={group}>
              {VIEW_META.map(({ id, label, icon: Icon, hint }) => (
                <Command.Item key={id} value={`view ${label} ${hint}`} onSelect={() => go({ view: id })} className={item}>
                  <Icon size={16} className="text-cyan" /> {label} <span className="ml-auto text-xs text-faint">{hint}</span>
                </Command.Item>
              ))}
            </Command.Group>
            <Command.Group heading="Actions" className={group}>
              <Command.Item value="toggle raw harmonized" onSelect={() => go({ mode: mode === 'raw' ? 'harmonized' : 'raw' })} className={item}>
                <Shuffle size={16} className="text-cyan" /> Switch to {mode === 'raw' ? 'Harmonized' : 'Raw'} series
              </Command.Item>
            </Command.Group>
            <Command.Group heading="Regions" className={group}>
              {(data?.regions ?? []).map((r) => (
                <Command.Item key={r.id} value={`region ${r.name} ${r.short}`} onSelect={() => go({ region: r.id })} className={item}>
                  <MapPin size={16} className="text-ember" /> {r.name}
                </Command.Item>
              ))}
            </Command.Group>
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  )
}
