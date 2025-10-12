import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import uptime from './routes/uptime.js'
import nx from './routes/nx.js'
import { startScheduler } from './services/scheduler.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Read package.json for version
const packageJson = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'))
const version = packageJson.version

const app = new Hono({ strict: false })

// Serve static files (CSS, JS, Images)
app.use('/css/*', serveStatic({ root: './src/public' }))
app.use('/js/*', serveStatic({ root: './src/public' }))
app.use('/img/*', serveStatic({ root: './src/public' }))

// SEO files - generated dynamically
app.get('/robots.txt', (c) => {
  const url = new URL(c.req.url)
  const baseUrl = `${url.protocol}//${url.host}`
  
  const robotsTxt = `# Robots.txt for Nlib API
User-agent: *
Allow: /
Allow: /nx/
Allow: /uptime

# Sitemap location
Sitemap: ${baseUrl}/sitemap.xml

# Crawl-delay
Crawl-delay: 1
`
  
  return c.text(robotsTxt, 200, {
    'Content-Type': 'text/plain'
  })
})

app.get('/sitemap.xml', (c) => {
  const url = new URL(c.req.url)
  const baseUrl = `${url.protocol}//${url.host}`
  const today = new Date().toISOString().split('T')[0]
  
  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${baseUrl}/nx/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>${baseUrl}/uptime</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.5</priority>
  </url>
</urlset>
`
  
  return c.text(sitemapXml, 200, {
    'Content-Type': 'application/xml'
  })
})

// Home page
app.get('/', (c) => {
  const htmlPath = join(__dirname, 'views', 'home.html')
  let html = readFileSync(htmlPath, 'utf-8')
  
  // Get base URL from request
  const url = new URL(c.req.url)
  const baseUrl = `${url.protocol}//${url.host}`
  
  // Replace placeholders
  html = html.replace(/{{VERSION}}/g, version)
  html = html.replace(/{{BASE_URL}}/g, baseUrl)
  
  return c.html(html)
})

// Routes
app.route('/uptime', uptime)
app.route('/nx', nx)

// Start automatic sync scheduler
startScheduler()

const port = Number(process.env.PORT) || 3000
serve({ fetch: app.fetch, port }, () => {
  console.log(`Server running on http://localhost:${port}`)
})


