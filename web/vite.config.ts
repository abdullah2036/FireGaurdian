// AI-assisted: written with Claude Code (Anthropic) for NASA Space Apps 2026.
import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

// Dev-only: serve /web/api/*.ts Vercel functions through Vite so `npm run dev` works without `vercel dev`.
function vercelApiDev(): Plugin {
  return {
    name: 'vercel-api-dev',
    apply: 'serve',
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next()
        const url = new URL(req.url, 'http://localhost')
        const name = url.pathname.replace(/^\/api\//, '').replace(/\/$/, '')
        if (!/^[a-z0-9-]+$/i.test(name)) return next()
        try {
          const mod = await server.ssrLoadModule(`/api/${name}.ts`)
          const vreq = Object.assign(req, { query: Object.fromEntries(url.searchParams) })
          const vres = Object.assign(res, {
            status(code: number) { res.statusCode = code; return vres },
            json(body: unknown) { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(body)); return vres },
            send(body: string) { res.end(body); return vres },
          })
          await mod.default(vreq, vres)
        } catch (e) {
          res.statusCode = 500
          res.end(JSON.stringify({ error: String(e) }))
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''))
  return {
    plugins: [react(), tailwindcss(), vercelApiDev()],
    resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
    build: { chunkSizeWarningLimit: 1500 },
  }
})
