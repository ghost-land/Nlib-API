import { Hono } from 'hono'
import { getGameByTID, getGamesCount, getLastSync, syncNXGames } from '../services/nxSync.js'
import { syncTitleDB } from '../services/titledbSync.js'
import { getIconPath, getBannerPath, getScreenshotPath, getAllScreenshots } from '../services/media.js'
import db from '../database/init.js'
import { readFileSync } from 'fs'

const nx = new Hono()

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

// Get stats
nx.get('/stats', (c) => {
  try {
    const count = getGamesCount()
    const lastSync = getLastSync()
    
    return c.json({
      success: true,
      data: {
        total_games: count,
        last_sync: lastSync
      }
    })
  } catch (error) {
    return c.json({
      success: false,
      error: error.message
    }, 500)
  }
})

// Manual sync endpoint for NX TIDs (for testing)
nx.post('/sync/tids', async (c) => {
  try {
    const result = await syncNXGames()
    return c.json(result)
  } catch (error) {
    return c.json({
      success: false,
      error: error.message
    }, 500)
  }
})

// Manual sync endpoint for TitleDB (for testing)
nx.post('/sync/titledb', async (c) => {
  try {
    const result = await syncTitleDB()
    return c.json(result)
  } catch (error) {
    return c.json({
      success: false,
      error: error.message
    }, 500)
  }
})

export default nx

