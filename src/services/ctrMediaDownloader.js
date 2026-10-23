import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const CTR_MEDIA_DIR = join(__dirname, '..', '..', 'media', 'ctr')
const RAW_BASE = 'https://raw.githubusercontent.com/ghost-land/3dsdb/main'

/**
 * Resolve local media directory for a CTR title (supports nested extras/*).
 * @param {string} tid
 * @param {string} category
 * @returns {string}
 */
function getTitleMediaDir(tid, category) {
  const parts = category.split('/').filter(Boolean)
  return join(CTR_MEDIA_DIR, ...parts, tid.toUpperCase())
}

/**
 * @param {string} url
 * @returns {Promise<Buffer|null>}
 */
async function downloadImage(url) {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(30000)
    })
    if (!response.ok) return null
    return Buffer.from(await response.arrayBuffer())
  } catch {
    return null
  }
}

/**
 * Download icon.jpg / banner.jpg from 3dsdb when missing locally.
 * Files are stored without extension to match existing CTR media layout.
 * @param {string} tid
 * @param {string} category - e.g. base | extras/hb
 * @returns {Promise<{ icon: boolean, banner: boolean }>}
 */
export async function downloadCtrMediaFrom3dsdb(tid, category) {
  const result = { icon: false, banner: false }
  if (!tid || !category) return result

  const tidUpper = tid.toUpperCase()
  const dir = getTitleMediaDir(tidUpper, category)
  const repoDir = `${RAW_BASE}/db/3ds/${category}/${tidUpper}`

  const iconPath = join(dir, 'icon')
  const bannerPath = join(dir, 'banner')

  const needIcon = !existsSync(iconPath)
  const needBanner = !existsSync(bannerPath)
  if (!needIcon && !needBanner) {
    return { icon: true, banner: true }
  }

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }

  if (needIcon) {
    const data = await downloadImage(`${repoDir}/icon.jpg`)
    if (data) {
      writeFileSync(iconPath, data)
      result.icon = true
    }
  } else {
    result.icon = true
  }

  if (needBanner) {
    const data = await downloadImage(`${repoDir}/banner.jpg`)
    if (data) {
      writeFileSync(bannerPath, data)
      result.banner = true
    }
  } else {
    result.banner = true
  }

  return result
}
