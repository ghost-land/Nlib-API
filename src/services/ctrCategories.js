/**
 * CTR (3DS) category whitelist.
 * Nested extras use "extras/<sub>" (e.g. extras/hb).
 * "themes" kept for backward compatibility with existing rows/media.
 */
export const CTR_CATEGORIES = Object.freeze([
  'base',
  'digital-demos',
  'kiosk-demos',
  'region-free',
  'unknown-other',
  'dlc',
  'dsiware',
  'extras',
  'extras/custom-dsiware',
  'extras/devapps-misc',
  'extras/hb',
  'extras/rom-hacks',
  'extras/translated-games',
  'updates',
  'videos',
  'virtual-console',
  'themes'
])

const CATEGORY_SET = new Set(CTR_CATEGORIES)

/**
 * Whether a category string is accepted by the API / sync.
 * @param {string} category
 * @returns {boolean}
 */
export function isValidCtrCategory(category) {
  if (!category || typeof category !== 'string') return false
  if (CATEGORY_SET.has(category)) return true
  // Allow future extras/* subfolders without code changes
  if (category.startsWith('extras/') && /^extras\/[a-z0-9-]+$/.test(category)) {
    return true
  }
  return false
}

/**
 * Parse a 3dsdb path into category + tid.
 * Examples:
 *   db/3ds/base/0004000000030800/meta.json → { category: 'base', tid: '...' }
 *   db/3ds/extras/hb/000400000000FB00/meta.json → { category: 'extras/hb', tid: '...' }
 * @param {string} path - Repo-relative path
 * @returns {{ category: string, tid: string }|null}
 */
export function parseCtrSourcePath(path) {
  if (!path || typeof path !== 'string') return null

  const normalized = path.replace(/^\/+/, '')
  const match = normalized.match(
    /^db\/3ds\/((?:extras\/)?[a-z0-9-]+)\/([0-9A-Fa-f]{16})\/meta\.json$/
  )
  if (!match) return null

  const category = match[1]
  const tid = match[2].toUpperCase()

  if (!isValidCtrCategory(category)) return null
  return { category, tid }
}

/**
 * SQL-friendly category filter:
 * - exact match for normal categories
 * - "extras" matches category = 'extras' OR category LIKE 'extras/%'
 * @param {string} category
 * @returns {{ sql: string, params: string[] }|null}
 */
export function buildCategoryFilter(category) {
  if (!category || !isValidCtrCategory(category)) return null

  if (category === 'extras') {
    return {
      sql: `(category = $1 OR category LIKE $2)`,
      params: ['extras', 'extras/%']
    }
  }

  return {
    sql: `category = $1`,
    params: [category]
  }
}
