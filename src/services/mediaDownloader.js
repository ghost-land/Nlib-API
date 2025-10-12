import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const MEDIA_DIR = join(__dirname, '..', '..', 'media')

// Ensure media directory exists
if (!existsSync(MEDIA_DIR)) {
  mkdirSync(MEDIA_DIR, { recursive: true })
}

/**
 * Download image from URL
 * @param {string} url - Image URL
 * @returns {Promise<Buffer|null>} - Image buffer or null if failed
 */
async function downloadImage(url) {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(30000) // 30 seconds timeout
    })
    
    if (!response.ok) {
      return null
    }
    
    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from(arrayBuffer)
  } catch (error) {
    // Silently fail for individual images
    return null
  }
}

/**
 * Download and save game icon
 * @param {string} tid - Title ID
 * @param {string} iconUrl - Icon URL
 * @returns {Promise<boolean>} - Success status
 */
export async function downloadIcon(tid, iconUrl) {
  if (!iconUrl) return false
  
  const tidDir = join(MEDIA_DIR, tid)
  if (!existsSync(tidDir)) {
    mkdirSync(tidDir, { recursive: true })
  }
  
  const iconPath = join(tidDir, 'icon')
  
  // Skip if already exists (never overwrite)
  if (existsSync(iconPath)) {
    return true
  }
  
  const imageData = await downloadImage(iconUrl)
  if (!imageData) return false
  
  writeFileSync(iconPath, imageData)
  return true
}

/**
 * Download and save game banner
 * @param {string} tid - Title ID
 * @param {string} bannerUrl - Banner URL
 * @returns {Promise<boolean>} - Success status
 */
export async function downloadBanner(tid, bannerUrl) {
  if (!bannerUrl) return false
  
  const tidDir = join(MEDIA_DIR, tid)
  if (!existsSync(tidDir)) {
    mkdirSync(tidDir, { recursive: true })
  }
  
  const bannerPath = join(tidDir, 'banner')
  
  // Skip if already exists (never overwrite)
  if (existsSync(bannerPath)) {
    return true
  }
  
  const imageData = await downloadImage(bannerUrl)
  if (!imageData) return false
  
  writeFileSync(bannerPath, imageData)
  return true
}

/**
 * Download and save game screenshots
 * @param {string} tid - Title ID
 * @param {Array<string>} screenshots - Array of screenshot URLs
 * @returns {Promise<number>} - Number of screenshots downloaded
 */
export async function downloadScreenshots(tid, screenshots) {
  if (!screenshots || !Array.isArray(screenshots) || screenshots.length === 0) {
    return 0
  }
  
  const screensDir = join(MEDIA_DIR, tid, 'screens')
  if (!existsSync(screensDir)) {
    mkdirSync(screensDir, { recursive: true })
  }
  
  let downloaded = 0
  
  for (let i = 0; i < screenshots.length; i++) {
    const screenIndex = i + 1
    const screenPath = join(screensDir, `screen_${screenIndex}`)
    
    // Skip if already exists (never overwrite)
    if (existsSync(screenPath)) {
      downloaded++
      continue
    }
    
    const imageData = await downloadImage(screenshots[i])
    if (imageData) {
      writeFileSync(screenPath, imageData)
      downloaded++
    }
  }
  
  return downloaded
}

/**
 * Download all media for a game
 * @param {string} tid - Title ID
 * @param {Object} gameData - Game data with media URLs
 * @returns {Promise<Object>} - Download results
 */
export async function downloadGameMedia(tid, gameData) {
  const results = {
    icon: false,
    banner: false,
    screenshots: 0
  }
  
  // Download in parallel for better performance
  const [icon, banner, screenshots] = await Promise.all([
    downloadIcon(tid, gameData.iconUrl),
    downloadBanner(tid, gameData.bannerUrl),
    downloadScreenshots(tid, gameData.screenshots)
  ])
  
  results.icon = icon
  results.banner = banner
  results.screenshots = screenshots
  
  return results
}

