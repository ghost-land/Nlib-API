import { Hono } from 'hono'

const uptime = new Hono()

uptime.get('/', (c) => c.text('ok', 200))

export default uptime

