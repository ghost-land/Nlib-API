import db from '../database/init.js'
import { CTR_CATEGORIES, buildCategoryFilter, isValidCtrCategory } from './ctrCategories.js'
import { getCtrCatalogTitle, getCtrRelated } from './ctrCatalog.js'

/**
 * Get metadata JSON for a CTR title from database
 * @param {string} tid - Title ID
 * @returns {Object|null} - Metadata object or null if not found
 */
export async function getCtrMetadata(tid) {
  try {
    const stmt = db.prepare('SELECT * FROM ctr WHERE tid = $1')
    const row = await stmt.get(tid)

    if (!row) return null

    return {
      tid: row.tid,
      uid: row.uid,
      name: row.name,
      formal_name: row.formal_name,
      description: row.description,
      release_date_on_eshop: row.release_date_on_eshop,
      product_code: row.product_code,
      platform_name: row.platform_name,
      region: row.region,
      market: row.market || null,
      region_conflict: Boolean(row.region_conflict),
      genres: row.genres ? JSON.parse(row.genres) : null,
      features: row.features ? JSON.parse(row.features) : null,
      languages: row.languages ? JSON.parse(row.languages) : null,
      rating_system: row.rating_system ? JSON.parse(row.rating_system) : null,
      version: row.version,
      disclaimer: row.disclaimer,
      descriptors: row.descriptors ? JSON.parse(row.descriptors) : null,
      publisher: row.publisher || null,
      smdh: row.smdh ? JSON.parse(row.smdh) : null,
      category: row.category || null,
      catalog_id: row.catalog_id || null,
      catalog_role: row.catalog_role || null
    }
  } catch (error) {
    console.error(`Error reading metadata for ${tid}:`, error.message)
    return null
  }
}

/**
 * Get a specific metadata field for a CTR title
 * @param {string} tid - Title ID
 * @param {string} field - Field name
 * @returns {any|null} - Field value or null if not found
 */
export async function getCtrMetadataField(tid, field) {
  const metadata = await getCtrMetadata(tid)
  if (!metadata) return null

  return Object.prototype.hasOwnProperty.call(metadata, field)
    ? metadata[field]
    : null
}

/**
 * Get statistics for all CTR categories from database
 * @returns {Promise<Object>} - Statistics object with total and categories
 */
export async function getCtrStats() {
  try {
    const stats = {
      total: 0,
      categories: {},
      catalog: {
        titles: 0,
        linked_tids: 0,
        multi_region_titles: 0
      }
    }

    const totalStmt = db.prepare('SELECT COUNT(*) as count FROM ctr')
    const totalResult = await totalStmt.get()
    stats.total = parseInt(totalResult.count) || 0

    // Aggregate counts grouped by stored category (includes nested extras/*)
    const groupStmt = db.prepare(`
      SELECT category, COUNT(*) as count
      FROM ctr
      GROUP BY category
      ORDER BY category
    `)
    const groups = await groupStmt.all()

    for (const cat of CTR_CATEGORIES) {
      stats.categories[cat] = 0
    }

    for (const row of groups) {
      const cat = row.category || 'unknown'
      stats.categories[cat] = parseInt(row.count) || 0
    }

    try {
      const catalogTotal = await db.prepare(
        'SELECT COUNT(*) AS count FROM ctr_catalog'
      ).get()
      stats.catalog.titles = parseInt(catalogTotal?.count, 10) || 0

      const linked = await db.prepare(
        'SELECT COUNT(*) AS count FROM ctr WHERE catalog_id IS NOT NULL'
      ).get()
      stats.catalog.linked_tids = parseInt(linked?.count, 10) || 0

      // regions JSON array length > 1 ⇒ multi-region family
      const multi = await db.prepare(`
        SELECT COUNT(*) AS count FROM ctr_catalog
        WHERE jsonb_array_length(regions::jsonb) > 1
      `).get()
      stats.catalog.multi_region_titles = parseInt(multi?.count, 10) || 0
    } catch (catalogError) {
      // Table may not exist until migration is applied
      console.warn('CTR catalog stats unavailable:', catalogError.message)
    }

    return stats
  } catch (error) {
    console.error('Error getting CTR stats:', error.message)
    return {
      total: 0,
      categories: CTR_CATEGORIES.reduce((acc, cat) => {
        acc[cat] = 0
        return acc
      }, {}),
      catalog: { titles: 0, linked_tids: 0, multi_region_titles: 0 }
    }
  }
}

/**
 * Get all TIDs for a specific category from database
 * @param {string} category - Category name (extras returns all extras/*)
 * @returns {Promise<Array>} - Array of TIDs
 */
export async function getCtrCategoryTitles(category) {
  const filter = buildCategoryFilter(category)
  if (!filter) {
    return []
  }

  try {
    const stmt = db.prepare(
      `SELECT tid FROM ctr WHERE ${filter.sql} ORDER BY tid`
    )
    const rows = await stmt.all(...filter.params)
    return rows.map((row) => row.tid)
  } catch (error) {
    console.error(`Error reading category ${category}:`, error.message)
    return []
  }
}

export { CTR_CATEGORIES, isValidCtrCategory, getCtrCatalogTitle, getCtrRelated }
