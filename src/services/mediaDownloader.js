import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const MEDIA_DIR = join(__dirname, '..', '..', 'media', 'nx')

if (!existsSync(MEDIA_DIR)) {
  mkdirSync(MEDIA_DIR, { recursive: true })
}

/**
 * Fetch image from URL with timeout
 * @param {string} url - Image URL
 * @returns {Promise<Buffer|null>} - Image buffer or null on failure
 */
async function downloadImage(url) {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(30000)
    })
    
    if (!response.ok) return null
    
    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from(arrayBuffer)
  } catch (error) {
    return null
  }
}

/**
 * Download and save game icon if not present
 * @param {string} tid - Title ID
 * @param {string} iconUrl - Icon URL from TitleDB
 * @returns {Promise<boolean>} - True if downloaded or exists
 */
export async function downloadIcon(tid, iconUrl) {
  if (!iconUrl) return false
  
  const tidDir = join(MEDIA_DIR, tid)
  if (!existsSync(tidDir)) {
    mkdirSync(tidDir, { recursive: true })
  }
  
  const iconPath = join(tidDir, 'icon')
  
  if (existsSync(iconPath)) return true
  
  const imageData = await downloadImage(iconUrl)
  if (!imageData) return false
  
  writeFileSync(iconPath, imageData)
  return true
}

/**
 * Download and save game banner if not present
 * @param {string} tid - Title ID
 * @param {string} bannerUrl - Banner URL from TitleDB
 * @returns {Promise<boolean>} - True if downloaded or exists
 */
export async function downloadBanner(tid, bannerUrl) {
  if (!bannerUrl) return false
  
  const tidDir = join(MEDIA_DIR, tid)
  if (!existsSync(tidDir)) {
    mkdirSync(tidDir, { recursive: true })
  }
  
  const bannerPath = join(tidDir, 'banner')
  
  if (existsSync(bannerPath)) return true
  
  const imageData = await downloadImage(bannerUrl)
  if (!imageData) return false
  
  writeFileSync(bannerPath, imageData)
  return true
}

/**
 * Download and save game screenshots if not present
 * @param {string} tid - Title ID
 * @param {Array<string>} screenshots - Screenshot URLs from TitleDB
 * @returns {Promise<number>} - Count of screenshots available
 */
export async function downloadScreenshots(tid, screenshots) {
  if (!screenshots?.length) return 0
  
  const screensDir = join(MEDIA_DIR, tid, 'screens')
  if (!existsSync(screensDir)) {
    mkdirSync(screensDir, { recursive: true })
  }
  
  let downloaded = 0
  
  for (let i = 0; i < screenshots.length; i++) {
    const screenIndex = i + 1
    const screenPath = join(screensDir, `screen_${screenIndex}`)
    
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
 * Download all available media assets for a game
 * Skips files that already exist on disk
 * @param {string} tid - Title ID
 * @param {Object} gameData - TitleDB entry with iconUrl, bannerUrl, screenshots
 * @returns {Promise<Object>} - Download results {icon, banner, screenshots}
 */
export async function downloadGameMedia(tid, gameData) {
  const results = {
    icon: false,
    banner: false,
    screenshots: 0
  }
  
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

