import db from '../database/init.js'
import { downloadGameMedia } from './mediaDownloader.js'

const TITLEDB_BASE_URL = 'https://raw.githubusercontent.com/blawar/titledb/refs/heads/master'

// TitleDB sources to sync (region.language)
const TITLEDB_SOURCES = [
  // English sources (prioritize US first)
  { region: 'US', lang: 'en', priority: 1 },
  { region: 'GB', lang: 'en', priority: 2 },
  { region: 'AU', lang: 'en', priority: 3 },
  
  // Other languages
  { region: 'JP', lang: 'ja', priority: 1 },
  { region: 'ES', lang: 'es', priority: 1 },
  { region: 'DE', lang: 'de', priority: 1 },
  { region: 'FR', lang: 'fr', priority: 1 },
  { region: 'NL', lang: 'nl', priority: 1 },
  { region: 'BR', lang: 'pt', priority: 1 },
  { region: 'IT', lang: 'it', priority: 1 },
  { region: 'CN', lang: 'zh', priority: 1 },
  { region: 'KR', lang: 'ko', priority: 1 },
  { region: 'RU', lang: 'ru', priority: 1 }
]

/**
 * Format date from YYYYMMDD to YYYY-MM-DD
 * @param {number|string} dateNum - Date in YYYYMMDD format
 * @returns {string|null} - Date in YYYY-MM-DD format
 */
function formatReleaseDate(dateNum) {
  if (!dateNum) return null
  
  const dateStr = dateNum.toString()
  if (dateStr.length !== 8) return null
  
  const year = dateStr.substring(0, 4)
  const month = dateStr.substring(4, 6)
  const day = dateStr.substring(6, 8)
  
  return `${year}-${month}-${day}`
}

/**
 * Check if TID is a valid base game
 * @param {string} tid - Title ID
 * @returns {boolean}
 */
function isValidBaseTID(tid) {
  if (!tid || tid.length !== 16) return false
  return tid.startsWith('01') && tid.endsWith('000')
}

/**
 * Show progress bar in console
 */
function showProgress(current, total, label = 'Progress') {
  if (!total || total <= 0 || !current || current < 0) {
    return
  }
  
  const percentage = Math.min(100, Math.floor((current / total) * 100))
  const barLength = 40
  const filledLength = Math.max(0, Math.min(barLength, Math.floor((barLength * current) / total)))
  const emptyLength = Math.max(0, barLength - filledLength)
  const bar = '█'.repeat(filledLength) + '░'.repeat(emptyLength)
  process.stdout.write(`\r${label}: [${bar}] ${percentage}%`)
  if (current >= total) {
    process.stdout.write('\n')
  }
}

/**
 * Download and parse titledb JSON for a specific source
 * @param {Object} source - Source config {region, lang}
 * @returns {Promise<Object>} - Parsed JSON object
 */
async function downloadTitleDB(source) {
  try {
    const url = `${TITLEDB_BASE_URL}/${source.region}.${source.lang}.json`
    console.log(`Downloading ${source.region}.${source.lang}...`)
    
    const startTime = Date.now()
    
    const response = await fetch(url, {
      signal: AbortSignal.timeout(180000) // 3 minutes timeout
    })
    
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`)
    }
    
    const data = await response.json()
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2)
    console.log(`✓ Loaded ${source.region}.${source.lang} in ${duration}s (${Object.keys(data).length} entries)`)
    
    return data
  } catch (error) {
    console.error(`✗ Error loading ${source.region}.${source.lang}:`, error.message)
    return null // Return null instead of throwing to continue with other sources
  }
}

/**
 * Process games in batches for better performance
 * RULE: Only update fields that are currently NULL - never overwrite existing data
 * @param {Object} titledb - Full titledb object
 * @param {string} lang - Language code (en, ja, es, etc.)
 */
async function processTitleDBInBatches(titledb, lang) {
  const BATCH_SIZE = 1000
  const entries = Object.entries(titledb)
  const totalEntries = entries.length
  
  let processed = 0
  let added = 0
  let updated = 0
  let skipped = 0
  let mediaDownloaded = 0
  const skippedExamples = [] // Store varied examples
  const MAX_EXAMPLES = 10
  
  // Prepare statements once - ONLY update NULL fields (never overwrite existing data)
  const checkStmt = db.prepare('SELECT tid FROM games WHERE tid = ?')
  const insertGameStmt = db.prepare(`
    INSERT INTO games (
      tid, name, publisher, developer, release_date, category, languages,
      nsu_id, number_of_players, rating_content, rights_id, region,
      is_demo, console, type, version, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(tid) DO UPDATE SET
      name = CASE WHEN name IS NULL THEN excluded.name ELSE name END,
      publisher = CASE WHEN publisher IS NULL THEN excluded.publisher ELSE publisher END,
      developer = CASE WHEN developer IS NULL THEN excluded.developer ELSE developer END,
      release_date = CASE WHEN release_date IS NULL THEN excluded.release_date ELSE release_date END,
      category = CASE WHEN category IS NULL THEN excluded.category ELSE category END,
      languages = CASE WHEN languages IS NULL THEN excluded.languages ELSE languages END,
      nsu_id = CASE WHEN nsu_id IS NULL THEN excluded.nsu_id ELSE nsu_id END,
      number_of_players = CASE WHEN number_of_players IS NULL THEN excluded.number_of_players ELSE number_of_players END,
      rating_content = CASE WHEN rating_content IS NULL THEN excluded.rating_content ELSE rating_content END,
      rights_id = CASE WHEN rights_id IS NULL THEN excluded.rights_id ELSE rights_id END,
      region = CASE WHEN region IS NULL THEN excluded.region ELSE region END,
      is_demo = CASE WHEN is_demo IS NULL THEN excluded.is_demo ELSE is_demo END,
      updated_at = CURRENT_TIMESTAMP
  `)
  
  // Dynamic description statement per language
  const insertDescStmt = db.prepare(`
    INSERT INTO nx_${lang} (tid, intro, description)
    VALUES (?, ?, ?)
    ON CONFLICT(tid) DO UPDATE SET
      intro = CASE WHEN intro IS NULL THEN excluded.intro ELSE intro END,
      description = CASE WHEN description IS NULL THEN excluded.description ELSE description END
  `)
  
  // Process in batches with transactions
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE)
    const batchNum = Math.floor(i / BATCH_SIZE) + 1
    const totalBatches = Math.ceil(totalEntries / BATCH_SIZE)
    
    console.log(`Processing batch ${batchNum}/${totalBatches} (${batch.length} entries)`)
    
    // Collect games that might need media download (only for English to avoid duplicates)
    const gamesForMedia = []
    
    const processBatch = db.transaction(() => {
      for (const [nsuId, gameData] of batch) {
        const tid = gameData.id
        
        // Check if TID is valid
        if (!tid || !isValidBaseTID(tid)) {
          skipped++
          // Store varied examples of skipped TIDs (sample every ~1500 to get variety)
          if (skippedExamples.length < MAX_EXAMPLES && tid && skipped % 1500 === 1) {
            const reason = !tid.startsWith('01') ? 'not-switch' :
                          tid.endsWith('800') ? 'update' :
                          !tid.endsWith('000') ? 'dlc' :
                          tid.length !== 16 ? 'invalid-format' : 'other'
            skippedExamples.push(`${tid} (${reason})`)
          }
          continue
        }
        
        // Check if game exists
        const existingGame = checkStmt.get(tid)
        
        if (existingGame) {
          updated++
        } else {
          added++
        }
        
        // Collect game for media download check (only for English source)
        if (lang === 'en' && gameData.iconUrl) {
          gamesForMedia.push({ tid, gameData })
        }
        
        // Insert/update game data
        insertGameStmt.run(
          tid,
          gameData.name || null,
          gameData.publisher || null,
          gameData.developer || null,
          formatReleaseDate(gameData.releaseDate),
          gameData.category ? JSON.stringify(gameData.category) : null,
          gameData.languages ? JSON.stringify(gameData.languages) : null,
          gameData.nsuId || null,
          gameData.numberOfPlayers || null,
          gameData.ratingContent ? JSON.stringify(gameData.ratingContent) : null,
          gameData.rightsId || null,
          gameData.region || null,
          gameData.isDemo ? 1 : 0,
          'nx',
          'base',
          gameData.version || 0
        )
        
        // Insert/update description
        insertDescStmt.run(
          tid,
          gameData.intro || null,
          gameData.description || null
        )
        
        processed++
      }
    })
    
    processBatch()
    
    // Download missing media (outside transaction, async)
    // Only for English sources to avoid downloading duplicates
    if (gamesForMedia.length > 0 && lang === 'en') {
      console.log(`  Checking media for ${gamesForMedia.length} games...`)
      
      for (const { tid, gameData } of gamesForMedia) {
        // downloadGameMedia already checks if files exist before downloading
        const result = await downloadGameMedia(tid, gameData)
        // Count as downloaded if we got at least one media file
        if (result.icon || result.banner || result.screenshots > 0) {
          mediaDownloaded++
        }
      }
      
      if (mediaDownloaded > 0) {
        console.log(`  ✓ Downloaded media for ${mediaDownloaded} games`)
      }
    }
  }
  
  return { processed, added, updated, skipped, mediaDownloaded, skippedExamples }
}

/**
 * Main titledb sync function - syncs all sources
 */
export async function syncTitleDB() {
  try {
    console.log('=== Starting TitleDB multi-source synchronization ===')
    console.log(`Syncing ${TITLEDB_SOURCES.length} sources...`)
    const overallStart = Date.now()
    
    let totalProcessed = 0
    let totalAdded = 0
    let totalUpdated = 0
    let totalSkipped = 0
    let totalMediaDownloaded = 0
    const allSkippedExamples = []
    
    // Group sources by language for better logging
    const sourcesByLang = {}
    TITLEDB_SOURCES.forEach(source => {
      if (!sourcesByLang[source.lang]) {
        sourcesByLang[source.lang] = []
      }
      sourcesByLang[source.lang].push(source)
    })
    
    // Process each source
    for (const source of TITLEDB_SOURCES) {
      console.log(`\n--- Syncing ${source.region}.${source.lang} ---`)
      
      const titledb = await downloadTitleDB(source)
      
      if (!titledb) {
        console.log(`⚠ Skipping ${source.region}.${source.lang} (download failed)`)
        continue
      }
      
      console.log('Processing entries...')
      const result = await processTitleDBInBatches(titledb, source.lang)
      
      totalProcessed += result.processed
      totalAdded += result.added
      totalUpdated += result.updated
      totalSkipped += result.skipped
      totalMediaDownloaded += result.mediaDownloaded || 0
      
      if (result.skippedExamples && result.skippedExamples.length > 0 && allSkippedExamples.length < 10) {
        allSkippedExamples.push(...result.skippedExamples.slice(0, 10 - allSkippedExamples.length))
      }
      
      console.log(`✓ ${source.region}.${source.lang}: ${result.processed} games (${result.added} new, ${result.updated} updated)`)
    }
    
    const totalDuration = ((Date.now() - overallStart) / 1000).toFixed(2)
    
    console.log('\n=== TitleDB Synchronization Summary ===')
    console.log(`Total processed: ${totalProcessed} games`)
    console.log(`  - New: ${totalAdded}`)
    console.log(`  - Updated: ${totalUpdated}`)
    console.log(`  - Skipped: ${totalSkipped}`)
    console.log(`  - Media downloaded: ${totalMediaDownloaded} games`)
    
    if (allSkippedExamples.length > 0) {
      console.log('Skipped examples:')
      allSkippedExamples.forEach(example => console.log(`  - ${example}`))
    }
    
    console.log(`Completed in ${totalDuration}s`)
    console.log('=======================================')
    
    // Log sync
    const logStmt = db.prepare(`
      INSERT INTO sync_log (games_count, status, source) VALUES (?, ?, ?)
    `)
    logStmt.run(totalProcessed, 'success', 'titledb-multi')
    
    return {
      success: true,
      processed: totalProcessed,
      added: totalAdded,
      updated: totalUpdated,
      skipped: totalSkipped,
      mediaDownloaded: totalMediaDownloaded,
      skippedExamples: allSkippedExamples,
      duration: Date.now() - overallStart
    }
  } catch (error) {
    console.error('TitleDB synchronization error:', error)
    
    // Log failed sync
    const logStmt = db.prepare(`
      INSERT INTO sync_log (games_count, status, source) VALUES (?, ?, ?)
    `)
    logStmt.run(0, 'failed', 'titledb-multi')
    
    return {
      success: false,
      error: error.message
    }
  }
}

