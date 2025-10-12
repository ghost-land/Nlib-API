import cron from 'node-cron'
import { syncNXGames } from './nxSync.js'
import { syncTitleDB } from './titledbSync.js'

/**
 * Start the automatic sync scheduler
 * - NX TIDs: Daily at 3:00 AM
 * - TitleDB: Every 12 hours (3:00 AM and 3:00 PM)
 */
export function startScheduler() {
  // Schedule NX sync: Run every day at 3:00 AM
  cron.schedule('0 3 * * *', async () => {
    console.log('Starting automatic NX TIDs synchronization...')
    await syncNXGames()
  })

  // Schedule TitleDB sync: Run every 12 hours at 3:00 AM and 3:00 PM
  cron.schedule('0 3,15 * * *', async () => {
    console.log('Starting automatic TitleDB synchronization...')
    await syncTitleDB()
  })

  console.log('Scheduler started:')
  console.log('  - NX TIDs: Daily at 3:00 AM')
  console.log('  - TitleDB: Every 12 hours (3:00 AM & 3:00 PM)')
  
  // Run initial synchronization
  console.log('Running initial synchronization...')
  
  // First sync NX TIDs
  syncNXGames()
    .then(() => {
      // Then sync TitleDB to enrich data
      console.log('Running initial TitleDB synchronization...')
      return syncTitleDB()
    })
    .catch(err => {
      console.error('Initial synchronization error:', err)
    })
}

