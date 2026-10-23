import { createHash } from 'crypto'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  statSync
} from 'fs'
import { readFile } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { execFile } from 'child_process'
import { promisify } from 'util'
import db from '../database/init.js'
import { parseCtrSourcePath, isValidCtrCategory } from './ctrCategories.js'
import { normalizeCtrRegion } from './ctrRegion.js'
import {
  hasCtrLocalIcon,
  syncCtrMediaFromLocal
} from './ctrMediaDownloader.js'

const execFileAsync = promisify(execFile)

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const REPO_URL = process.env.CTR_3DSDB_REPO || 'https://github.com/ghost-land/3dsdb.git'
const BRANCH = process.env.CTR_3DSDB_BRANCH || 'main'
const MIRROR_DIR = process.env.CTR_3DSDB_DIR
  || join(__dirname, '..', '..', 'data', '3dsdb')
const SYNC_STATE_PATH = process.env.CTR_SYNC_STATE_PATH
  || join(__dirname, '..', '..', 'data', 'ctr-mirror-sync.json')

/** Keep sync gentle so the HTTP API stays responsive. */
const CONCURRENCY = Math.max(1, Number(process.env.CTR_META_CONCURRENCY || 2))
const MEDIA_CONCURRENCY = Math.max(1, Number(process.env.CTR_MEDIA_CONCURRENCY || 1))
const MEDIA_YIELD_MS = Math.max(0, Number(process.env.CTR_MEDIA_YIELD_MS || 40))

/**
 * @returns {{ commit: string|null, syncedAt: string|null }}
 */
function readSyncState() {
  try {
    if (!existsSync(SYNC_STATE_PATH)) return { commit: null, syncedAt: null }
    const raw = JSON.parse(readFileSync(SYNC_STATE_PATH, 'utf8'))
    return {
      commit: typeof raw.commit === 'string' ? raw.commit : null,
      syncedAt: typeof raw.syncedAt === 'string' ? raw.syncedAt : null
    }
  } catch {
    return { commit: null, syncedAt: null }
  }
}

/**
 * Persist last successfully applied mirror commit (used by scheduled syncs).
 * @param {string} commit
 */
function writeSyncState(commit) {
  mkdirSync(dirname(SYNC_STATE_PATH), { recursive: true })
  writeFileSync(
    SYNC_STATE_PATH,
    JSON.stringify(
      {
        commit,
        syncedAt: new Date().toISOString(),
        repo: REPO_URL,
        branch: BRANCH
      },
      null,
      2
    ),
    'utf8'
  )
}

/**
 * Git blob SHA1 — matches GitHub blob shas for change detection.
 * @param {Buffer} content
 * @returns {string}
 */
function gitBlobSha(content) {
  return createHash('sha1')
    .update(`blob ${content.length}\0`)
    .update(content)
    .digest('hex')
}

/**
 * @param {string[]} args
 * @param {string} [cwd]
 */
async function git(args, cwd = MIRROR_DIR) {
  const { stdout } = await execFileAsync('git', args, {
    cwd,
    maxBuffer: 64 * 1024 * 1024,
    env: {
      ...process.env,
      GIT_TERMINAL_PROMPT: '0'
    }
  })
  return String(stdout || '').trim()
}

/**
 * Clone or update the full 3dsdb mirror on disk (~1.2GB first time).
 * Subsequent runs are incremental `git fetch` + hard reset to origin/branch.
 * @returns {Promise<{ path: string, commit: string, updated: boolean }>}
 */
async function ensure3dsdbMirror() {
  mkdirSync(dirname(MIRROR_DIR), { recursive: true })

  const gitDir = join(MIRROR_DIR, '.git')
  let updated = false

  if (!existsSync(gitDir)) {
    console.log(`  → Cloning ${REPO_URL} (branch ${BRANCH}) into ${MIRROR_DIR}`)
    console.log('    First clone may take several minutes (~1GB+)…')
    mkdirSync(MIRROR_DIR, { recursive: true })
    // Shallow clone keeps disk/time reasonable; full history is not needed for sync
    await execFileAsync(
      'git',
      [
        'clone',
        '--depth', '1',
        '--branch', BRANCH,
        '--single-branch',
        REPO_URL,
        MIRROR_DIR
      ],
      {
        maxBuffer: 64 * 1024 * 1024,
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0' }
      }
    )
    updated = true
  } else {
    console.log(`  → Updating mirror at ${MIRROR_DIR}`)
    const before = await git(['rev-parse', 'HEAD'])
    await git(['remote', 'set-url', 'origin', REPO_URL])
    await git(['fetch', '--depth', '1', 'origin', BRANCH])
    await git(['checkout', '-f', BRANCH])
    await git(['reset', '--hard', `origin/${BRANCH}`])
    // Drop unreachable blobs from previous shallow tips (optional best-effort)
    try {
      await git(['gc', '--prune=now'])
    } catch {
      // ignore gc failures
    }
    const after = await git(['rev-parse', 'HEAD'])
    updated = before !== after
    console.log(
      updated
        ? `  ✓ Mirror updated ${before.slice(0, 7)} → ${after.slice(0, 7)}`
        : `  ✓ Mirror already at ${after.slice(0, 7)}`
    )
  }

  const commit = await git(['rev-parse', 'HEAD'])
  return { path: MIRROR_DIR, commit, updated }
}

/** Yield to the event loop so HTTP requests can be served during long syncs. */
function yieldEventLoop(ms = 0) {
  return new Promise((resolve) => {
    if (ms > 0) setTimeout(resolve, ms)
    else setImmediate(resolve)
  })
}

/**
 * @template T,R
 * @param {T[]} items
 * @param {number} limit
 * @param {(item: T, index: number) => Promise<R>} worker
 * @param {{ yieldMs?: number }} [options]
 */
async function mapPool(items, limit, worker, options = {}) {
  const results = new Array(items.length)
  let next = 0
  const yieldMs = options.yieldMs ?? 0

  async function run() {
    while (next < items.length) {
      const i = next++
      results[i] = await worker(items[i], i)
      if (yieldMs > 0) await yieldEventLoop(yieldMs)
      else await yieldEventLoop(0)
    }
  }

  const runners = Array.from({ length: Math.min(limit, items.length) }, () => run())
  await Promise.all(runners)
  return results
}

/**
 * Walk db/3ds on the local mirror and collect every title with meta.json.
 * Media paths are resolved lazily during the media phase (keeps scan light).
 * @param {string} mirrorPath
 * @returns {Promise<Array<{ tid: string, category: string, path: string, absoluteMeta: string, sha: string, titleDir: string }>>}
 */
async function scanMirrorTitles(mirrorPath) {
  const dbRoot = join(mirrorPath, 'db', '3ds')
  if (!existsSync(dbRoot)) {
    throw new Error(`3dsdb mirror missing db/3ds at ${dbRoot}`)
  }

  /** @type {Array<object>} */
  const titles = []
  let scannedDirs = 0

  /**
   * @param {string} categoryRel - e.g. base | extras/hb
   * @param {string} categoryAbs
   */
  async function scanCategory(categoryRel, categoryAbs) {
    if (!isValidCtrCategory(categoryRel)) return
    if (!existsSync(categoryAbs) || !statSync(categoryAbs).isDirectory()) return

    let tidDirs
    try {
      tidDirs = readdirSync(categoryAbs, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of tidDirs) {
      if (!entry.isDirectory()) continue
      const tid = entry.name.toUpperCase()
      if (!/^[0-9A-F]{16}$/.test(tid)) continue

      const titleDir = join(categoryAbs, entry.name)
      const metaPath = join(titleDir, 'meta.json')
      if (!existsSync(metaPath)) continue

      const repoPath = `db/3ds/${categoryRel}/${tid}/meta.json`.replace(/\\/g, '/')
      const parsed = parseCtrSourcePath(repoPath)
      if (!parsed) continue

      let content
      try {
        content = readFileSync(metaPath)
      } catch {
        continue
      }

      titles.push({
        tid: parsed.tid,
        category: parsed.category,
        path: repoPath,
        absoluteMeta: metaPath,
        sha: gitBlobSha(content),
        titleDir
      })

      scannedDirs++
      // Periodically yield during large category walks (e.g. base ~4k)
      if (scannedDirs % 200 === 0) await yieldEventLoop(0)
    }
  }

  for (const entry of readdirSync(dbRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue

    if (entry.name === 'extras') {
      const extrasRoot = join(dbRoot, 'extras')
      for (const sub of readdirSync(extrasRoot, { withFileTypes: true })) {
        if (!sub.isDirectory()) continue
        await scanCategory(`extras/${sub.name}`, join(extrasRoot, sub.name))
      }
      continue
    }

    await scanCategory(entry.name, join(dbRoot, entry.name))
  }

  return titles
}

/**
 * Insert bare TIDs from local tid_list.json.
 * @param {string} mirrorPath
 */
async function syncTidInventory(mirrorPath) {
  const tidListPath = join(mirrorPath, 'data', 'tid_list.json')
  if (!existsSync(tidListPath)) {
    console.log('  ⚠ tid_list.json missing in mirror — skipping inventory')
    return { inserted: 0, total: 0 }
  }

  console.log('  → Reading tid_list.json from mirror…')
  const tidList = JSON.parse(readFileSync(tidListPath, 'utf8'))

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
 * @returns {Promise<Map<string, { source_hash: string|null, category: string|null, name: string|null, incomplete: boolean }>>}
 */
async function loadExistingState() {
  const rows = await db.prepare(`
    SELECT tid, source_hash, category, name FROM ctr
  `).all()
  const map = new Map()
  for (const row of rows) {
    map.set(row.tid.toUpperCase(), {
      source_hash: row.source_hash || null,
      category: row.category || null,
      name: row.name || null,
      incomplete: !row.name || !row.source_hash
    })
  }
  return map
}

/**
 * @param {object} meta
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
 * @param {Array<object>} pending
 */
async function processMetaUpdates(pending) {
  let added = 0
  let updated = 0
  let failed = 0
  const existing = await loadExistingState()
  const upsert = db.prepare(UPSERT_SQL)

  await mapPool(pending, CONCURRENCY, async (entry, index) => {
    const progress = `[${index + 1}/${pending.length}]`
    try {
      const raw = await readFile(entry.absoluteMeta, 'utf8')
      const meta = JSON.parse(raw)
      if (!meta?.tid) {
        failed++
        return
      }
      await upsert.run(
        ...prepareUpsertValues(meta, entry.category, entry.sha, entry.path)
      )
      if (!existing.get(entry.tid)) added++
      else updated++

      if ((index + 1) % 100 === 0 || index + 1 === pending.length) {
        console.log(`  ${progress} synced (${entry.tid})`)
      }
    } catch (error) {
      console.error(`  ${progress} ✗ ${entry.tid}: ${error.message}`)
      failed++
    }
  }, { yieldMs: 5 })

  return { added, updated, failed }
}

/**
 * Copy missing media from mirror → media/ctr for selected titles (low concurrency).
 * @param {Array<object>} titles
 */
async function syncMissingMedia(titles) {
  let completed = 0
  const results = await mapPool(
    titles,
    MEDIA_CONCURRENCY,
    async (title) => {
      const result = await syncCtrMediaFromLocal(
        title.tid,
        title.category,
        null,
        title.titleDir
      )
      completed++
      if (completed % 100 === 0 || completed === titles.length) {
        console.log(`  [${completed}/${titles.length}] media titles checked`)
      }
      return result
    },
    { yieldMs: MEDIA_YIELD_MS }
  )

  return results.reduce(
    (totals, result) => {
      if (!result) return totals
      totals.downloaded += result.downloaded
      totals.present += result.present
      totals.failed += result.failed
      if (result.downloaded > 0) totals.titlesWithDownloads++
      return totals
    },
    { titlesWithDownloads: 0, downloaded: 0, present: 0, failed: 0 }
  )
}

/**
 * Whether local DB row needs a meta upsert vs mirror file.
 * @param {object} title
 * @param {Map<string, object>} existing
 */
function needsMetaUpsert(title, existing) {
  const prev = existing.get(title.tid)
  if (!prev) return { pending: true, reason: 'new' }
  if (prev.incomplete || !prev.name) return { pending: true, reason: 'incomplete' }
  if (prev.source_hash !== title.sha) return { pending: true, reason: 'changed' }
  if (prev.category && prev.category !== title.category) {
    return { pending: true, reason: 'category-move' }
  }
  return { pending: false, reason: 'unchanged' }
}

/**
 * Build a gentle media worklist:
 * - always: titles with pending meta
 * - plus titles still missing a local icon (gap fill), without blasting all 8k every time
 * - CTR_FORCE_MEDIA=1 → all titles (still low concurrency / yields)
 * @param {Array<object>} scanned
 * @param {Array<object>} pending
 */
async function selectMediaTargets(scanned, pending) {
  if (process.env.CTR_FORCE_MEDIA === '1') {
    return { targets: scanned, mode: 'force-all' }
  }

  const byTid = new Map(pending.map((t) => [t.tid, t]))
  let checked = 0

  for (const title of scanned) {
    if (byTid.has(title.tid)) continue
    checked++
    if (checked % 100 === 0) await yieldEventLoop(0)
    const hasIcon = await hasCtrLocalIcon(title.tid, title.category)
    if (!hasIcon) byTid.set(title.tid, title)
  }

  return {
    targets: [...byTid.values()],
    mode: 'pending+missing-icon'
  }
}

/**
 * Synchronize CTR from a local git mirror of ghost-land/3dsdb.
 * No GitHub API rate limits — clone/pull then diff filesystem vs DB.
 *
 * @param {{ mode?: 'startup' | 'scheduled' }} [options]
 * - startup: always scan/repair (fill gaps after reboot)
 * - scheduled: if mirror commit unchanged since last success → no-op
 */
export async function syncCtrFrom3dsdb(options = {}) {
  const mode = options.mode === 'startup' ? 'startup' : 'scheduled'
  const overallStart = Date.now()
  console.log(`=== Starting CTR synchronization (local 3dsdb mirror, mode=${mode}) ===`)

  try {
    console.log('\n[1/4] Updating 3dsdb git mirror')
    const mirror = await ensure3dsdbMirror()
    const lastState = readSyncState()

    // Cron / 12h jobs: nothing to do when upstream HEAD matches last successful sync
    if (
      mode === 'scheduled' &&
      lastState.commit &&
      lastState.commit === mirror.commit
    ) {
      const duration = Date.now() - overallStart
      console.log(
        `  ✓ Mirror already synced at ${mirror.commit.slice(0, 7)}` +
          (lastState.syncedAt ? ` (last success ${lastState.syncedAt})` : '')
      )
      console.log('  ✓ Skipping inventory / scan / media (no new commits)')
      console.log('=========================================')
      return {
        success: true,
        skipped: true,
        reason: 'mirror-unchanged',
        mirrorCommit: mirror.commit,
        mirrorUpdated: mirror.updated,
        duration
      }
    }

    if (mode === 'scheduled' && mirror.updated) {
      console.log('  → New upstream commits detected — full sync')
    } else if (mode === 'startup') {
      console.log('  → Startup mode — scan + repair even if commit unchanged')
    } else if (!lastState.commit) {
      console.log('  → No previous sync state — full sync')
    }

    console.log('\n[2/4] TID inventory')
    const inventory = await syncTidInventory(mirror.path)

    console.log('\n[3/4] Scanning mirror + diff vs database')
    console.log(
      `  → Pace: meta×${CONCURRENCY}, media×${MEDIA_CONCURRENCY}, yield ${MEDIA_YIELD_MS}ms`
    )
    const scanned = await scanMirrorTitles(mirror.path)
    const existing = await loadExistingState()

    const pending = []
    let unchanged = 0
    const reasons = {}

    for (const title of scanned) {
      const decision = needsMetaUpsert(title, existing)
      reasons[decision.reason] = (reasons[decision.reason] || 0) + 1
      if (decision.pending) pending.push(title)
      else unchanged++
    }

    console.log(`  → Titles with meta.json: ${scanned.length}`)
    console.log(`  → Pending meta upserts: ${pending.length}`)
    console.log(`  → Unchanged: ${unchanged}`)
    console.log(
      `  → Reasons: ${Object.entries(reasons).map(([k, v]) => `${k}=${v}`).join(', ')}`
    )

    let applyStats = { added: 0, updated: 0, failed: 0 }
    if (pending.length === 0) {
      console.log('  ✓ Metadata already up to date')
    } else {
      console.log('\n[3b/4] Applying metadata updates')
      applyStats = await processMetaUpdates(pending)
    }

    console.log('\n[4/4] Syncing media from mirror → media/ctr (gentle)')
    let mediaStats = {
      titlesWithDownloads: 0,
      downloaded: 0,
      present: 0,
      failed: 0
    }

    const { targets: mediaTargets, mode: mediaMode } = await selectMediaTargets(
      scanned,
      pending
    )

    if (mediaTargets.length === 0) {
      console.log('  ✓ Skipped (nothing to check)')
    } else {
      console.log(
        `  → Checking media for ${mediaTargets.length} titles (${mediaMode})`
      )
      mediaStats = await syncMissingMedia(mediaTargets)
      console.log(
        `  ✓ Media: ↓${mediaStats.downloaded} copied, ${mediaStats.present} already local, ` +
          `${mediaStats.failed} missing in mirror`
      )
    }

    const duration = Date.now() - overallStart
    const processed = applyStats.added + applyStats.updated

    await db.prepare(`
      INSERT INTO sync_log (games_count, status, source) VALUES ($1, $2, $3)
    `).run(processed, 'success', '3dsdb-mirror')

    writeSyncState(mirror.commit)

    console.log('\n=== CTR Synchronization Summary ===')
    console.log(`Mirror commit: ${mirror.commit}`)
    console.log(`Inventory new TIDs: ${inventory.inserted}`)
    console.log(`Metas scanned: ${scanned.length}`)
    console.log(`  - Applied: ${processed} (new ≈ ${applyStats.added}, updates ≈ ${applyStats.updated})`)
    console.log(`  - Failed: ${applyStats.failed}`)
    console.log(`  - Unchanged: ${unchanged}`)
    console.log(`Media copied: ${mediaStats.downloaded}`)
    console.log(`Duration: ${(duration / 1000).toFixed(2)}s`)
    console.log('=========================================')

    return {
      success: true,
      skipped: false,
      mirrorCommit: mirror.commit,
      mirrorUpdated: mirror.updated,
      mirrorPath: mirror.path,
      inventoryInserted: inventory.inserted,
      scanned: scanned.length,
      pending: pending.length,
      added: applyStats.added,
      updated: applyStats.updated,
      failed: applyStats.failed,
      unchanged,
      mediaDownloaded: mediaStats.downloaded,
      mediaTouched: mediaStats.titlesWithDownloads,
      duration
    }
  } catch (error) {
    console.error('CTR synchronization error:', error)

    try {
      await db.prepare(`
        INSERT INTO sync_log (games_count, status, source) VALUES ($1, $2, $3)
      `).run(0, 'failed', '3dsdb-mirror')
    } catch {
      // ignore
    }

    return { success: false, error: error.message }
  }
}
