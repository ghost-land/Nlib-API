import { createHash } from 'crypto'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import db from '../database/init.js'

const CATALOG_ROLES = new Set(['base', 'update', 'dlc', 'demo', 'extra'])

/**
 * Git blob SHA1 of a file buffer (matches 3dsdb change detection style).
 * @param {Buffer} content
 * @returns {string}
 */
export function gitBlobSha(content) {
  return createHash('sha1')
    .update(`blob ${content.length}\0`)
    .update(content)
    .digest('hex')
}

/**
 * @param {string|null|undefined} raw
 * @returns {any}
 */
function parseJsonField(raw) {
  if (raw == null || raw === '') return null
  if (typeof raw === 'object') return raw
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/**
 * Load a catalog title family by id (e.g. game/CTR:KPF).
 * @param {string} catalogId
 * @returns {Promise<object|null>}
 */
export async function getCtrCatalogTitle(catalogId) {
  if (!catalogId || typeof catalogId !== 'string') return null
  try {
    const row = await db.prepare('SELECT * FROM ctr_catalog WHERE id = $1').get(catalogId)
    if (!row) return null
    return shapeCatalogRow(row)
  } catch (error) {
    console.error(`Error reading ctr_catalog ${catalogId}:`, error.message)
    return null
  }
}

/**
 * @param {object} row
 * @returns {object}
 */
function shapeCatalogRow(row) {
  return {
    id: row.id,
    kind: row.kind,
    platform: row.platform,
    serial: row.serial,
    name: row.name,
    regions: parseJsonField(row.regions) || [],
    markets: parseJsonField(row.markets) || [],
    counts: parseJsonField(row.counts) || {},
    releases: parseJsonField(row.releases) || {},
    catalog_version: row.catalog_version ?? null
  }
}

/**
 * Find which SKU (within releases) contains the given Title ID.
 * @param {object} releases
 * @param {string} tid
 * @returns {{ region: string, sku: object, role: string }|null}
 */
export function findSkuForTid(releases, tid) {
  const needle = String(tid || '').toUpperCase()
  if (!needle || !releases || typeof releases !== 'object') return null

  for (const [region, skus] of Object.entries(releases)) {
    if (!Array.isArray(skus)) continue
    for (const sku of skus) {
      if (!sku || typeof sku !== 'object') continue
      if (sku.base?.tid?.toUpperCase() === needle) {
        return { region, sku, role: 'base' }
      }
      if (sku.update?.tid?.toUpperCase() === needle) {
        return { region, sku, role: 'update' }
      }
      for (const role of ['dlc', 'demos', 'extras']) {
        const list = sku[role]
        if (!Array.isArray(list)) continue
        if (list.some((e) => e?.tid?.toUpperCase() === needle)) {
          const apiRole = role === 'demos' ? 'demo' : role === 'extras' ? 'extra' : role
          return { region, sku, role: apiRole }
        }
      }
    }
  }
  return null
}

/**
 * Related payload for one Title ID: catalog family + full regional releases tree.
 * @param {string} tid
 * @param {{ catalog_id?: string|null, catalog_role?: string|null, market?: string|null, region_conflict?: boolean|null, region?: string|null }} [ctrRow]
 * @returns {Promise<object|null>}
 */
export async function getCtrRelated(tid, ctrRow = null) {
  const upper = String(tid || '').toUpperCase()
  if (!/^[0-9A-F]{16}$/.test(upper)) return null

  let catalogId = ctrRow?.catalog_id || null
  let role = ctrRow?.catalog_role || null
  let market = ctrRow?.market ?? null
  let regionConflict = Boolean(ctrRow?.region_conflict)
  let region = ctrRow?.region || null

  if (!catalogId) {
    const row = await db.prepare(`
      SELECT catalog_id, catalog_role, market, region_conflict, region
      FROM ctr WHERE tid = $1
    `).get(upper)
    if (!row?.catalog_id) return null
    catalogId = row.catalog_id
    role = row.catalog_role
    market = row.market
    regionConflict = Boolean(row.region_conflict)
    region = row.region
  }

  const catalog = await getCtrCatalogTitle(catalogId)
  if (!catalog) {
    return {
      catalog_id: catalogId,
      role: role || null,
      market,
      region_conflict: regionConflict,
      region,
      title: null,
      releases: null
    }
  }

  const hit = findSkuForTid(catalog.releases, upper)

  return {
    catalog_id: catalog.id,
    role: role || hit?.role || null,
    market,
    region_conflict: regionConflict,
    region: hit?.region || region,
    kind: catalog.kind,
    platform: catalog.platform,
    serial: catalog.serial,
    name: catalog.name,
    regions: catalog.regions,
    markets: catalog.markets,
    counts: catalog.counts,
    sku: hit?.sku || null,
    releases: catalog.releases
  }
}

/**
 * Ingest data/title_catalog.json from the 3dsdb mirror into ctr_catalog + ctr link columns.
 * @param {string} mirrorPath
 * @returns {Promise<{ skipped: boolean, reason?: string, titles: number, indexed: number, linked: number, sourceHash: string|null }>}
 */
export async function syncCtrTitleCatalog(mirrorPath) {
  const catalogPath = join(mirrorPath, 'data', 'title_catalog.json')
  if (!existsSync(catalogPath)) {
    console.log('  ⚠ title_catalog.json missing in mirror — skipping catalog sync')
    return {
      skipped: true,
      reason: 'missing-file',
      titles: 0,
      indexed: 0,
      linked: 0,
      sourceHash: null
    }
  }

  console.log('  → Reading title_catalog.json from mirror…')
  const buf = readFileSync(catalogPath)
  const sourceHash = gitBlobSha(buf)

  let catalog
  try {
    catalog = JSON.parse(buf.toString('utf8'))
  } catch (error) {
    throw new Error(`Invalid title_catalog.json: ${error.message}`)
  }

  const titles = Array.isArray(catalog.titles) ? catalog.titles : []
  const tidIndex =
    catalog.tid_index && typeof catalog.tid_index === 'object' ? catalog.tid_index : {}
  const catalogVersion =
    typeof catalog.version === 'number' ? catalog.version : null

  const prev = await db.prepare(`
    SELECT source_hash FROM ctr_catalog WHERE source_hash IS NOT NULL LIMIT 1
  `).get()
  const catalogUnchanged = Boolean(prev?.source_hash && prev.source_hash === sourceHash)

  let titleCount = 0

  if (catalogUnchanged) {
    const countRow = await db.prepare('SELECT COUNT(*) AS count FROM ctr_catalog').get()
    titleCount = parseInt(countRow?.count, 10) || 0
    console.log(
      `  ✓ Catalog file unchanged (${sourceHash.slice(0, 7)}, ${titleCount} titles) — ` +
        'refresh tid links only'
    )
  } else {
    console.log(
      `  → Applying catalog v${catalogVersion ?? '?'} — ${titles.length} titles, ` +
        `${Object.keys(tidIndex).length} tid index entries`
    )

    const upsertTitle = db.prepare(`
      INSERT INTO ctr_catalog (
        id, kind, platform, serial, name, regions, markets, counts, releases,
        catalog_version, source_hash, synced_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9,
        $10, $11, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
      ON CONFLICT (id) DO UPDATE SET
        kind = EXCLUDED.kind,
        platform = EXCLUDED.platform,
        serial = EXCLUDED.serial,
        name = EXCLUDED.name,
        regions = EXCLUDED.regions,
        markets = EXCLUDED.markets,
        counts = EXCLUDED.counts,
        releases = EXCLUDED.releases,
        catalog_version = EXCLUDED.catalog_version,
        source_hash = EXCLUDED.source_hash,
        synced_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    `)

    // Drop titles removed upstream so the table mirrors the file.
    const keepIds = titles.map((t) => t?.id).filter(Boolean)
    if (keepIds.length > 0) {
      await db.prepare(`
        DELETE FROM ctr_catalog
        WHERE NOT (id = ANY($1::varchar[]))
      `).run(keepIds)
    } else {
      await db.prepare('DELETE FROM ctr_catalog').run()
    }

    for (const t of titles) {
      if (!t?.id || !t.kind || !t.platform || !t.serial) continue
      await upsertTitle.run(
        t.id,
        t.kind,
        t.platform,
        t.serial,
        t.name || null,
        JSON.stringify(t.regions || []),
        JSON.stringify(t.markets || []),
        JSON.stringify(t.counts || {}),
        JSON.stringify(t.releases || {}),
        catalogVersion,
        sourceHash
      )
      titleCount++
      if (titleCount % 500 === 0) {
        console.log(`  … catalog titles upserted: ${titleCount}/${titles.length}`)
      }
    }
  }

  // Always re-apply tid → catalog links (covers new ctr rows after meta sync).
  if (!catalogUnchanged) {
    await db.prepare(`
      UPDATE ctr SET
        catalog_id = NULL,
        catalog_role = NULL,
        market = NULL,
        region_conflict = FALSE
      WHERE catalog_id IS NOT NULL
         OR catalog_role IS NOT NULL
         OR market IS NOT NULL
         OR region_conflict IS TRUE
    `).run()
  }

  const linkStmt = db.prepare(`
    UPDATE ctr SET
      catalog_id = $2,
      catalog_role = $3,
      market = $4,
      region_conflict = $5
    WHERE tid = $1
      AND (
        catalog_id IS DISTINCT FROM $2
        OR catalog_role IS DISTINCT FROM $3
        OR market IS DISTINCT FROM $4
        OR region_conflict IS DISTINCT FROM $5
      )
  `)

  let linked = 0
  let indexed = 0
  const entries = Object.entries(tidIndex)
  for (let i = 0; i < entries.length; i++) {
    const [tidRaw, info] = entries[i]
    const tid = String(tidRaw).toUpperCase()
    if (!/^[0-9A-F]{16}$/.test(tid) || !info || typeof info !== 'object') continue
    indexed++

    const role = CATALOG_ROLES.has(info.role) ? info.role : null
    const catalogId = typeof info.title === 'string' ? info.title : null
    if (!catalogId) continue

    const market =
      typeof info.market === 'string' && info.market
        ? String(info.market).toUpperCase()
        : null
    const conflict = Boolean(info.region_conflict)

    const result = await linkStmt.run(tid, catalogId, role, market, conflict)
    linked += result.changes || 0

    if ((i + 1) % 2000 === 0) {
      console.log(`  … tid links applied: ${i + 1}/${entries.length}`)
    }
  }

  console.log(
    `  ✓ Catalog sync: ${titleCount} titles stored, ${indexed} index entries, ` +
      `${linked} ctr rows linked/updated`
  )

  return {
    skipped: catalogUnchanged,
    reason: catalogUnchanged ? 'hash-unchanged' : undefined,
    titles: titleCount,
    indexed,
    linked,
    sourceHash
  }
}

export { CATALOG_ROLES }
