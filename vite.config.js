import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { scrapePenas } from './server/scrapePenas.js'

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

export default defineConfig({
  plugins: [react(), penasWebEndpoint()],
})
