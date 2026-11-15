// Drone page showcase: the team's concept video (silent, enhanced 2x) and the
// "how it would work" steps, each tagged as real today or concept.
// AI-assisted: written with Claude Code (Anthropic) for NASA Space Apps 2026.
import { useEffect, useRef, useState } from 'react'
import { Pause, Play, Radar, Send, ShieldCheck } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'

/** Muted looping concept animation. Autoplays unless the user prefers reduced motion. */
export function ConceptVideo({ className }: { className?: string }) {
  const { t } = useT()
  const ref = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    const v = ref.current
    if (!v) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    v.play().catch(() => {}) // blocked autoplay just leaves the poster and play button
  }, [])

  const toggle = () => {
    const v = ref.current
    if (!v) return
    if (v.paused) v.play().catch(() => {})
    else v.pause()
  }

  return (
    <figure className={cn('relative overflow-hidden rounded-2xl border border-line bg-black', className)}>
      <video
        ref={ref}
        src="/media/drone-concept.mp4"
        poster="/media/drone-concept-poster.jpg"
        muted
        loop
        playsInline
        preload="metadata"
        aria-label={t('drones.video')}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        className="block aspect-[53/29] w-full object-cover"
      />
      <button
        onClick={toggle}
        aria-label={playing ? t('drones.pause') : t('drones.play')}
        className="absolute bottom-3 end-3 grid h-9 w-9 place-items-center rounded-full border border-white/20 bg-black/60 text-white backdrop-blur hover:bg-black/80 cursor-pointer"
      >
        {playing ? <Pause size={15} /> : <Play size={15} />}
      </button>
    </figure>
  )
}

const STEPS = [
  { key: 'drones.step1', icon: Radar, real: true },
  { key: 'drones.step2', icon: Send, real: false },
  { key: 'drones.step3', icon: ShieldCheck, real: false },
] as const

export function HowItWouldWork() {
  const { t } = useT()
  return (
    <section className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4">
      <h2 className="mb-3 text-[14px] font-medium">{t('drones.how')}</h2>
      <ol className="grid gap-3">
        {STEPS.map((s, i) => (
          <li key={s.key} className="flex gap-3">
            <span className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-full border', s.real ? 'border-emerald-400/40 text-emerald-300' : 'border-amber-400/40 text-amber-300')}>
              <s.icon size={15} />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <b className="text-[13.5px] font-medium">{i + 1}. {t(s.key)}</b>
                <span className={cn('rounded-full px-2 py-px text-[10.5px] font-medium', s.real ? 'bg-emerald-400/10 text-emerald-300' : 'bg-amber-400/10 text-amber-300')}>
                  {s.real ? t('drones.tagReal') : t('drones.tagConcept')}
                </span>
              </div>
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">{t(`${s.key}d` as 'drones.step1d')}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
