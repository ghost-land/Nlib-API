import { Hono } from 'hono'
import { getGameByTID, getGamesCount, getLastSync } from '../services/nxSync.js'
import { getIconPath, getBannerPath, getScreenshotPath, getAllScreenshots, getCachePath, hasCachedImage } from '../services/media.js'
import db from '../database/init.js'
import { readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import sharp from 'sharp'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const nx = new Hono()

// Home page for Nintendo Switch stats
nx.get('/', (c) => {
  const htmlPath = join(__dirname, '..', 'views', 'nx.html')
  let html = readFileSync(htmlPath, 'utf-8')
  
  // Get base URL from request
  const url = new URL(c.req.url)
  const baseUrl = `${url.protocol}//${url.host}`
  
  // Replace version placeholder
  const packageJsonPath = join(__dirname, '..', '..', 'package.json')
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
  
  // Replace placeholders
  html = html.replace(/{{VERSION}}/g, packageJson.version)
  html = html.replace(/{{BASE_URL}}/g, baseUrl)
  
  return c.html(html)
})

// Media endpoints (must be before /:tid to avoid conflicts)

// Get icon with optional resize (always square)
nx.get('/:tid/icon/:width?/:height?', async (c) => {
  try {
    const tid = c.req.param('tid').toUpperCase()
    const width = c.req.param('width')
    const height = c.req.param('height')
    
    const iconPath = getIconPath(tid)
    
    if (!iconPath) {
      return c.json({ success: false, error: 'Icon not found' }, 404)
    }
    
    // If no size specified, return original
    if (!width) {
      const image = readFileSync(iconPath)
      return c.body(image, 200, {
        'Content-Type': 'image/jpeg'
      })
    }
    
    // Parse dimensions
    const w = parseInt(width, 10)
    const h = height ? parseInt(height, 10) : w
    
    // Validate dimensions
    if (isNaN(w) || w < 30 || w > 4096) {
      return c.json({ 
        success: false, 
        error: 'Invalid size. Size must be between 30 and 4096 pixels' 
      }, 400)
    }
    
    // Icons must be square - if height is provided, it must equal width
    if (w !== h) {
      return c.json({ 
        success: false, 
        error: 'Icons must be square. Width and height must be the same (e.g., 256/256 or just 256)' 
      }, 400)
    }
    
    // Round to nearest 10 for cache optimization
    const roundedSize = Math.round(w / 10) * 10
    
    // Check cache
    const cachePath = getCachePath(tid, 'icon', roundedSize, roundedSize)
    
    if (hasCachedImage(cachePath)) {
      const cachedImage = readFileSync(cachePath)
      return c.body(cachedImage, 200, {
        'Content-Type': 'image/jpeg',
        'X-Cache': 'HIT',
        'X-Size-Rounded': w !== roundedSize ? `${w}->${roundedSize}` : `${roundedSize}`
      })
    }
    
    // Resize image (square) using rounded size
    const image = readFileSync(iconPath)
    const resizedImage = await sharp(image)
      .resize(roundedSize, roundedSize, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .jpeg({ quality: 90 })
      .toBuffer()
    
    // Save to cache
    writeFileSync(cachePath, resizedImage)
    
    return c.body(resizedImage, 200, {
      'Content-Type': 'image/jpeg',
      'X-Cache': 'MISS',
      'X-Size-Rounded': w !== roundedSize ? `${w}->${roundedSize}` : `${roundedSize}`
    })
  } catch (error) {
    return c.json({ success: false, error: error.message }, 500)
  }
})

// Get banner with width/height format
nx.get('/:tid/banner/:width/:height', async (c) => {
  try {
    const tid = c.req.param('tid').toUpperCase()
    const width = parseInt(c.req.param('width'), 10)
    const height = parseInt(c.req.param('height'), 10)
    
    const bannerPath = getBannerPath(tid)
    
    if (!bannerPath) {
      return c.json({ success: false, error: 'Banner not found' }, 404)
    }
    
    // Validate dimensions
    if (isNaN(width) || isNaN(height) || width < 100 || width > 1920 || height < 100 || height > 1080) {
      return c.json({ 
        success: false, 
        error: 'Invalid dimensions. Width: 100-1920, Height: 100-1080' 
      }, 400)
    }
    
    // Check cache
    const cachePath = getCachePath(tid, 'banner', width, height)
    
    if (hasCachedImage(cachePath)) {
      const cachedImage = readFileSync(cachePath)
      return c.body(cachedImage, 200, {
        'Content-Type': 'image/jpeg',
        'X-Cache': 'HIT'
      })
    }
    
    // Resize image
    const image = readFileSync(bannerPath)
    const resizedImage = await sharp(image)
      .resize(width, height, {
        fit: 'cover',
        position: 'center'
      })
      .jpeg({ quality: 90 })
      .toBuffer()
    
    // Save to cache
    writeFileSync(cachePath, resizedImage)
    
    return c.body(resizedImage, 200, {
      'Content-Type': 'image/jpeg',
      'X-Cache': 'MISS'
    })
  } catch (error) {
    return c.json({ success: false, error: error.message }, 500)
  }
})

// Get banner with optional resize (shorthand format)
nx.get('/:tid/banner/:size?', async (c) => {
  try {
    const tid = c.req.param('tid').toUpperCase()
    const size = c.req.param('size')
    
    const bannerPath = getBannerPath(tid)
    
    if (!bannerPath) {
      return c.json({ success: false, error: 'Banner not found' }, 404)
    }
    
    // Determine dimensions
    let width = 1920
    let height = 1080
    
    if (size) {
      // Handle shorthand formats
      if (size === '240p' || size === '240') {
        width = 426
        height = 240
      } else if (size === '360p' || size === '360') {
        width = 640
        height = 360
      } else if (size === '480p' || size === '480') {
        width = 854
        height = 480
      } else if (size === '540p' || size === '540') {
        width = 960
        height = 540
      } else if (size === '720p' || size === '720') {
        width = 1280
        height = 720
      } else if (size === '1080p' || size === '1080') {
        width = 1920
        height = 1080
      } else {
        // Try to parse as width
        const parsedWidth = parseInt(size, 10)
        if (isNaN(parsedWidth)) {
          return c.json({ 
            success: false, 
            error: 'Invalid size. Use 240/240p, 360/360p, 480/480p, 540/540p, 720/720p, 1080/1080p, or specific widths (426, 640, 854, 960, 1280, 1920)' 
          }, 400)
        }
        
        // Support specific widths
        if (parsedWidth === 426) {
          width = 426
          height = 240
        } else if (parsedWidth === 640) {
          width = 640
          height = 360
        } else if (parsedWidth === 854) {
          width = 854
          height = 480
        } else if (parsedWidth === 960) {
          width = 960
          height = 540
        } else if (parsedWidth === 1280) {
          width = 1280
          height = 720
        } else if (parsedWidth === 1920) {
          width = 1920
          height = 1080
        } else {
          return c.json({ 
            success: false, 
            error: 'Supported sizes: 426x240 (240p), 640x360 (360p), 854x480 (480p), 960x540 (540p), 1280x720 (720p), 1920x1080 (1080p)' 
          }, 400)
        }
      }
    }
    
    // Check cache
    const cachePath = getCachePath(tid, 'banner', width, height)
    
    if (hasCachedImage(cachePath)) {
      const cachedImage = readFileSync(cachePath)
      return c.body(cachedImage, 200, {
        'Content-Type': 'image/jpeg',
        'X-Cache': 'HIT'
      })
    }
    
    // Resize image
    const image = readFileSync(bannerPath)
    const resizedImage = await sharp(image)
      .resize(width, height, {
        fit: 'cover',
        position: 'center'
      })
      .jpeg({ quality: 90 })
      .toBuffer()
    
    // Save to cache
    writeFileSync(cachePath, resizedImage)
    
    return c.body(resizedImage, 200, {
      'Content-Type': 'image/jpeg',
      'X-Cache': 'MISS'
    })
  } catch (error) {
    return c.json({ success: false, error: error.message }, 500)
  }
})

// Get screenshot by index
nx.get('/:tid/screen/:index', (c) => {
  try {
    const tid = c.req.param('tid').toUpperCase()
    const index = parseInt(c.req.param('index'), 10)
    
    if (isNaN(index) || index < 1) {
      return c.json({ success: false, error: 'Invalid screen index' }, 400)
    }
    
    const screenPath = getScreenshotPath(tid, index)
    
    if (!screenPath) {
      return c.json({ success: false, error: 'Screenshot not found' }, 404)
    }
    
    const image = readFileSync(screenPath)
    return c.body(image, 200, {
      'Content-Type': 'image/jpeg'
    })
  } catch (error) {
    return c.json({ success: false, error: error.message }, 500)
  }
})

// Get all screenshots list
nx.get('/:tid/screens', (c) => {
  try {
    const tid = c.req.param('tid').toUpperCase()
    const screenshots = getAllScreenshots(tid)
    
    if (screenshots.length === 0) {
      return c.json({
        count: 0,
        screenshots: []
      })
    }
    
    // Build URLs for each screenshot based on current domain
    const url = new URL(c.req.url)
    const baseUrl = `${url.protocol}//${url.host}/nx/${tid}/screen`
    const screenshotUrls = screenshots.map(index => `${baseUrl}/${index}`)
    
    return c.json({
      count: screenshots.length,
      screenshots: screenshotUrls
    })
  } catch (error) {
    return c.json({ success: false, error: error.message }, 500)
  }
})

// Get stats (must be before /:tid to avoid conflicts)
nx.get('/stats', async (c) => {
  try {
    // Total games count
    const totalGames = await getGamesCount()
    const lastSync = await getLastSync()
    
    // Games by type
    const typeStats = await db.prepare(`
      SELECT type, COUNT(*) as count
      FROM nx
      GROUP BY type
    `).all()
    
    // Games vs Demos
    const demoStats = await db.prepare(`
      SELECT 
        SUM(CASE WHEN is_demo = 1 THEN 1 ELSE 0 END) as demos,
        SUM(CASE WHEN is_demo = 0 THEN 1 ELSE 0 END) as games
      FROM nx
    `).get()
    
    // Games by region
    const regionStats = await db.prepare(`
      SELECT region, COUNT(*) as count
      FROM nx
      WHERE region IS NOT NULL
      GROUP BY region
      ORDER BY count DESC
    `).all()
    
    // Games by console
    const consoleStats = await db.prepare(`
      SELECT console, COUNT(*) as count
      FROM nx
      GROUP BY console
    `).all()
    
    // Top 10 publishers
    const topPublishers = await db.prepare(`
      SELECT publisher, COUNT(*) as count
      FROM nx
      WHERE publisher IS NOT NULL AND publisher != ''
      GROUP BY publisher
      ORDER BY count DESC
      LIMIT 10
    `).all()
    
    // Most recent games added/updated
    const recentGames = await db.prepare(`
      SELECT tid, name, updated_at
      FROM nx
      ORDER BY updated_at DESC
      LIMIT 5
    `).all()
    
    return c.json({
      success: true,
      data: {
        total_games: totalGames,
        last_sync: lastSync,
        by_type: typeStats.reduce((acc, row) => {
          acc[row.type] = row.count
          return acc
        }, {}),
        games_vs_demos: {
          games: demoStats.games || 0,
          demos: demoStats.demos || 0
        },
        by_region: regionStats.reduce((acc, row) => {
          acc[row.region] = row.count
          return acc
        }, {}),
        by_console: consoleStats.reduce((acc, row) => {
          acc[row.console] = row.count
          return acc
        }, {}),
        top_publishers: topPublishers.map(p => ({
          name: p.publisher,
          games_count: p.count
        })),
        recent_updates: recentGames.map(g => ({
          tid: g.tid,
          name: g.name,
          updated_at: g.updated_at
        }))
      }
    })
  } catch (error) {
    return c.json({
      success: false,
      error: error.message
    }, 500)
  }
})

// Get game by TID
nx.get('/:tid', async (c) => {
  try {
    const tid = c.req.param('tid').toUpperCase()
    const lang = c.req.query('lang') || 'en' // Default to English
    const fieldsParam = c.req.query('fields') // Optional fields filter
    
    // Validate language
    const validLangs = ['en', 'ja', 'es', 'de', 'fr', 'nl', 'pt', 'it', 'zh', 'ko', 'ru']
    const selectedLang = validLangs.includes(lang) ? lang : 'en'
    
    // Map API fields to SQL columns
    const fieldMapping = {
      id: 'g.tid as id',
      name: 'g.name',
      publisher: 'g.publisher',
      developer: 'g.developer',
      releaseDate: 'g.release_date as "releaseDate"',
      category: 'g.category',
      languages: 'g.languages',
      nsuId: 'g.nsu_id as "nsuId"',
      numberOfPlayers: 'g.number_of_players as "numberOfPlayers"',
      ratingContent: 'g.rating_content as "ratingContent"',
      rightsId: 'g.rights_id as "rightsId"',
      region: 'g.region',
      isDemo: 'g.is_demo as "isDemo"',
      console: 'g.console',
      type: 'g.type',
      version: 'g.version',
      intro: 'e.intro',
      description: 'e.description'
    }
    
    // Determine which fields to select
    let requestedFields = []
    let needsJoin = false
    
    if (fieldsParam) {
      const fields = fieldsParam.split(',').map(f => f.trim())
      // Always include id
      requestedFields = ['id', ...fields.filter(f => f !== 'id' && fieldMapping[f])]
      
      // Check if we need the language join
      needsJoin = requestedFields.includes('intro') || requestedFields.includes('description')
    } else {
      // Select all fields
      requestedFields = Object.keys(fieldMapping)
      needsJoin = true
    }
    
    // Build SELECT clause
    const selectFields = requestedFields
      .filter(field => fieldMapping[field])
      .map(field => fieldMapping[field])
      .join(', ')
    
    // Build query
    let query = `SELECT ${selectFields} FROM nx g`
    
    if (needsJoin) {
      query += ` LEFT JOIN nx_${selectedLang} e ON g.tid = e.tid`
    }
    
    query += ` WHERE g.tid = $1`
    
    const gameStmt = db.prepare(query)
    const game = await gameStmt.get(tid)
    
    if (!game) {
      return c.json({
        success: false,
        error: 'Game not found'
      }, 404)
    }
    
    // Get base URL from request
    const url = new URL(c.req.url)
    const baseUrl = `${url.protocol}//${url.host}`
    
    // Parse JSON fields
    const response = {
      description: game.description || null,
      id: game.id,
      name: game.name || null,
      publisher: game.publisher || null,
      releaseDate: game.releaseDate || null,
      version: game.version || 0,
      category: game.category ? JSON.parse(game.category) : null,
      developer: game.developer || null,
      intro: game.intro || null,
      isDemo: game.isDemo === 1,
      languages: game.languages ? JSON.parse(game.languages) : null,
      nsuId: game.nsuId || null,
      numberOfPlayers: game.numberOfPlayers || null,
      ratingContent: game.ratingContent ? JSON.parse(game.ratingContent) : null,
      region: game.region || null,
      rightsId: game.rightsId || null,
      console: game.console || 'nx',
      type: game.type || 'base'
    }
    
    // Determine which media to check based on requested fields
    const shouldCheckMedia = !fieldsParam || 
                             fieldsParam.includes('icon') || 
                             fieldsParam.includes('banner') || 
                             fieldsParam.includes('screens')
    
    // Add media URLs only if requested (or if no filter specified)
    if (shouldCheckMedia || !fieldsParam) {
      // Check icon only if needed
      if (!fieldsParam || fieldsParam.includes('icon')) {
        if (getIconPath(tid)) {
          response.icon = `${baseUrl}/nx/${tid}/icon`
        }
      }
      
      // Check banner only if needed
      if (!fieldsParam || fieldsParam.includes('banner')) {
        if (getBannerPath(tid)) {
          response.banner = `${baseUrl}/nx/${tid}/banner`
        }
      }
      
      // Check screenshots only if needed
      if (!fieldsParam || fieldsParam.includes('screens')) {
        const screenshots = getAllScreenshots(tid)
        if (screenshots.length > 0) {
          response.screens = {
            count: screenshots.length,
            screenshots: screenshots.map(index => `${baseUrl}/nx/${tid}/screen/${index}`)
          }
        }
      }
    }
    
    // Apply field filtering if requested
    if (fieldsParam) {
      const requestedFields = fieldsParam.split(',').map(f => f.trim())
      const filteredResponse = {}
      
      // Always include id
      filteredResponse.id = response.id
      
      // Add only requested fields
      for (const field of requestedFields) {
        if (field !== 'id' && response.hasOwnProperty(field)) {
          filteredResponse[field] = response[field]
        }
      }
      
      return c.json(filteredResponse)
    }
    
    return c.json(response)
  } catch (error) {
    return c.json({
      success: false,
      error: error.message
    }, 500)
  }
})

export default nx

