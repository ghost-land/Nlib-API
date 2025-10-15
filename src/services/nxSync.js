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
function syncToDatabase(tids) {
  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO nx (tid) VALUES (?)
  `)
  
  const insertMany = db.transaction((tids) => {
    let count = 0
    for (const tid of tids) {
      const result = insertStmt.run(tid)
      count += result.changes
    }
    return count
  })
  
  const inserted = insertMany(tids)
  console.log(`Added ${inserted} new games to database`)
  
  // Log sync
  const logStmt = db.prepare(`
    INSERT INTO sync_log (games_count, status, source) VALUES (?, ?, ?)
  `)
  logStmt.run(tids.length, 'success', 'nx_tids')
  
  return inserted
}

/**
 * Main sync function
 */
export async function syncNXGames() {
  try {
    console.log('=== Starting NX synchronization ===')
    const startTime = Date.now()
    
    const tids = await downloadTIDs()
    const inserted = syncToDatabase(tids)
    
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
      INSERT INTO sync_log (games_count, status, source) VALUES (?, ?, ?)
    `)
    logStmt.run(0, 'failed', 'nx_tids')
    
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * Get game by TID
 */
export function getGameByTID(tid) {
  const stmt = db.prepare('SELECT tid FROM nx WHERE tid = ?')
  return stmt.get(tid)
}

/**
 * Get games count
 */
export function getGamesCount() {
  const stmt = db.prepare('SELECT COUNT(*) as count FROM nx')
  return stmt.get().count
}

/**
 * Get last sync info
 */
export function getLastSync() {
  const stmt = db.prepare('SELECT * FROM sync_log ORDER BY synced_at DESC LIMIT 1')
  return stmt.get()
}

