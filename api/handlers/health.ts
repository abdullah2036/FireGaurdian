// GET /api/health — which upstream keys are configured (never returns the keys themselves).
// AI-assisted: written with Claude Code (Anthropic) for NASA Space Apps 2026.
import { sendJSON, type Req, type Res } from '../lib/http.js'

export default function handler(_req: Req, res: Res) {
  sendJSON(res, 200, {
    ok: true,
    firms: Boolean(process.env.FIRMS_MAP_KEY),
    meteomatics: Boolean(process.env.METEOMATICS_USER && process.env.METEOMATICS_PASS),
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    time: new Date().toISOString(),
  })
}
