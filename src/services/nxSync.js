import db from '../database/init.js'

const SOURCE_URL = 'https://nx-missing.ghostland.at/data/working.txt'

/**
 * Parse and validate Title ID from working.txt line
 * @param {string} line - Line format: TID|number
 * @returns {string|null} - Valid base game TID or null
 */
function parseTID(line) {
  const parts = line.split('|')
  if (parts.length < 1) return null
  
  const tid = parts[0].trim()
  
  // Base games: 16 chars, start with '01', end with '000'
  if (tid.length === 16 && tid.startsWith('01') && tid.endsWith('000')) {
    return tid
  }
  
  return null
}

/**
 * Fetch and parse working.txt for base game TIDs
 * @returns {Promise<string[]>} - Array of valid base game TIDs
 */
async function downloadTIDs() {
  try {
    console.log(`Downloading from ${SOURCE_URL}...`)
    const response = await fetch(SOURCE_URL)
    
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`)
    }
    
    const text = await response.text()
    const lines = text.split('\n')
    
    const tids = lines
      .map(line => parseTID(line))
      .filter(tid => tid !== null)
    
    console.log(`Found ${tids.length} valid TIDs`)
    return tids
  } catch (error) {
    console.error('Download error:', error.message)
    throw error
  }
}

/**
 * Insert TIDs into database in batches
 * @param {string[]} tids - Array of Title IDs
 * @returns {Promise<number>} - Number of new entries inserted
 */
async function syncToDatabase(tids) {
  console.log(`Syncing ${tids.length} TIDs to database...`)
  
  const BATCH_SIZE = 1000
  const totalBatches = Math.ceil(tids.length / BATCH_SIZE)
  let totalInserted = 0
  
  for (let i = 0; i < tids.length; i += BATCH_SIZE) {
    const batch = tids.slice(i, i + BATCH_SIZE)
    const batchNum = Math.floor(i / BATCH_SIZE) + 1
    
    console.log(`  Processing batch ${batchNum}/${totalBatches}...`)
    
    const client = await db.pool.connect()
    try {
      await client.query('BEGIN')
      
      let count = 0
      for (const tid of batch) {
        const result = await client.query(
          'INSERT INTO nx (tid) VALUES ($1) ON CONFLICT (tid) DO NOTHING',
          [tid]
        )
        count += result.rowCount
      }
      
      await client.query('COMMIT')
      totalInserted += count
      
      console.log(`  ✓ Batch ${batchNum}/${totalBatches}: ${count} new games added (${i + batch.length}/${tids.length} processed)`)
    } catch (error) {
      await client.query('ROLLBACK')
      console.error(`  ✗ Error in batch ${batchNum}:`, error.message)
      throw error
    } finally {
      client.release()
    }
  }
  
  console.log(`✓ Total: ${totalInserted} new games added to database`)
  
  try {
    await db.pool.query(
      'INSERT INTO sync_log (games_count, status, source) VALUES ($1, $2, $3)',
      [tids.length, 'success', 'nx_tids']
    )
  } catch (error) {
    console.error('Error logging sync:', error.message)
  }
  
  return totalInserted
}

/**
 * Synchronize Nintendo Switch TIDs from nx-missing source
 * @returns {Promise<Object>} - Sync results with success status
 */
export async function syncNXGames() {
  try {
    console.log('=== Starting NX synchronization ===')
    const startTime = Date.now()
    
    const tids = await downloadTIDs()
    const inserted = await syncToDatabase(tids)
    
    const duration = Date.now() - startTime
    console.log(`Synchronization completed in ${duration}ms`)
    console.log('====================================')
    
    return {
      success: true,
      total: tids.length,
      inserted,
      duration
    }
  } catch (error) {
    console.error('Synchronization error:', error)
    
    const logStmt = db.prepare(`
      INSERT INTO sync_log (games_count, status, source) VALUES ($1, $2, $3)
    `)
    await logStmt.run(0, 'failed', 'nx_tids')
    
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * Retrieve game by Title ID
 * @param {string} tid - Title ID
 * @returns {Promise<Object|null>} - Game data or null
 */
export async function getGameByTID(tid) {
  const stmt = db.prepare('SELECT tid FROM nx WHERE tid = $1')
  return await stmt.get(tid)
}

/**
 * Get total number of games in database
 * @returns {Promise<number>} - Total game count
 */
export async function getGamesCount() {
  const stmt = db.prepare('SELECT COUNT(*) as count FROM nx')
  const result = await stmt.get()
  return parseInt(result.count)
}

/**
 * Get most recent synchronization log entry
 * @returns {Promise<Object|null>} - Last sync log or null
 */
export async function getLastSync() {
  const stmt = db.prepare('SELECT * FROM sync_log ORDER BY synced_at DESC LIMIT 1')
  return await stmt.get()
}

