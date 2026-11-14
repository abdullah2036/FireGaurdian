// Subtle animated starfield; static when prefers-reduced-motion is set.
// AI-assisted: written with Claude Code (Anthropic) for NASA Space Apps 2026.
import { useEffect, useRef } from 'react'

export function Starfield({ density = 0.00012 }: { density?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current!
    const ctx = canvas.getContext('2d')!
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf = 0
    let stars: { x: number; y: number; r: number; a: number; s: number; p: number }[] = []
    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    const resize = () => {
      const w = window.innerWidth, h = window.innerHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const n = Math.round(w * h * density)
      stars = Array.from({ length: n }, () => ({
        x: Math.random() * w, y: Math.random() * h,
        r: Math.random() * 1.1 + 0.2, a: Math.random() * 0.6 + 0.15,
        s: Math.random() * 0.04 + 0.005, p: Math.random() * Math.PI * 2,
      }))
    }
    const draw = (t: number) => {
      const w = window.innerWidth, h = window.innerHeight
      ctx.clearRect(0, 0, w, h)
      for (const st of stars) {
        const tw = reduce ? 1 : 0.65 + 0.35 * Math.sin(t * 0.001 + st.p)
        if (!reduce) {
          st.x -= st.s
          if (st.x < 0) st.x = w
        }
        ctx.globalAlpha = st.a * tw
        ctx.fillStyle = st.r > 1 ? '#cfe9ff' : '#ffffff'
        ctx.beginPath()
        ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2)
        ctx.fill()
      }
      if (!reduce) raf = requestAnimationFrame(draw)
    }
    resize()
    draw(0)
    window.addEventListener('resize', resize)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [density])
  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 -z-10" />
}
