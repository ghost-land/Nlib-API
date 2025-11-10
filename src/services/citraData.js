import db from '../database/init.js'

const CATEGORIES = ['base', 'dlc', 'dsiware', 'extras', 'themes', 'updates', 'videos', 'virtual-console']

/**
 * Get metadata JSON for a Citra title from database
 * @param {string} tid - Title ID
 * @returns {Object|null} - Metadata object or null if not found
 */
export async function getCitraMetadata(tid) {
  try {
    const stmt = db.prepare('SELECT * FROM citra WHERE tid = $1')
    const row = await stmt.get(tid)
    
    if (!row) return null
    
    // Parse JSON fields
    const metadata = {
      tid: row.tid,
      uid: row.uid,
      name: row.name,
      formal_name: row.formal_name,
      description: row.description,
      release_date_on_eshop: row.release_date_on_eshop,
      product_code: row.product_code,
      platform_name: row.platform_name,
      region: row.region,
      genres: row.genres ? JSON.parse(row.genres) : null,
      features: row.features ? JSON.parse(row.features) : null,
      languages: row.languages ? JSON.parse(row.languages) : null,
      rating_system: row.rating_system ? JSON.parse(row.rating_system) : null,
      version: row.version,
      disclaimer: row.disclaimer,
      descriptors: row.descriptors ? JSON.parse(row.descriptors) : null
    }
    
    return metadata
  } catch (error) {
    console.error(`Error reading metadata for ${tid}:`, error.message)
    return null
  }
}

/**
 * Get a specific metadata field for a Citra title
 * @param {string} tid - Title ID
 * @param {string} field - Field name
 * @returns {any|null} - Field value or null if not found
 */
export async function getCitraMetadataField(tid, field) {
  const metadata = await getCitraMetadata(tid)
  if (!metadata) return null
  
  return metadata[field] || null
}

/**
 * Get statistics for all Citra categories from database
 * @returns {Promise<Object>} - Statistics object with total and categories
 */
export async function getCitraStats() {
  try {
    const stats = {
      total: 0,
      categories: {}
    }
    
    // Get total count
    const totalStmt = db.prepare('SELECT COUNT(*) as count FROM citra')
    const totalResult = await totalStmt.get()
    stats.total = parseInt(totalResult.count) || 0
    
    // Get count per category
    for (const category of CATEGORIES) {
      const categoryStmt = db.prepare('SELECT COUNT(*) as count FROM citra WHERE category = $1')
      const categoryResult = await categoryStmt.get(category)
      stats.categories[category] = parseInt(categoryResult.count) || 0
    }
    
    return stats
  } catch (error) {
    console.error('Error getting Citra stats:', error.message)
    return {
      total: 0,
      categories: CATEGORIES.reduce((acc, cat) => {
        acc[cat] = 0
        return acc
      }, {})
    }
  }
}

/**
 * Get all TIDs for a specific category from database
 * @param {string} category - Category name
 * @returns {Promise<Array>} - Array of TIDs
 */
export async function getCitraCategoryTitles(category) {
  if (!CATEGORIES.includes(category)) {
    return []
  }
  
  try {
    const stmt = db.prepare('SELECT tid FROM citra WHERE category = $1 ORDER BY tid')
    const rows = await stmt.all(category)
    return rows.map(row => row.tid)
  } catch (error) {
    console.error(`Error reading category ${category}:`, error.message)
    return []
  }
}

