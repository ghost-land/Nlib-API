import { access, copyFile, mkdir, readdir, stat } from 'fs/promises'
import { constants } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const CTR_MEDIA_DIR = join(__dirname, '..', '..', 'media', 'ctr')

/**
 * Map a 3dsdb title-relative media path to the local extensionless layout.
 * @param {string} relativePath - e.g. icon.jpg | screenshots/screenshot_1.jpg
 * @returns {string|null}
 */
export function mapCtrRemoteMediaToLocal(relativePath) {
  const normalized = String(relativePath || '').replace(/\\/g, '/').replace(/^\/+/, '')

  if (normalized === 'icon.jpg') return 'icon'
  if (normalized === 'banner.jpg') return 'banner'
  if (normalized === 'top_image.jpg') return 'top_image'

  let match = normalized.match(/^screenshots\/screenshot_(\d+)\.jpg$/i)
  if (match) return `screen/${match[1]}`

  match = normalized.match(/^screenshots_uncompiled\/screenshot_(\d+)_upper\.jpg$/i)
  if (match) return `screen_u/${match[1]}_u`

  match = normalized.match(/^screenshots_uncompiled\/screenshot_(\d+)_lower\.jpg$/i)
  if (match) return `screen_u/${match[1]}_l`

  match = normalized.match(/^thumbnails\/thumbnail_(\d+)\.jpg$/i)
  if (match) return `thumb/${match[1]}`

  return null
}

/**
 * @param {string} path
 * @returns {Promise<boolean>}
 */
async function pathExists(path) {
  try {
    await access(path, constants.F_OK)
    return true
  } catch {
    return false
  }
}

/**
 * Recursively list media files under a title folder in the 3dsdb mirror.
 * @param {string} titleDir
 * @returns {Promise<Array<{ remote: string, local: string, absolute: string }>>}
 */
export async function listCtrMediaAssetsFromTitleDir(titleDir) {
  const assets = []
  if (!titleDir || !(await pathExists(titleDir))) return assets

  /**
   * @param {string} dir
   * @param {string} prefix
   */
  async function walk(dir, prefix) {
    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name
      const abs = join(dir, entry.name)
      if (entry.isDirectory()) {
        await walk(abs, rel)
        continue
      }
      if (!entry.isFile()) continue
      const local = mapCtrRemoteMediaToLocal(rel)
      if (!local) continue
      assets.push({ remote: rel, local, absolute: abs })
    }
  }

  await walk(titleDir, '')
  return assets
}

/**
 * @param {string} tid
 * @param {string} category
 * @returns {string}
 */
function getTitleMediaDir(tid, category) {
  const parts = category.split('/').filter(Boolean)
  return join(CTR_MEDIA_DIR, ...parts, tid.toUpperCase())
}

/**
 * Fast check: does this title already have at least an icon locally?
 * @param {string} tid
 * @param {string} category
 * @returns {Promise<boolean>}
 */
export async function hasCtrLocalIcon(tid, category) {
  if (!tid || !category) return false
  return pathExists(join(getTitleMediaDir(tid, category), 'icon'))
}

/**
 * Copy missing CTR media from mirror → media/ctr (async, non-blocking).
 * @param {string} tid
 * @param {string} category
 * @param {Array<{ remote: string, local: string, absolute?: string }>|null} [assets]
 * @param {string|null} [titleSourceDir]
 * @returns {Promise<{ downloaded: number, present: number, failed: number }>}
 */
export async function syncCtrMediaFromLocal(
  tid,
  category,
  assets = null,
  titleSourceDir = null
) {
  const stats = { downloaded: 0, present: 0, failed: 0 }
  if (!tid || !category) return stats

  const tidUpper = tid.toUpperCase()
  const destDir = getTitleMediaDir(tidUpper, category)

  let planned = Array.isArray(assets) && assets.length > 0
    ? assets.filter((a) => a?.local && (a.absolute || a.remote))
    : null

  if ((!planned || planned.length === 0) && titleSourceDir) {
    planned = await listCtrMediaAssetsFromTitleDir(titleSourceDir)
  }

  if (!planned || planned.length === 0) {
    return stats
  }

  for (const asset of planned) {
    const destPath = join(destDir, asset.local)
    if (await pathExists(destPath)) {
      stats.present++
      continue
    }

    const sourcePath = asset.absolute
      || (titleSourceDir ? join(titleSourceDir, asset.remote) : null)

    if (!sourcePath || !(await pathExists(sourcePath))) {
      stats.failed++
      continue
    }

    try {
      const st = await stat(sourcePath)
      if (!st.isFile()) {
        stats.failed++
        continue
      }
      await mkdir(dirname(destPath), { recursive: true })
      await copyFile(sourcePath, destPath)
      stats.downloaded++
    } catch {
      stats.failed++
    }
  }

  return stats
}

/**
 * @deprecated Prefer syncCtrMediaFromLocal with a git mirror.
 */
export async function downloadCtrMediaFrom3dsdb(tid, category, assets = null) {
  void assets
  return syncCtrMediaFromLocal(tid, category, null, null)
}
