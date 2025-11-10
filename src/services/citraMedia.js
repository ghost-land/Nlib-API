import { existsSync, readdirSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Citra media directory structure: media/citra/[category]/[tid]/
const CITRA_MEDIA_DIR = join(__dirname, '..', '..', 'media', 'citra')

/**
 * Get the path to a Citra title directory
 * @param {string} tid - Title ID
 * @param {string} category - Category name (optional, will search all categories if not provided)
 * @returns {string|null} - Full path to title directory or null if not found
 */
function getCitraTitleDir(tid, category = null) {
  const categories = category 
    ? [category]
    : ['base', 'dlc', 'dsiware', 'extras', 'themes', 'updates', 'videos', 'virtual-console']
  
  for (const cat of categories) {
    const tidDir = join(CITRA_MEDIA_DIR, cat, tid)
    if (existsSync(tidDir)) {
      return tidDir
    }
  }
  
  return null
}

/**
 * Get icon path for a Citra TID
 * @param {string} tid - Title ID
 * @returns {string|null} - Full path to icon or null if not found
 */
export function getCitraIconPath(tid) {
  const tidDir = getCitraTitleDir(tid)
  if (!tidDir) return null
  
  const iconPath = join(tidDir, 'icon')
  return existsSync(iconPath) ? iconPath : null
}

/**
 * Get banner path for a Citra TID
 * @param {string} tid - Title ID
 * @returns {string|null} - Full path to banner or null if not found
 */
export function getCitraBannerPath(tid) {
  const tidDir = getCitraTitleDir(tid)
  if (!tidDir) return null
  
  const bannerPath = join(tidDir, 'banner')
  return existsSync(bannerPath) ? bannerPath : null
}

/**
 * Get compiled screenshot path for a Citra TID
 * @param {string} tid - Title ID
 * @param {number} num - Screenshot number (1-based)
 * @returns {string|null} - Full path to screenshot or null if not found
 */
export function getCitraScreenPath(tid, num) {
  const tidDir = getCitraTitleDir(tid)
  if (!tidDir) return null
  
  const screenPath = join(tidDir, 'screen', num.toString())
  return existsSync(screenPath) ? screenPath : null
}

/**
 * Get uncompiled screenshot path for a Citra TID
 * @param {string} tid - Title ID
 * @param {number} num - Screenshot number (1-based)
 * @param {string} screen - Screen type ('u' for upper, 'l' for lower)
 * @returns {string|null} - Full path to screenshot or null if not found
 */
export function getCitraScreenUPath(tid, num, screen) {
  const tidDir = getCitraTitleDir(tid)
  if (!tidDir) return null
  
  if (screen !== 'u' && screen !== 'l') return null
  
  const screenPath = join(tidDir, 'screen_u', `${num}_${screen}`)
  return existsSync(screenPath) ? screenPath : null
}

/**
 * Get thumbnail path for a Citra TID
 * @param {string} tid - Title ID
 * @param {number} num - Thumbnail number (1-based)
 * @returns {string|null} - Full path to thumbnail or null if not found
 */
export function getCitraThumbPath(tid, num) {
  const tidDir = getCitraTitleDir(tid)
  if (!tidDir) return null
  
  const thumbPath = join(tidDir, 'thumb', num.toString())
  return existsSync(thumbPath) ? thumbPath : null
}

/**
 * Get all compiled screenshots for a Citra TID
 * @param {string} tid - Title ID
 * @returns {Array} - Array of screenshot numbers
 */
export function getAllCitraScreens(tid) {
  const tidDir = getCitraTitleDir(tid)
  if (!tidDir) return []
  
  const screensDir = join(tidDir, 'screen')
  if (!existsSync(screensDir)) return []
  
  const files = readdirSync(screensDir)
  const screens = []
  
  for (const file of files) {
    const num = parseInt(file, 10)
    if (!isNaN(num)) {
      screens.push(num)
    }
  }
  
  return screens.sort((a, b) => a - b)
}

/**
 * Get all uncompiled screenshots for a Citra TID
 * @param {string} tid - Title ID
 * @returns {Object} - Object with upper and lower arrays
 */
export function getAllCitraScreenU(tid) {
  const tidDir = getCitraTitleDir(tid)
  if (!tidDir) return { upper: [], lower: [] }
  
  const screenUDir = join(tidDir, 'screen_u')
  if (!existsSync(screenUDir)) return { upper: [], lower: [] }
  
  const files = readdirSync(screenUDir)
  const upper = []
  const lower = []
  
  for (const file of files) {
    const match = file.match(/^(\d+)_(u|l)$/)
    if (match) {
      const num = parseInt(match[1], 10)
      const screen = match[2]
      if (!isNaN(num)) {
        if (screen === 'u') {
          upper.push(num)
        } else if (screen === 'l') {
          lower.push(num)
        }
      }
    }
  }
  
  return {
    upper: upper.sort((a, b) => a - b),
    lower: lower.sort((a, b) => a - b)
  }
}

/**
 * Get all thumbnails for a Citra TID
 * @param {string} tid - Title ID
 * @returns {Array} - Array of thumbnail numbers
 */
export function getAllCitraThumbs(tid) {
  const tidDir = getCitraTitleDir(tid)
  if (!tidDir) return []
  
  const thumbsDir = join(tidDir, 'thumb')
  if (!existsSync(thumbsDir)) return []
  
  const files = readdirSync(thumbsDir)
  const thumbs = []
  
  for (const file of files) {
    const num = parseInt(file, 10)
    if (!isNaN(num)) {
      thumbs.push(num)
    }
  }
  
  return thumbs.sort((a, b) => a - b)
}

