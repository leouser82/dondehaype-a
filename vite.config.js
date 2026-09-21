import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { scrapePenas } from './server/scrapePenas.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function penasWebEndpoint() {
  return {
    name: 'penas-web-endpoint',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const pathName = (req.url || '').split('?')[0]
        if (pathName !== '/api/penas-web') return next()
        try {
          const url = new URL(req.url, 'http://127.0.0.1')
          const params = Object.fromEntries(url.searchParams.entries())
          const data = await scrapePenas(params)
          res.statusCode = 200
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ penas: data }))
        } catch (error) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ penas: [], error: error.message || 'scrape' }))
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, 'VITE_')
  return {
    envDir: __dirname,
    define: {
      'import.meta.env.VITE_GOOGLE_CLIENT_ID': JSON.stringify(
        env.VITE_GOOGLE_CLIENT_ID ||
          '129434361758-rt6f26mvfdva1d51vafinftgfgbj4jpi.apps.googleusercontent.com',
      ),
    },
    plugins: [react(), penasWebEndpoint()],
  }
})
