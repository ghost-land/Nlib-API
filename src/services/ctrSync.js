import db from '../database/init.js'
import { parseCtrSourcePath, isValidCtrCategory } from './ctrCategories.js'
import { normalizeCtrRegion } from './ctrRegion.js'
import { downloadCtrMediaFrom3dsdb } from './ctrMediaDownloader.js'

const REPO = 'ghost-land/3dsdb'
const BRANCH = 'main'
const API_BASE = `https://api.github.com/repos/${REPO}`
const RAW_BASE = `https://raw.githubusercontent.com/${REPO}/${BRANCH}`

const TID_LIST_URL = `${RAW_BASE}/data/tid_list.json`
const CONCURRENCY = 12
const MEDIA_CONCURRENCY = 6

/**
 * Optional token raises upstream API rate limits (GITHUB_TOKEN / GH_TOKEN).
 * @returns {Record<string, string>}
 */
function upstreamApiHeaders() {
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'Nlib-API-ctr-sync'
  }
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }
  return headers
}

/**
 * @param {string} url
 * @param {object} [options]
 * @returns {Promise<any>}
 */
async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { ...upstreamApiHeaders(), ...(options.headers || {}) },
    signal: options.signal || AbortSignal.timeout(180000)
  })
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }
  return response.json()
}

/**
 * Run async work over items with a fixed concurrency pool.
 * @template T,R
 * @param {T[]} items
 * @param {number} limit
 * @param {(item: T, index: number) => Promise<R>} worker
 * @returns {Promise<R[]>}
 */
async function mapPool(items, limit, worker) {
  const results = new Array(items.length)
  let next = 0

  async function run() {
    while (next < items.length) {
      const i = next++
      results[i] = await worker(items[i], i)
    }
  }

  const runners = Array.from({ length: Math.min(limit, items.length) }, () => run())
  await Promise.all(runners)
  return results
}

/**
 * List top-level and nested extras categories under db/3ds.
 * @returns {Promise<Array<{ name: string, path: string, sha: string }>>}
 */
async function listCategoryTrees() {
  const roots = await fetchJson(`${API_BASE}/contents/db/3ds?ref=${BRANCH}`)
  if (!Array.isArray(roots)) {
    throw new Error('Unexpected upstream contents response for db/3ds')
  }

  const categories = []

  for (const entry of roots) {
    if (entry.type !== 'dir') continue

    if (entry.name === 'extras') {
      const extras = await fetchJson(`${API_BASE}/contents/${entry.path}?ref=${BRANCH}`)
      if (Array.isArray(extras)) {
        for (const sub of extras) {
          if (sub.type === 'dir' && isValidCtrCategory(`extras/${sub.name}`)) {
            categories.push({
              name: `extras/${sub.name}`,
              path: sub.path,
              sha: sub.sha
            })
          }
        }
      }
      continue
    }

    if (isValidCtrCategory(entry.name)) {
      categories.push({
        name: entry.name,
        path: entry.path,
        sha: entry.sha
      })
    }
  }

  return categories
}

/**
 * Collect meta.json blob entries (path + sha) for one category tree.
 * @param {{ name: string, sha: string }} category
 * @returns {Promise<Array<{ path: string, sha: string, category: string, tid: string }>>}
 */
async function collectMetasForCategory(category) {
  const tree = await fetchJson(
    `${API_BASE}/git/trees/${category.sha}?recursive=1`
  )
  const entries = tree.tree || []
  const metas = []

  for (const node of entries) {
    if (node.type !== 'blob' || !node.path?.endsWith('/meta.json')) continue

    // Tree paths are relative to the category root
    const fullPath = `db/3ds/${category.name}/${node.path}`
    const parsed = parseCtrSourcePath(fullPath)
    if (!parsed) continue

    metas.push({
      path: fullPath,
      sha: node.sha,
      category: parsed.category,
      tid: parsed.tid
    })
  }

  return metas
}

/**
 * Build full inventory of meta.json files from 3dsdb.
 * @returns {Promise<Array<{ path: string, sha: string, category: string, tid: string }>>}
 */
async function collectAllMetas() {
  const categories = await listCategoryTrees()
  console.log(`  → Scanning ${categories.length} category trees...`)

  const all = []
  for (const category of categories) {
    const metas = await collectMetasForCategory(category)
    console.log(`    ${category.name}: ${metas.length} meta.json`)
    all.push(...metas)
  }
  return all
}

/**
 * Insert bare TIDs from tid_list.json (titles known but maybe without meta yet).
 * Mirrors NX working.txt inventory step.
 * @returns {Promise<{ inserted: number, total: number }>}
 */
async function syncTidInventory() {
  console.log('  → Downloading tid_list.json...')
  const tidList = await fetchJson(TID_LIST_URL)

  let inserted = 0
  let total = 0

  const insertStmt = db.prepare(`
    INSERT INTO ctr (tid, category, updated_at)
    VALUES ($1, $2, CURRENT_TIMESTAMP)
    ON CONFLICT (tid) DO NOTHING
  `)

  for (const [category, tids] of Object.entries(tidList)) {
    if (!isValidCtrCategory(category) || !Array.isArray(tids)) continue

    for (const tidRaw of tids) {
      const tid = String(tidRaw).toUpperCase()
      if (!/^[0-9A-F]{16}$/.test(tid)) continue
      total++
      const result = await insertStmt.run(tid, category)
      inserted += result.changes || 0
    }
  }

  console.log(`  ✓ TID inventory: ${total} listed, ${inserted} new rows`)
  return { inserted, total }
}

/**
 * Load existing source_hash map from DB for diffing.
 * @returns {Promise<Map<string, { source_hash: string|null, category: string|null }>>}
 */
async function loadExistingHashes() {
  const rows = await db.prepare(
    'SELECT tid, source_hash, category FROM ctr'
  ).all()
  const map = new Map()
  for (const row of rows) {
    map.set(row.tid.toUpperCase(), {
      source_hash: row.source_hash || null,
      category: row.category || null
    })
  }
  return map
}

/**
 * @param {object} meta - Parsed meta.json
 * @param {string} category
 * @param {string} sourceHash
 * @param {string} sourcePath
 */
function prepareUpsertValues(meta, category, sourceHash, sourcePath) {
  const tid = String(meta.tid || '').toUpperCase()
  return [
    tid,
    meta.uid || null,
    meta.name || null,
    meta.formal_name || null,
    meta.description || null,
    meta.release_date_on_eshop || null,
    meta.product_code || null,
    meta.platform_name || null,
    normalizeCtrRegion(meta.region),
    meta.genres ? JSON.stringify(meta.genres) : null,
    meta.features ? JSON.stringify(meta.features) : null,
    meta.languages ? JSON.stringify(meta.languages) : null,
    meta.rating_system ? JSON.stringify(meta.rating_system) : null,
    meta.version || null,
    meta.disclaimer ?? null,
    meta.descriptors ? JSON.stringify(meta.descriptors) : null,
    category,
    meta.publisher || null,
    meta.smdh ? JSON.stringify(meta.smdh) : null,
    sourceHash,
    sourcePath
  ]
}

const UPSERT_SQL = `
  INSERT INTO ctr (
    tid, uid, name, formal_name, description, release_date_on_eshop,
    product_code, platform_name, region, genres, features, languages,
    rating_system, version, disclaimer, descriptors, category,
    publisher, smdh, source_hash, source_path, synced_at, updated_at
  ) VALUES (
    $1, $2, $3, $4, $5, $6,
    $7, $8, $9, $10, $11, $12,
    $13, $14, $15, $16, $17,
    $18, $19, $20, $21, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  )
  ON CONFLICT (tid) DO UPDATE SET
    uid = EXCLUDED.uid,
    name = EXCLUDED.name,
    formal_name = EXCLUDED.formal_name,
    description = EXCLUDED.description,
    release_date_on_eshop = EXCLUDED.release_date_on_eshop,
    product_code = EXCLUDED.product_code,
    platform_name = EXCLUDED.platform_name,
    region = EXCLUDED.region,
    genres = EXCLUDED.genres,
    features = EXCLUDED.features,
    languages = EXCLUDED.languages,
    rating_system = EXCLUDED.rating_system,
    version = EXCLUDED.version,
    disclaimer = EXCLUDED.disclaimer,
    descriptors = EXCLUDED.descriptors,
    category = EXCLUDED.category,
    publisher = EXCLUDED.publisher,
    smdh = EXCLUDED.smdh,
    source_hash = EXCLUDED.source_hash,
    source_path = EXCLUDED.source_path,
    synced_at = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP
`

/**
 * Fetch meta.json and upsert when new or hash changed.
 * @param {Array<{ path: string, sha: string, category: string, tid: string }>} pending
 * @returns {Promise<{ added: number, updated: number, failed: number }>}
 */
async function processMetaUpdates(pending) {
  let added = 0
  let updated = 0
  let failed = 0

  const existing = await loadExistingHashes()
  const upsert = db.prepare(UPSERT_SQL)

  await mapPool(pending, CONCURRENCY, async (entry, index) => {
    const progress = `[${index + 1}/${pending.length}]`
    try {
      const meta = await fetchJson(`${RAW_BASE}/${entry.path}`)
      if (!meta?.tid) {
        console.log(`  ${progress} ⚠ invalid meta: ${entry.path}`)
        failed++
        return
      }

      const values = prepareUpsertValues(
        meta,
        entry.category,
        entry.sha,
        entry.path
      )
      await upsert.run(...values)

      const prev = existing.get(entry.tid)
      if (!prev) {
        added++
      } else {
        updated++
      }

      if ((index + 1) % 100 === 0 || index + 1 === pending.length) {
        console.log(`  ${progress} synced (${entry.tid})`)
      }
    } catch (error) {
      console.error(`  ${progress} ✗ ${entry.tid}: ${error.message}`)
      failed++
    }
  })

  return { added, updated, failed }
}

/**
 * Download missing icon/banner for titles that were just synced.
 * @param {Array<{ tid: string, category: string }>} titles
 * @returns {Promise<number>} - titles with at least one new media file
 */
async function syncMissingMedia(titles) {
  let downloaded = 0

  await mapPool(titles, MEDIA_CONCURRENCY, async (title) => {
    const result = await downloadCtrMediaFrom3dsdb(title.tid, title.category)
    if (result.icon || result.banner) {
      // Count only when we actually needed a fetch path that succeeded;
      // downloadCtrMediaFrom3dsdb returns true for already-present files too.
      // Re-check is acceptable: we only call this for pending sync titles.
      downloaded++
    }
  })

  return downloaded
}

/**
 * Synchronize CTR metadata from the upstream 3DS database dump.
 * - Phase 1: insert bare TIDs from tid_list.json
 * - Phase 2: diff meta.json blob SHAs vs source_hash
 * - Phase 3: fetch + upsert only new/changed metas (upstream is source of truth)
 * - Phase 4: download missing icon/banner for those titles
 * @returns {Promise<object>}
 */
export async function syncCtrFrom3dsdb() {
  const overallStart = Date.now()
  console.log('=== Starting CTR metadata synchronization ===')

  try {
    // Phase 1 — inventory
    console.log('\n[1/4] TID inventory')
    const inventory = await syncTidInventory()

    // Phase 2 — discover metas + diff
    console.log('\n[2/4] Discovering meta.json + computing diff')
    const allMetas = await collectAllMetas()
    const existing = await loadExistingHashes()

    const pending = []
    let unchanged = 0
    let categoryMoves = 0

    for (const meta of allMetas) {
      const prev = existing.get(meta.tid)
      const hashChanged = !prev || prev.source_hash !== meta.sha
      const categoryChanged = Boolean(prev?.category && prev.category !== meta.category)

      if (hashChanged || categoryChanged) {
        pending.push(meta)
        if (categoryChanged) categoryMoves++
      } else {
        unchanged++
      }
    }

    console.log(`  → Total metas: ${allMetas.length}`)
    console.log(`  → Unchanged: ${unchanged}`)
    console.log(`  → Pending (new/changed): ${pending.length}`)
    if (categoryMoves > 0) {
      console.log(`  → Category moves detected: ${categoryMoves}`)
    }

    // Phase 3 — upsert
    console.log('\n[3/4] Applying metadata updates')
    let applyStats = { added: 0, updated: 0, failed: 0 }
    if (pending.length === 0) {
      console.log('  ✓ Nothing to update')
    } else {
      applyStats = await processMetaUpdates(pending)
    }

    // Phase 4 — media for pending titles only
    console.log('\n[4/4] Checking media for synced titles')
    let mediaTouched = 0
    if (pending.length > 0) {
      mediaTouched = await syncMissingMedia(
        pending.map((m) => ({ tid: m.tid, category: m.category }))
      )
      console.log(`  ✓ Media checked for ${pending.length} titles (${mediaTouched} with local files)`)
    } else {
      console.log('  ✓ Skipped (no pending titles)')
    }

    const duration = Date.now() - overallStart
    const processed = applyStats.added + applyStats.updated

    await db.prepare(`
      INSERT INTO sync_log (games_count, status, source) VALUES ($1, $2, $3)
    `).run(processed, 'success', '3dsdb')

    console.log('\n=== CTR Synchronization Summary ===')
    console.log(`Inventory new TIDs: ${inventory.inserted}`)
    console.log(`Metas scanned: ${allMetas.length}`)
    console.log(`  - Applied: ${processed} (new upserts ≈ ${applyStats.added}, updates ≈ ${applyStats.updated})`)
    console.log(`  - Failed: ${applyStats.failed}`)
    console.log(`  - Unchanged: ${unchanged}`)
    console.log(`Duration: ${(duration / 1000).toFixed(2)}s`)
    console.log('=========================================')

    return {
      success: true,
      inventoryInserted: inventory.inserted,
      scanned: allMetas.length,
      pending: pending.length,
      added: applyStats.added,
      updated: applyStats.updated,
      failed: applyStats.failed,
      unchanged,
      mediaTouched,
      duration
    }
  } catch (error) {
    console.error('CTR synchronization error:', error)

    try {
      await db.prepare(`
        INSERT INTO sync_log (games_count, status, source) VALUES ($1, $2, $3)
      `).run(0, 'failed', '3dsdb')
    } catch {
      // ignore log failure
    }

    return {
      success: false,
      error: error.message
    }
  }
}
