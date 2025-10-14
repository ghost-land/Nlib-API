import { existsSync, readdirSync, statSync, mkdirSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const MEDIA_DIR = join(__dirname, '..', '..', 'media')

/**
 * Get icon path for a TID
 * @param {string} tid - Title ID
 * @returns {string|null} - Full path to icon or null if not found
 */
export function getIconPath(tid) {
  const tidDir = join(MEDIA_DIR, tid)
  if (!existsSync(tidDir)) return null
  
  const iconPath = join(tidDir, 'icon')
  return existsSync(iconPath) ? iconPath : null
}

/**
 * Get banner path for a TID
 * @param {string} tid - Title ID
 * @returns {string|null} - Full path to banner or null if not found
 */
export function getBannerPath(tid) {
  const tidDir = join(MEDIA_DIR, tid)
  if (!existsSync(tidDir)) return null
  
  const bannerPath = join(tidDir, 'banner')
  return existsSync(bannerPath) ? bannerPath : null
}

/**
 * Get screenshot path for a TID
 * @param {string} tid - Title ID
 * @param {number} index - Screenshot index (1-based)
 * @returns {string|null} - Full path to screenshot or null if not found
 */
export function getScreenshotPath(tid, index) {
  const screensDir = join(MEDIA_DIR, tid, 'screens')
  if (!existsSync(screensDir)) return null
  
  const screenPath = join(screensDir, `screen_${index}`)
  return existsSync(screenPath) ? screenPath : null
}

/**
 * Get all screenshots for a TID
 * @param {string} tid - Title ID
 * @returns {Array} - Array of screenshot indices
 */
export function getAllScreenshots(tid) {
  const screensDir = join(MEDIA_DIR, tid, 'screens')
  if (!existsSync(screensDir)) return []
  
  const files = readdirSync(screensDir)
  const screenshots = []
  
  for (const file of files) {
    // Match screen_N pattern
    const match = file.match(/^screen_(\d+)$/)
    if (match) {
      const index = parseInt(match[1], 10)
      if (!isNaN(index)) {
        screenshots.push(index)
      }
    }
  }
  
  // Sort by index
  return screenshots.sort((a, b) => a - b)
}

/**
 * Check if media directory exists for a TID
 * @param {string} tid - Title ID
 * @returns {boolean}
 */
export function hasMedia(tid) {
  const tidDir = join(MEDIA_DIR, tid)
  return existsSync(tidDir)
}

/**
 * Get cache path for a resized image
 * @param {string} tid - Title ID
 * @param {string} type - Image type ('icon' or 'banner')
 * @param {number} width - Width in pixels
 * @param {number} height - Height in pixels
 * @returns {string} - Full path to cached image
 */
export function getCachePath(tid, type, width, height) {
  const cacheDir = join(MEDIA_DIR, tid, 'cache')
  
  // Create cache directory if it doesn't exist
  if (!existsSync(cacheDir)) {
    mkdirSync(cacheDir, { recursive: true })
  }
  
  return join(cacheDir, `${type}_${width}x${height}.jpg`)
}

/**
 * Check if cached image exists
 * @param {string} cachePath - Path to cached image
 * @returns {boolean}
 */
export function hasCachedImage(cachePath) {
  return existsSync(cachePath)
}


