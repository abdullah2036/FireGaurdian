// Operations: full drone-fleet board (simulation), mission log, alerts and QGroundControl export.
// AI-assisted: written with Claude Code (Anthropic) for NASA Space Apps 2026.
import { Download, FileJson } from 'lucide-react'
import { useLive, FLEET, BASES, CRUISE_KMH, RANGE_KM, SIM_SPEED, qgcPlan } from '@/lib/live'
import { FireMap } from '@/components/FireMap'
import { AlertsCard, Card, ControlsCard, EmergencyBar, WeatherCard } from '@/components/panels'
import { downloadText, cn } from '@/lib/utils'
import { Plane, ScrollText, Warehouse } from 'lucide-react'

export function OperationsView() {
  const live = useLive()
  const tone = (s: string) => s === 'Active' ? 'text-red-300' : s === 'Deploying' ? 'text-amber-300' : s === 'Returning' ? 'text-cyan' : 'text-muted'
  const exportAll = () => {
    const plans = live.drones.filter((d) => d.mission && d.status !== 'Standby').map((d) => ({ drone: d.drone.id, plan: qgcPlan(d.mission!, d.drone) }))
    downloadText('fire-guardian-missions.json', JSON.stringify(plans, null, 2), 'application/json')
  }
  return (
    <div className="grid gap-4 px-4 pt-4 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[28px] font-light tracking-tight">Drone fleet <span className="font-semibold">command</span></h1>
          <p className="mt-1 max-w-[760px] text-sm text-muted">
            Simulation, hardware not tested. Squadron A (D-01–D-09) attempts suppression on active fires; Squadron B (D-10–D-18) sprays preventive coolant on high-risk zones.
            Cruise {CRUISE_KMH} km/h, range {RANGE_KM} km, clock ×{SIM_SPEED}.
          </p>
        </div>
        <button onClick={exportAll} className="inline-flex h-9 items-center gap-2 rounded-lg border border-line-strong px-3 text-sm hover:bg-white/[0.05] cursor-pointer">
          <FileJson size={15} /> Export active missions (.plan)
        </button>
      </div>
      <EmergencyBar />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card icon={<Plane size={18} />} title="Fleet status" right={<span className="text-xs text-muted num">{live.drones.filter((d) => d.status !== 'Standby').length} / {FLEET.length} on mission</span>}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-[12.5px]">
              <thead className="label">
                <tr className="border-b border-line">
                  {['Drone', 'Sqn', 'Model', 'Base', 'Status', 'Target', 'Dist.', 'ETA / progress', 'Plan'].map((h) => <th key={h} className="px-2 py-2 font-normal">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {live.drones.map((d) => (
                  <tr key={d.drone.id} className="border-b border-line/60 hover:bg-white/[0.02]">
                    <td className={cn('px-2 py-1.5 num', d.drone.squadron === 'A' ? 'text-orange-300' : 'text-cyan')}>{d.drone.id}</td>
                    <td className="px-2">{d.drone.squadron}</td>
                    <td className="px-2 text-muted">{d.drone.model}</td>
                    <td className="px-2">{d.drone.base.name}</td>
                    <td className={cn('px-2 font-medium', tone(d.status))}>{d.status}</td>
                    <td className="max-w-[220px] truncate px-2 text-muted">
                      {d.mission && d.status !== 'Standby'
                        ? <button className="hover:text-ink" onClick={() => live.setFocus({ lat: d.mission!.target.lat, lon: d.mission!.target.lon, label: d.mission!.target.label })}>{d.mission.target.label}</button>
                        : '—'}
                    </td>
                    <td className="px-2 num">{d.mission && d.status !== 'Standby' ? `${d.mission.distKm.toFixed(0)} km` : '—'}</td>
                    <td className="px-2 num">
                      {d.status === 'Deploying' ? `${d.etaMin!.toFixed(0)} min` : d.status === 'Active' ? `${Math.round(d.progress * 100)}% · fluid ${Math.round(d.coolant)}%` : d.status === 'Returning' ? 'RTB' : '—'}
                    </td>
                    <td className="px-2">
                      {d.mission && d.status !== 'Standby' && (
                        <button aria-label={`Download QGroundControl plan for ${d.drone.id}`} className="rounded p-1 text-muted hover:bg-white/10 hover:text-ink"
                          onClick={() => downloadText(`${d.drone.id}-${d.mission!.kind}.plan`, JSON.stringify(qgcPlan(d.mission!, d.drone), null, 2), 'application/json')}>
                          <Download size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] text-faint">.plan files follow the QGroundControl mission format (takeoff → waypoint → loiter → RTL). Simulation output; not flight-tested.</p>
        </Card>
        <div className="grid content-start gap-4">
          <ControlsCard />
          <WeatherCard />
          <AlertsCard />
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <FireMap className="h-[480px]" />
        <div className="grid content-start gap-4">
          <Card icon={<ScrollText size={18} />} title="Mission log">
            <ul className="grid max-h-[300px] gap-1.5 overflow-y-auto pr-1 text-[12px]">
              {live.log.map((l, i) => (
                <li key={i} className="flex gap-2">
                  <span className="num shrink-0 text-faint">{new Date(l.t).toISOString().slice(11, 16)}Z</span>
                  <span className={l.tone === 'warn' ? 'text-orange-200' : l.tone === 'ok' ? 'text-emerald-200' : 'text-muted'}>{l.text}</span>
                </li>
              ))}
              {!live.log.length && <li className="text-muted">No events yet.</li>}
            </ul>
          </Card>
          <Card icon={<Warehouse size={18} />} title="Drone bases">
            <ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-[12px]">
              {BASES.map((b) => (
                <li key={b.id} className="flex justify-between"><span>{b.name}</span><span className="num text-faint">{FLEET.filter((d) => d.base.id === b.id).length} UAV</span></li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] text-faint">Illustrative staging bases at regional cities, not real facilities.</p>
          </Card>
        </div>
      </div>
    </div>
  )
}
