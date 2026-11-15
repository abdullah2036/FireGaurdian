// Drones page: a SHOWCASE of how drones could work with Fire Guardian. Nothing here is real
// hardware: the concept video is an animation and the fleet below is a simulation flown over
// today's real NASA fire detections. Fleet (cards on phones, table on desktop), mission log
// and QGroundControl .plan export are kept to show what the platform would hand to drones.
// AI-assisted: written with Claude Code (Anthropic) for NASA Space Apps 2026.
import { Download, FileJson, FlaskConical, Plane, ScrollText, Warehouse } from 'lucide-react'
import { useLive, FLEET, BASES, qgcPlan } from '@/lib/live'
import { useT } from '@/lib/i18n'
import { useIsPhone } from '@/lib/useMedia'
import { FireMap } from '@/components/FireMap'
import { ControlsCard } from '@/components/panels'
import { ConceptVideo, HowItWouldWork } from '@/components/DroneConcept'
import { Section } from '@/components/MapPanels'
import { downloadText, cn } from '@/lib/utils'

const tone = (s: string) => s === 'Active' ? 'text-red-300' : s === 'Deploying' ? 'text-amber-300' : s === 'Returning' ? 'text-cyan' : 'text-muted'

function SimPill({ children }: { children: string }) {
  return <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-2.5 py-0.5 text-[12px] font-medium text-amber-300">{children}</span>
}

export function OperationsView() {
  const live = useLive()
  const { t } = useT()
  const phone = useIsPhone()
  const busy = live.drones.filter((d) => d.mission && d.status !== 'Standby')
  const onTarget = live.drones.filter((d) => d.status === 'Active').length
  const plan = (d: (typeof busy)[number]) => downloadText(`${d.drone.id}-${d.mission!.kind}.plan`, JSON.stringify(qgcPlan(d.mission!, d.drone), null, 2), 'application/json')
  const exportAll = () => downloadText('fire-guardian-missions.json', JSON.stringify(busy.map((d) => ({ drone: d.drone.id, plan: qgcPlan(d.mission!, d.drone) })), null, 2), 'application/json')
  const stats: [number, string][] = [
    [FLEET.length, t('drones.statDrones')], [busy.length, t('drones.statMission')],
    [onTarget, t('drones.statTarget')], [BASES.length, t('drones.statBases')],
  ]

  return (
    <div className={cn('grid gap-4', phone ? 'px-3 pt-2' : 'px-4 pt-4 sm:px-8')}>
      <div role="note" className="flex gap-3 rounded-2xl border border-amber-400/40 bg-amber-400/[0.08] p-3.5">
        <FlaskConical size={20} className="mt-0.5 shrink-0 text-amber-300" aria-hidden />
        <div>
          <b className="text-[14px] font-medium text-amber-200">{t('drones.bannerTitle')}</b>
          <p className="mt-0.5 text-[13px] leading-relaxed text-ink/85">{t('drones.banner')}</p>
        </div>
      </div>

      <div>
        <h1 className="flex flex-wrap items-center gap-2 font-display text-[26px] font-light tracking-tight">
          {t('drones.title')} <SimPill>{t('drones.sim')}</SimPill>
        </h1>
        <p className="mt-1 max-w-[760px] text-[13.5px] text-muted">{t('drones.sub')}</p>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <ConceptVideo />
        <HowItWouldWork />
      </div>

      <div className="mt-2 flex flex-wrap items-end justify-between gap-3 border-t border-line pt-5">
        <div>
          <h2 className="flex flex-wrap items-center gap-2 font-display text-[20px] font-light tracking-tight">
            {t('drones.simTitle')} <SimPill>{t('drones.sim')}</SimPill>
          </h2>
          <p className="mt-1 max-w-[760px] text-[13px] text-muted">{t('drones.simSub')}</p>
        </div>
        {!phone && (
          <button onClick={exportAll} className="inline-flex h-9 items-center gap-2 rounded-lg border border-line-strong px-3 text-sm hover:bg-white/[0.05] cursor-pointer">
            <FileJson size={15} /> {t('drones.export')}
          </button>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="relative">
          <FireMap mode="drones" className={phone ? 'h-[46vh] rounded-2xl border border-line' : 'h-[480px]'} />
          <span className="pointer-events-none absolute start-3 top-3 z-10 rounded-full border border-amber-400/50 bg-black/70 px-2.5 py-1 text-[11px] font-medium text-amber-300 backdrop-blur">
            {t('drones.sim')}
          </span>
        </div>
        <div className="grid content-start gap-4">
          <section className="fg-card p-3" aria-label={t('drones.simTitle')}>
            <div className="grid grid-cols-2 gap-2">
              {stats.map(([n, label]) => (
                <div key={label} className="rounded-xl bg-white/[0.04] px-3 py-2">
                  <div className="num text-[22px] font-light leading-tight">{n}</div>
                  <div className="text-[11.5px] text-muted">{label}</div>
                </div>
              ))}
            </div>
          </section>
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
