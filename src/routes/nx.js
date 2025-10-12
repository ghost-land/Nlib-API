import { Hono } from 'hono'
import { getGameByTID, getGamesCount, getLastSync } from '../services/nxSync.js'
import { getIconPath, getBannerPath, getScreenshotPath, getAllScreenshots } from '../services/media.js'
import db from '../database/init.js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

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

// Get icon
nx.get('/:tid/icon', (c) => {
  try {
    const tid = c.req.param('tid').toUpperCase()
    const iconPath = getIconPath(tid)
    
    if (!iconPath) {
      return c.json({ success: false, error: 'Icon not found' }, 404)
    }
    
    const image = readFileSync(iconPath)
    return c.body(image, 200, {
      'Content-Type': 'image/jpeg'
    })
  } catch (error) {
    return c.json({ success: false, error: error.message }, 500)
  }
})

// Get banner
nx.get('/:tid/banner', (c) => {
  try {
    const tid = c.req.param('tid').toUpperCase()
    const bannerPath = getBannerPath(tid)
    
    if (!bannerPath) {
      return c.json({ success: false, error: 'Banner not found' }, 404)
    }
    
    const image = readFileSync(bannerPath)
    return c.body(image, 200, {
      'Content-Type': 'image/jpeg'
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
nx.get('/stats', (c) => {
  try {
    // Total games count
    const totalGames = getGamesCount()
    const lastSync = getLastSync()
    
    // Games by type
    const typeStats = db.prepare(`
      SELECT type, COUNT(*) as count
      FROM games
      GROUP BY type
    `).all()
    
    // Games vs Demos
    const demoStats = db.prepare(`
      SELECT 
        SUM(CASE WHEN is_demo = 1 THEN 1 ELSE 0 END) as demos,
        SUM(CASE WHEN is_demo = 0 THEN 1 ELSE 0 END) as games
      FROM games
    `).get()
    
    // Games by region
    const regionStats = db.prepare(`
      SELECT region, COUNT(*) as count
      FROM games
      WHERE region IS NOT NULL
      GROUP BY region
      ORDER BY count DESC
    `).all()
    
    // Games by console
    const consoleStats = db.prepare(`
      SELECT console, COUNT(*) as count
      FROM games
      GROUP BY console
    `).all()
    
    // Top 10 publishers
    const topPublishers = db.prepare(`
      SELECT publisher, COUNT(*) as count
      FROM games
      WHERE publisher IS NOT NULL AND publisher != ''
      GROUP BY publisher
      ORDER BY count DESC
      LIMIT 10
    `).all()
    
    // Most recent games added/updated
    const recentGames = db.prepare(`
      SELECT tid, name, updated_at
      FROM games
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
nx.get('/:tid', (c) => {
  try {
    const tid = c.req.param('tid').toUpperCase()
    const lang = c.req.query('lang') || 'en' // Default to English
    
    // Validate language
    const validLangs = ['en', 'ja', 'es', 'de', 'fr', 'nl', 'pt', 'it', 'zh', 'ko', 'ru']
    const selectedLang = validLangs.includes(lang) ? lang : 'en'
    
    // Get game data with selected language
    const gameStmt = db.prepare(`
      SELECT 
        g.tid as id,
        g.name,
        g.publisher,
        g.developer,
        g.release_date as releaseDate,
        g.category,
        g.languages,
        g.nsu_id as nsuId,
        g.number_of_players as numberOfPlayers,
        g.rating_content as ratingContent,
        g.rights_id as rightsId,
        g.region,
        g.is_demo as isDemo,
        g.console,
        g.type,
        g.version,
        e.intro,
        e.description
      FROM games g
      LEFT JOIN nx_${selectedLang} e ON g.tid = e.tid
      WHERE g.tid = ?
    `)
    
    const game = gameStmt.get(tid)
    
    if (!game) {
      return c.json({
        success: false,
        error: 'Game not found'
      }, 404)
    }
    
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
    
    return c.json(response)
  } catch (error) {
    return c.json({
      success: false,
      error: error.message
    }, 500)
  }
})

export default nx

