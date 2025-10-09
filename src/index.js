import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import uptime from './routes/uptime.js'

const app = new Hono()

// routes
app.route('/uptime', uptime)

const port = Number(process.env.PORT) || 3000
serve({ fetch: app.fetch, port }, () => {
  console.log(`Server running on http://localhost:${port}`)
})


