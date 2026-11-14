// Fire Guardian API service (Express on Vercel Services; routed from /api/* by the root vercel.json).
// Routes: GET /api/firms, /api/weather, /api/health. Keys stay server-side in env vars.
// AI-assisted: written with Claude Code (Anthropic) for NASA Space Apps 2026.
import express from 'express'
import firms from './handlers/firms.js'
import weather from './handlers/weather.js'
import health from './handlers/health.js'
import type { Req, Res } from './lib/http.js'

type Handler = (req: Req, res: Res) => unknown
const wrap = (h: Handler): express.RequestHandler => async (req, res, next) => {
  try { await h(req as unknown as Req, res as unknown as Res) } catch (e) { next(e) }
}

const app = express()
app.disable('x-powered-by')
app.get('/api/firms', wrap(firms))
app.get('/api/weather', wrap(weather))
app.get('/api/health', wrap(health))
app.use('/api', (_req, res) => { res.status(404).json({ error: 'unknown API route' }) })
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  res.status(500).json({ error: String((err as Error)?.message ?? err) })
})

export default app
