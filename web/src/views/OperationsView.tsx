// Drones page: the drone-fleet SIMULATION (hardware not tested), kept off the main map.
// Map with drones, live drone feed, controls, fleet (cards on phones, table on desktop),
// mission log and QGroundControl .plan export.
// AI-assisted: written with Claude Code (Anthropic) for NASA Space Apps 2026.
import { Download, FileJson, Plane, ScrollText, Warehouse } from 'lucide-react'
import { useLive, FLEET, BASES, qgcPlan } from '@/lib/live'
import { useT } from '@/lib/i18n'
import { useIsPhone } from '@/lib/useMedia'
import { FireMap } from '@/components/FireMap'
import { ControlsCard, DroneFeedCard } from '@/components/panels'
import { Section } from '@/components/MapPanels'
import { downloadText, cn } from '@/lib/utils'

const tone = (s: string) => s === 'Active' ? 'text-red-300' : s === 'Deploying' ? 'text-amber-300' : s === 'Returning' ? 'text-cyan' : 'text-muted'

export function OperationsView() {
  const live = useLive()
  const { t } = useT()
  const phone = useIsPhone()
  const busy = live.drones.filter((d) => d.mission && d.status !== 'Standby')
  const plan = (d: (typeof busy)[number]) => downloadText(`${d.drone.id}-${d.mission!.kind}.plan`, JSON.stringify(qgcPlan(d.mission!, d.drone), null, 2), 'application/json')
  const exportAll = () => downloadText('fire-guardian-missions.json', JSON.stringify(busy.map((d) => ({ drone: d.drone.id, plan: qgcPlan(d.mission!, d.drone) })), null, 2), 'application/json')

  return (
    <div className={cn('grid gap-4', phone ? 'px-3 pt-2' : 'px-4 pt-4 sm:px-8')}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-[26px] font-light tracking-tight">
            {t('drones.title')} <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-2.5 py-0.5 text-[12px] font-medium text-amber-300">{t('drones.sim')}</span>
          </h1>
          <p className="mt-1 max-w-[760px] text-[13.5px] text-muted">{t('drones.sub')}</p>
        </div>
        {!phone && (
          <button onClick={exportAll} className="inline-flex h-9 items-center gap-2 rounded-lg border border-line-strong px-3 text-sm hover:bg-white/[0.05] cursor-pointer">
            <FileJson size={15} /> {t('drones.export')}
          </button>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <FireMap mode="drones" className={phone ? 'h-[46vh] rounded-2xl border border-line' : 'h-[520px]'} />
        <div className="grid content-start gap-4">
          <DroneFeedCard />
          <ControlsCard />
        </div>
      </div>

      <Section icon={<Plane size={17} />} title={t('drones.fleet')} right={<span className="text-[12px] text-muted">{t('drones.onMission', { n: busy.length, t: FLEET.length })}</span>}>
        {phone ? (
          <ul className="grid gap-2">
            {live.drones.filter((d) => d.status !== 'Standby').map((d) => (
              <li key={d.drone.id} className="rounded-xl bg-white/[0.04] p-3">
                <div className="flex items-center gap-2">
                  <span className={cn('num font-medium', d.drone.squadron === 'A' ? 'text-orange-300' : 'text-cyan')}>{d.drone.id}</span>
                  <span className={cn('text-[13px]', tone(d.status))}>{d.status}</span>
                  {d.mission && <button onClick={() => plan(d)} className="ms-auto rounded p-1.5 text-muted" aria-label="Download .plan"><Download size={16} /></button>}
                </div>
                <div className="mt-0.5 truncate text-[12.5px] text-muted">{d.drone.base.name} → {d.mission?.target.label}</div>
                <div className="mt-0.5 text-[12px] num text-faint">{d.status === 'Deploying' ? `ETA ${d.etaMin!.toFixed(0)} min` : d.status === 'Active' ? `${Math.round(d.progress * 100)}%` : 'RTB'} · {d.mission?.distKm.toFixed(0)} km</div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-start text-[12.5px]">
              <thead className="label"><tr className="border-b border-line">
                {['Drone', 'Sqn', 'Model', 'Base', 'Status', 'Target', 'Dist.', 'ETA / progress', 'Plan'].map((h) => <th key={h} className="px-2 py-2 text-start font-normal">{h}</th>)}
              </tr></thead>
              <tbody>
                {live.drones.map((d) => (
                  <tr key={d.drone.id} className="border-b border-line/60 hover:bg-white/[0.02]">
                    <td className={cn('px-2 py-1.5 num', d.drone.squadron === 'A' ? 'text-orange-300' : 'text-cyan')}>{d.drone.id}</td>
                    <td className="px-2">{d.drone.squadron}</td>
                    <td className="px-2 text-muted">{d.drone.model}</td>
                    <td className="px-2">{d.drone.base.name}</td>
                    <td className={cn('px-2 font-medium', tone(d.status))}>{d.status}</td>
                    <td className="max-w-[220px] truncate px-2 text-muted">{d.mission && d.status !== 'Standby' ? d.mission.target.label : '—'}</td>
                    <td className="px-2 num">{d.mission && d.status !== 'Standby' ? `${d.mission.distKm.toFixed(0)} km` : '—'}</td>
                    <td className="px-2 num">{d.status === 'Deploying' ? `${d.etaMin!.toFixed(0)} min` : d.status === 'Active' ? `${Math.round(d.progress * 100)}% · fluid ${Math.round(d.coolant)}%` : d.status === 'Returning' ? 'RTB' : '—'}</td>
                    <td className="px-2">{d.mission && d.status !== 'Standby' && (
                      <button aria-label={`Download QGroundControl plan for ${d.drone.id}`} className="rounded p-1 text-muted hover:bg-white/10 hover:text-ink" onClick={() => plan(d as (typeof busy)[number])}><Download size={14} /></button>
                    )}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-[11px] text-faint">QGroundControl .plan format (takeoff → waypoint → loiter → return). Simulation output; not flight-tested.</p>
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section icon={<ScrollText size={17} />} title={t('drones.log')}>
          <ul className="grid max-h-[300px] gap-1.5 overflow-y-auto pe-1 text-[12px]" dir="ltr">
            {live.log.map((l, i) => (
              <li key={i} className="flex gap-2">
                <span className="num shrink-0 text-faint">{new Date(l.t).toISOString().slice(11, 16)}Z</span>
                <span className={l.tone === 'warn' ? 'text-orange-200' : l.tone === 'ok' ? 'text-emerald-200' : 'text-muted'}>{l.text}</span>
              </li>
            ))}
          </ul>
        </Section>
        <Section icon={<Warehouse size={17} />} title={t('drones.bases')}>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-[12.5px]">
            {BASES.map((b) => <li key={b.id} className="flex justify-between"><span>{b.name}</span><span className="num text-faint">{FLEET.filter((d) => d.base.id === b.id).length}</span></li>)}
          </ul>
        </Section>
      </div>
    </div>
  )
}
