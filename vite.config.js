import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { handlePenasApi } from './server/penasApi.js'
import { getPool } from './server/mysql.js'
import { scrapePenas } from './server/scrapePenas.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function apiEndpoints() {
  return {
    name: 'penas-api-endpoints',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        try {
          const handled = await handlePenasApi(req, res)
          if (handled) return
        } catch (error) {
          if (!res.writableEnded) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.end(JSON.stringify({ error: error.message || 'api' }))
          }
          return
        }
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
      getPool().catch((error) => {
        console.warn('[mysql] todavía no hay conexión:', error.code || error.message)
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const keys = ['MYSQL_URL', 'MYSQL_HOST', 'MYSQL_PORT', 'MYSQL_DATABASE', 'MYSQL_USER', 'MYSQL_PASSWORD']
  for (const key of keys) delete process.env[key]
  const env = loadEnv(mode, __dirname, '')
  for (const key of keys) {
    if (env[key]) process.env[key] = env[key]
  }
  return {
    envDir: __dirname,
    define: {
      'import.meta.env.VITE_GOOGLE_CLIENT_ID': JSON.stringify(
        env.VITE_GOOGLE_CLIENT_ID ||
          '129434361758-rt6f26mvfdva1d51vafinftgfgbj4jpi.apps.googleusercontent.com',
      ),
    },
    plugins: [react(), apiEndpoints()],
  }
})
