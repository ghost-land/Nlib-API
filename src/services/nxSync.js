import db from '../database/init.js'

const SOURCE_URL = 'https://nx-missing.ghostland.at/data/working.txt'

/**
 * Parse TID line and check if it's a valid base game
 * @param {string} line - Line from the file (format: TID|number)
 * @returns {string|null} - TID if valid, null otherwise
 */
function parseTID(line) {
  const parts = line.split('|')
  if (parts.length < 1) return null
  
  const tid = parts[0].trim()
  
  // Check if TID starts with '01' and ends with '000'
  if (tid.startsWith('01') && tid.endsWith('000')) {
    // Check if TID has valid length (16 characters)
    if (tid.length === 16) {
      return tid
    }
  }
  
  return null
}

/**
 * Download and parse the working.txt file
 * @returns {Promise<string[]>} - Array of valid TIDs
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
    
    const tids = []
    for (const line of lines) {
      const tid = parseTID(line)
      if (tid) {
        tids.push(tid)
      }
    }
    
    console.log(`Found ${tids.length} valid TIDs`)
    return tids
  } catch (error) {
    console.error('Download error:', error.message)
    throw error
  }
}

/**
 * Sync TIDs to database
 * @param {string[]} tids - Array of TIDs to sync
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
    
    // Use direct pool query for better control
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
  
  // Log sync
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
 * Main sync function
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
    
    // Log failed sync
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
 * Get game by TID
 */
export async function getGameByTID(tid) {
  const stmt = db.prepare('SELECT tid FROM nx WHERE tid = $1')
  return await stmt.get(tid)
}

/**
 * Get games count
 */
export async function getGamesCount() {
  const stmt = db.prepare('SELECT COUNT(*) as count FROM nx')
  const result = await stmt.get()
  return parseInt(result.count)
}

/**
 * Get last sync info
 */
export async function getLastSync() {
  const stmt = db.prepare('SELECT * FROM sync_log ORDER BY synced_at DESC LIMIT 1')
  return await stmt.get()
}

