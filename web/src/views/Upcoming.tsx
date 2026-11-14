// Views scheduled for later phases. Live Map already exercises the /api/firms proxy.
// AI-assisted: written with Claude Code (Anthropic) for NASA Space Apps 2026.
import { Radar, Flame, Plane } from 'lucide-react'
import { useJSON } from '@/lib/data'
import { Badge, Panel, StateBox } from '@/components/ui'
import { fmt } from '@/lib/utils'

interface FirmsResp { fetchedAt: string; mock: boolean; count: number; vegetation: number; errors: string[]; sources: string[] }

function Soon({ icon: Icon, title, lines, children }: { icon: typeof Radar; title: string; lines: string[]; children?: React.ReactNode }) {
  return (
    <Panel title={<span className="inline-flex items-center gap-2"><Icon size={17} className="text-cyan" /> {title}</span>} subtitle="In development — part of the next build phase.">
      <ul className="grid gap-1.5 text-sm text-muted">{lines.map((l) => <li key={l}>• {l}</li>)}</ul>
      {children}
    </Panel>
  )
}

export function LiveView() {
  const { data, error, loading } = useJSON<FirmsResp>('/api/firms?days=2')
  return (
    <Soon icon={Radar} title="Live Saudi Arabia monitoring" lines={[
      'Latest NOAA-20 / NOAA-21 VIIRS detections on a MapLibre + deck.gl map',
      'Gas flares and industrial sites masked (same mask as the calendar)',
      'NASA GIBS VIIRS true-colour and thermal-anomaly overlays',
    ]}>
      <div className="mt-4 rounded-lg border border-line p-3">
        <div className="label mb-2">FIRMS proxy status · last 48 h</div>
        {loading && <StateBox kind="loading">Querying NASA FIRMS…</StateBox>}
        {error && <StateBox kind="error">{error}</StateBox>}
        {data && (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="num text-2xl">{fmt(data.count)}</span><span className="text-muted">detections in KSA</span>
            <span className="num text-2xl text-ember">{fmt(data.vegetation)}</span><span className="text-muted">after flare mask</span>
            {data.mock ? <Badge tone="danger">mock data</Badge> : <Badge tone="ok">live · {data.sources.join(' + ')}</Badge>}
          </div>
        )}
      </div>
    </Soon>
  )
}

export function RiskView() {
  return <Soon icon={Flame} title="Risk outlook" lines={[
    'Probabilistic “critical period” risk per ~25 km cell for the coming days and weeks',
    'Harmonized fire history + NASA POWER history + Meteomatics forecast',
    'Validated on a held-out year with PR-AUC vs a seasonal baseline; shown as Low / Elevated / High with uncertainty',
  ]} />
}

export function DroneView() {
  return <Soon icon={Plane} title="Drone Ops (simulation, hardware not tested)" lines={[
    'Nearest drone base, distance and ETA for a hotspot alert',
    'Mission type by FRP: suppression attempt vs scout-and-report',
    'Animated flight, mission log, wind at target, QGroundControl .plan export',
  ]} />
}
