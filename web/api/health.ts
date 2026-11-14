// GET /api/health — which upstream keys are configured (never returns the keys themselves).
// AI-assisted: written with Claude Code (Anthropic) for NASA Space Apps 2026.
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { sendJSON } from './_lib/http.js'

export default function handler(_req: VercelRequest, res: VercelResponse) {
  sendJSON(res, 200, {
    ok: true,
    firms: Boolean(process.env.FIRMS_MAP_KEY),
    meteomatics: Boolean(process.env.METEOMATICS_USER && process.env.METEOMATICS_PASS),
    time: new Date().toISOString(),
  })
}
