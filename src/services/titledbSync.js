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
 * Convert YYYYMMDD to YYYY-MM-DD format
 * @param {number|string} dateNum - Date in YYYYMMDD format
 * @returns {string|null} - ISO date string or null
 */
function formatReleaseDate(dateNum) {
  if (!dateNum) return null
  
  const dateStr = dateNum.toString()
  if (dateStr.length !== 8) return null
  
  return `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`
}

/**
 * Validate Title ID format for base games
 * @param {string} tid - Title ID to validate
 * @returns {boolean} - True if valid base game TID
 */
function isValidBaseTID(tid) {
  return tid?.length === 16 && tid.startsWith('01') && tid.endsWith('000')
}

/**
 * Fetch and parse TitleDB JSON for specified region/language
 * @param {Object} source - Source configuration {region, lang, priority}
 * @returns {Promise<Object|null>} - Parsed TitleDB data or null on error
 */
async function downloadTitleDB(source) {
  try {
    const url = `${TITLEDB_BASE_URL}/${source.region}.${source.lang}.json`
    console.log(`  → Downloading ${source.region}.${source.lang}...`)
    
    const startTime = Date.now()
    
    const response = await fetch(url, {
      signal: AbortSignal.timeout(180000) // 3 minutes timeout
    })
    
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`)
    }
    
    const contentLength = response.headers.get('content-length')
    const sizeMB = contentLength ? (parseInt(contentLength) / 1024 / 1024).toFixed(2) : 'unknown'
    
    const data = await response.json()
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2)
    console.log(`  ✓ Loaded ${source.region}.${source.lang} in ${duration}s (${Object.keys(data).length} entries, ${sizeMB} MB)`)
    
    return data
  } catch (error) {
    console.error(`  ✗ Error loading ${source.region}.${source.lang}:`, error.message)
    return null
  }
}

/**
 * Process TitleDB entries in batches with transactions
 * Updates only NULL fields - preserves existing data
 * Downloads missing media files from all sources
 * @param {Object} titledb - TitleDB JSON data
 * @param {string} lang - Language code (en, ja, es, de, fr, nl, pt, it, zh, ko, ru)
 * @returns {Promise<Object>} - Processing statistics
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
  const skippedExamples = []
  const MAX_EXAMPLES = 10
  
  // Prepare statements - only update NULL fields
  const checkStmt = db.prepare('SELECT tid FROM nx WHERE tid = $1')
  const insertGameStmt = db.prepare(`
    INSERT INTO nx (
      tid, name, publisher, developer, release_date, category, languages,
      nsu_id, number_of_players, rating_content, rights_id, region,
      is_demo, console, type, version, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, CURRENT_TIMESTAMP)
    ON CONFLICT(tid) DO UPDATE SET
      name = CASE WHEN nx.name IS NULL THEN EXCLUDED.name ELSE nx.name END,
      publisher = CASE WHEN nx.publisher IS NULL THEN EXCLUDED.publisher ELSE nx.publisher END,
      developer = CASE WHEN nx.developer IS NULL THEN EXCLUDED.developer ELSE nx.developer END,
      release_date = CASE WHEN nx.release_date IS NULL THEN EXCLUDED.release_date ELSE nx.release_date END,
      category = CASE WHEN nx.category IS NULL THEN EXCLUDED.category ELSE nx.category END,
      languages = CASE WHEN nx.languages IS NULL THEN EXCLUDED.languages ELSE nx.languages END,
      nsu_id = CASE WHEN nx.nsu_id IS NULL THEN EXCLUDED.nsu_id ELSE nx.nsu_id END,
      number_of_players = CASE WHEN nx.number_of_players IS NULL THEN EXCLUDED.number_of_players ELSE nx.number_of_players END,
      rating_content = CASE WHEN nx.rating_content IS NULL THEN EXCLUDED.rating_content ELSE nx.rating_content END,
      rights_id = CASE WHEN nx.rights_id IS NULL THEN EXCLUDED.rights_id ELSE nx.rights_id END,
      region = CASE WHEN nx.region IS NULL THEN EXCLUDED.region ELSE nx.region END,
      is_demo = CASE WHEN nx.is_demo IS NULL THEN EXCLUDED.is_demo ELSE nx.is_demo END,
      updated_at = CURRENT_TIMESTAMP
  `)
  
  // Dynamic description statement per language
  const insertDescStmt = db.prepare(`
    INSERT INTO nx_${lang} (tid, intro, description)
    VALUES ($1, $2, $3)
    ON CONFLICT(tid) DO UPDATE SET
      intro = CASE WHEN nx_${lang}.intro IS NULL THEN EXCLUDED.intro ELSE nx_${lang}.intro END,
      description = CASE WHEN nx_${lang}.description IS NULL THEN EXCLUDED.description ELSE nx_${lang}.description END
  `)
  
  console.log(`  → Processing ${totalEntries} entries in ${Math.ceil(totalEntries / BATCH_SIZE)} batches...`)
  
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE)
    const batchNum = Math.floor(i / BATCH_SIZE) + 1
    const totalBatches = Math.ceil(totalEntries / BATCH_SIZE)
    const percentage = ((i + batch.length) / totalEntries * 100).toFixed(1)
    
    console.log(`    Batch ${batchNum}/${totalBatches} (${percentage}%): processing ${batch.length} entries...`)
    
    const gamesForMedia = []
    const batchStartTime = Date.now()
    
    const processBatch = db.transaction(async () => {
      for (const [nsuId, gameData] of batch) {
        const tid = gameData.id
        
        if (!tid || !isValidBaseTID(tid)) {
          skipped++
          if (skippedExamples.length < MAX_EXAMPLES && tid && skipped % 1500 === 1) {
            const reason = !tid.startsWith('01') ? 'not-switch' :
                          tid.endsWith('800') ? 'update' :
                          !tid.endsWith('000') ? 'dlc' :
                          tid.length !== 16 ? 'invalid-format' : 'other'
            skippedExamples.push(`${tid} (${reason})`)
          }
          continue
        }
        
        const existingGame = await checkStmt.get(tid)
        
        if (existingGame) {
          updated++
        } else {
          added++
        }
        
        // Queue games with media URLs for download
        if (gameData.iconUrl || gameData.bannerUrl || (gameData.screenshots && gameData.screenshots.length > 0)) {
          gamesForMedia.push({ tid, gameData })
        }
        
        // Insert or update game metadata
        await insertGameStmt.run(
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
        
        // Insert or update localized description
        await insertDescStmt.run(
          tid,
          gameData.intro || null,
          gameData.description || null
        )
        
        processed++
      }
    })
    
    await processBatch()
    
    const batchDuration = ((Date.now() - batchStartTime) / 1000).toFixed(2)
    console.log(`    ✓ Batch ${batchNum} completed in ${batchDuration}s`)
    
    // Download missing media files
    if (gamesForMedia.length > 0) {
      console.log(`    → Checking media for ${gamesForMedia.length} games...`)
      
      let newMediaCount = 0
      for (const { tid, gameData } of gamesForMedia) {
        const result = await downloadGameMedia(tid, gameData)
        if (result.icon || result.banner || result.screenshots > 0) {
          newMediaCount++
        }
      }
      
      mediaDownloaded += newMediaCount
      
      if (newMediaCount > 0) {
        console.log(`    ✓ Media downloaded for ${newMediaCount} games from ${lang.toUpperCase()} source`)
      }
    }
  }
  
  console.log(`  ✓ Processing completed: ${processed} processed, ${added} new, ${updated} updated, ${skipped} skipped`)
  
  return { processed, added, updated, skipped, mediaDownloaded, skippedExamples }
}

/**
 * Synchronize game data from all TitleDB sources
 * Processes sources by priority, updates NULL fields only
 * Downloads missing media from all sources
 * @returns {Promise<Object>} - Sync results with statistics
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
    
    for (let idx = 0; idx < TITLEDB_SOURCES.length; idx++) {
      const source = TITLEDB_SOURCES[idx]
      console.log(`\n[${idx + 1}/${TITLEDB_SOURCES.length}] Syncing ${source.region}.${source.lang}`)
      
      const titledb = await downloadTitleDB(source)
      
      if (!titledb) {
        console.log(`  ⚠ Skipping ${source.region}.${source.lang} (download failed)`)
        continue
      }
      
      const result = await processTitleDBInBatches(titledb, source.lang)
      
      totalProcessed += result.processed
      totalAdded += result.added
      totalUpdated += result.updated
      totalSkipped += result.skipped
      totalMediaDownloaded += result.mediaDownloaded || 0
      
      if (result.skippedExamples && result.skippedExamples.length > 0 && allSkippedExamples.length < 10) {
        allSkippedExamples.push(...result.skippedExamples.slice(0, 10 - allSkippedExamples.length))
      }
      
      console.log(`  ✓ Completed ${source.region}.${source.lang}: ${result.processed} games (${result.added} new, ${result.updated} updated)`)
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
      INSERT INTO sync_log (games_count, status, source) VALUES ($1, $2, $3)
    `)
    await logStmt.run(totalProcessed, 'success', 'titledb-multi')
    
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
    
    const logStmt = db.prepare(`
      INSERT INTO sync_log (games_count, status, source) VALUES ($1, $2, $3)
    `)
    await logStmt.run(0, 'failed', 'titledb-multi')
    
    return {
      success: false,
      error: error.message
    }
  }
}

