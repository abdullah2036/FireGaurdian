// Shared controls: region selector, date range, Raw/Harmonized toggle, data freshness.
// AI-assisted: written with Claude Code (Anthropic) for NASA Space Apps 2026.
import { useMemo, useState } from 'react'
import { Command } from 'cmdk'
import { CalendarRange, ChevronDown, MapPin, Search, Satellite } from 'lucide-react'
import { useApp, DEFAULT_FROM, DEFAULT_TO } from '@/lib/store'
import { useIndex } from '@/lib/data'
import { Button, Popover, PopoverContent, PopoverTrigger, Segmented, Tip } from './ui'

/** Toolbar for the Analytics view: region, date range, Raw/Harmonized, data freshness. */
export function AnalyticsToolbar() {
  const { mode, set } = useApp()
  return (
    <div className="fg-card flex flex-wrap items-center gap-2 p-2.5">
      <RegionSelect />
      <DateRange />
      <Tip side="bottom" label="Raw = MODIS until 2011, then raw VIIRS (shows the sensor jump). Harmonized = one consistent MODIS-scale series.">
        <span>
          <Segmented
            label="Series mode"
            value={mode}
            onChange={(m) => set({ mode: m })}
            options={[{ value: 'raw', label: 'Raw' }, { value: 'harmonized', label: 'Harmonized' }]}
          />
        </span>
      </Tip>
      <div className="ml-auto"><Freshness /></div>
    </div>
  )
}

export function RegionSelect({ compact = false }: { compact?: boolean }) {
  const { region, set } = useApp()
  const { data } = useIndex()
  const [open, setOpen] = useState(false)
  const current = data?.regions.find((r) => r.id === region)
  const groups = useMemo(() => {
    const regs = data?.regions ?? []
    return [
      { label: 'Country & focus areas', items: regs.filter((r) => r.kind !== 'province') },
      { label: 'Provinces', items: regs.filter((r) => r.kind === 'province').sort((a, b) => a.name.localeCompare(b.name)) },
    ]
  }, [data])
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button aria-label="Select region" className={compact ? 'h-9 rounded-full px-4 justify-between gap-3' : 'min-w-[180px] justify-between'}>
          <span className="inline-flex items-center gap-2 truncate">
            {!compact && <MapPin size={15} className="text-ember" />}
            {compact && region === 'ksa' ? 'KSA' : current?.short ?? region}
          </span>
          <ChevronDown size={14} className="text-muted" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0">
        <Command label="Regions" className="text-sm">
          <div className="flex items-center gap-2 border-b border-line px-3">
            <Search size={14} className="text-muted" />
            <Command.Input autoFocus placeholder="Search regions…" className="h-10 w-full bg-transparent outline-none placeholder:text-faint" />
          </div>
          <Command.List className="max-h-[320px] overflow-y-auto p-1">
            <Command.Empty className="p-3 text-muted">No region found.</Command.Empty>
            {groups.map((g) => (
              <Command.Group key={g.label} heading={g.label} className="[&_[cmdk-group-heading]]:label [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5">
                {g.items.map((r) => (
                  <Command.Item
                    key={r.id}
                    value={`${r.name} ${r.short} ${r.id}`}
                    onSelect={() => {
                      set({ region: r.id })
                      setOpen(false)
                    }}
                    className="flex cursor-pointer items-center justify-between rounded-md px-2 py-1.5 data-[selected=true]:bg-white/[0.07]"
                  >
                    <span className={r.id === region ? 'text-cyan' : ''}>{r.name}</span>
                    <span className="num text-[11px] text-faint">{r.detections.kept.toLocaleString()}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            ))}
          </Command.List>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export function DateRange() {
  const { from, to, set } = useApp()
  const years = Array.from({ length: 2026 - 2001 + 1 }, (_, i) => 2001 + i)
  const presets = [
    { label: 'Full record', from: DEFAULT_FROM, to: DEFAULT_TO },
    { label: 'MODIS era (2001–2011)', from: '2001-01', to: '2011-12' },
    { label: 'Overlap (2012→)', from: '2012-01', to: DEFAULT_TO },
    { label: 'Last 5 years', from: '2022-01', to: DEFAULT_TO },
  ]
  const sel = (v: string, onChange: (v: string) => void, label: string, end = false) => (
    <label className="flex flex-col gap-1">
      <span className="label">{label}</span>
      <select
        value={v.slice(0, 4)}
        onChange={(e) => onChange(`${e.target.value}-${end ? (e.target.value === '2026' ? '11' : '12') : '01'}`)}
        className="h-9 rounded-md border border-line-strong bg-space px-2 text-sm num"
      >
        {years.map((y) => <option key={y} value={y}>{y}</option>)}
      </select>
    </label>
  )
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button aria-label="Select date range">
          <CalendarRange size={15} className="text-cyan" />
          <span className="num text-[13px]">{from.slice(0, 4)}–{to.slice(0, 4)}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px]">
        <div className="grid grid-cols-2 gap-2">
          {sel(from, (v) => set({ from: v > to ? to : v }), 'From')}
          {sel(to, (v) => set({ to: v < from ? from : v }), 'To', true)}
        </div>
        <div className="mt-3 flex flex-col gap-1">
          {presets.map((p) => (
            <button key={p.label} onClick={() => set({ from: p.from, to: p.to })}
              className="rounded-md px-2 py-1.5 text-left text-sm text-muted hover:bg-white/[0.06] hover:text-ink cursor-pointer">
              {p.label}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export function Freshness() {
  const { data } = useIndex()
  if (!data) return null
  const v = data.coverage.VIIRS, m = data.coverage.MODIS
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="inline-flex h-9 items-center gap-2 rounded-lg border border-ok/30 bg-ok/5 px-3 text-xs text-ok cursor-pointer" aria-label="Data freshness">
          <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ok opacity-60 motion-reduce:hidden" /><span className="relative h-2 w-2 rounded-full bg-ok" /></span>
          <span className="num">Archive to {m.last}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[320px] text-sm">
        <div className="mb-2 flex items-center gap-2 font-display"><Satellite size={15} className="text-cyan" /> Data freshness</div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[13px]">
          <dt className="text-muted">MODIS</dt><dd className="num">{m.first} → {m.last} <span className="text-faint">({m.satellites.join(' + ')})</span></dd>
          <dt className="text-muted">VIIRS</dt><dd className="num">{v.first} → {v.last} <span className="text-faint">({v.satellites.join(', ')})</span></dd>
          <dt className="text-muted">Built</dt><dd className="num">{data.generatedAt.replace('T', ' ').slice(0, 16)} UTC</dd>
        </dl>
        <p className="mt-2 text-[12px] text-faint">Suomi NPP stopped producing data on 2 Nov 2026; live monitoring uses NOAA-20/21 VIIRS via the FIRMS API.</p>
      </PopoverContent>
    </Popover>
  )
}
