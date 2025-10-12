import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import uptime from './routes/uptime.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Read package.json for version
const packageJson = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'))
const version = packageJson.version

const app = new Hono()

// Serve static files (CSS, JS)
app.use('/css/*', serveStatic({ root: './src/public' }))
app.use('/js/*', serveStatic({ root: './src/public' }))

// Home page
app.get('/', (c) => {
  const htmlPath = join(__dirname, 'views', 'home.html')
  let html = readFileSync(htmlPath, 'utf-8')
  
  // Replace version placeholder with actual version from package.json
  html = html.replace('{{VERSION}}', version)
  
  return c.html(html)
})

// Routes
app.route('/uptime', uptime)

const port = Number(process.env.PORT) || 3000
serve({ fetch: app.fetch, port }, () => {
  console.log(`Server running on http://localhost:${port}`)
})


