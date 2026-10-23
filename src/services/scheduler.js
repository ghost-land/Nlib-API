import cron from 'node-cron'
import { syncNXGames } from './nxSync.js'
import { syncTitleDB } from './titledbSync.js'
import { syncCtrFrom3dsdb } from './ctrSync.js'

/** Serializes all sync jobs — NX, TitleDB and CTR never run in parallel. */
let syncQueue = Promise.resolve()

/**
 * Enqueue a sync so only one runs at a time (FIFO).
 * @param {string} label
 * @param {() => Promise<unknown>} fn
 * @returns {Promise<unknown>}
 */
function enqueueSync(label, fn) {
  const run = syncQueue.then(async () => {
    console.log(`Starting ${label}...`)
    const started = Date.now()
    try {
      const result = await fn()
      console.log(`Finished ${label} in ${((Date.now() - started) / 1000).toFixed(1)}s`)
      return result
    } catch (error) {
      console.error(`${label} error:`, error)
      throw error
    }
  })

  // Keep the queue alive even if a job fails
  syncQueue = run.catch(() => {})
  return run
}

/**
 * Start the automatic sync scheduler.
 * All jobs share one queue: never NX + TitleDB + CTR at the same time.
 *
 * Schedule:
 * - 03:00 → NX TIDs then TitleDB
 * - 15:00 → TitleDB
 * - 04:00 & 16:00 → CTR 3dsdb
 */
export function startScheduler() {
  cron.schedule('0 3 * * *', async () => {
    await enqueueSync('automatic NX TIDs synchronization', syncNXGames)
    await enqueueSync('automatic TitleDB synchronization', syncTitleDB)
  })

  cron.schedule('0 15 * * *', async () => {
    await enqueueSync('automatic TitleDB synchronization', syncTitleDB)
  })

  cron.schedule('0 4,16 * * *', async () => {
    await enqueueSync('automatic CTR synchronization', syncCtrFrom3dsdb)
  })

  console.log('Scheduler started:')
  console.log('  - 03:00: NX TIDs → TitleDB (sequential)')
  console.log('  - 15:00: TitleDB')
  console.log('  - 04:00 & 16:00: CTR')
  console.log('  - Lock: only one sync at a time (NX / TitleDB / CTR)')

  // Boot: CTR first (smaller / faster), then Switch (NX → TitleDB)
  console.log('Running initial synchronization...')
  enqueueSync('initial CTR synchronization', syncCtrFrom3dsdb)
    .then(() => enqueueSync('initial NX TIDs synchronization', syncNXGames))
    .then(() => enqueueSync('initial TitleDB synchronization', syncTitleDB))
    .catch((err) => {
      console.error('Initial synchronization error:', err)
    })
}
