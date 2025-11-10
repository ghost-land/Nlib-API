import { Hono } from 'hono'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import {
  getCtrIconPath,
  getCtrBannerPath,
  getCtrScreenPath,
  getCtrScreenUPath,
  getCtrThumbPath,
  getAllCtrScreens,
  getAllCtrScreenU,
  getAllCtrThumbs
} from '../services/ctrMedia.js'
import {
  getCtrMetadata,
  getCtrMetadataField,
  getCtrStats,
  getCtrCategoryTitles
} from '../services/ctrData.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const ctr = new Hono()

// Home page for CTR 3DS API
ctr.get('/', (c) => {
  const htmlPath = join(__dirname, '..', 'views', 'ctr.html')
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

// Get stats (must be before /:tid to avoid conflicts)
ctr.get('/stats', async (c) => {
  try {
    const stats = await getCtrStats()
    return c.json(stats)
  } catch (error) {
    return c.json({ success: false, error: error.message }, 500)
  }
})

// Get category titles (must be before /:tid to avoid conflicts)
ctr.get('/category/:category', async (c) => {
  try {
    const category = c.req.param('category')
    const titles = await getCtrCategoryTitles(category)
    
    return c.json({
      category,
      count: titles.length,
      titles
    })
  } catch (error) {
    return c.json({ success: false, error: error.message }, 500)
  }
})

// Media endpoints (must be before /:tid to avoid conflicts)

// Get icon
ctr.get('/:tid/icon', (c) => {
  try {
    const tid = c.req.param('tid').toUpperCase()
    const iconPath = getCtrIconPath(tid)
    
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
ctr.get('/:tid/banner', (c) => {
  try {
    const tid = c.req.param('tid').toUpperCase()
    const bannerPath = getCtrBannerPath(tid)
    
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

// Get compiled screenshot
ctr.get('/:tid/screen/:num', (c) => {
  try {
    const tid = c.req.param('tid').toUpperCase()
    const num = parseInt(c.req.param('num'), 10)
    
    if (isNaN(num) || num < 1) {
      return c.json({ success: false, error: 'Invalid screen number' }, 400)
    }
    
    const screenPath = getCtrScreenPath(tid, num)
    
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

// Get uncompiled screenshot (upper/lower)
ctr.get('/:tid/screen_u/:num/:screen', (c) => {
  try {
    const tid = c.req.param('tid').toUpperCase()
    const num = parseInt(c.req.param('num'), 10)
    const screen = c.req.param('screen')
    
    if (isNaN(num) || num < 1) {
      return c.json({ success: false, error: 'Invalid screen number' }, 400)
    }
    
    if (screen !== 'u' && screen !== 'l') {
      return c.json({ success: false, error: 'Invalid screen type. Use "u" for upper or "l" for lower' }, 400)
    }
    
    const screenPath = getCtrScreenUPath(tid, num, screen)
    
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

// Get thumbnail
ctr.get('/:tid/thumb/:num', (c) => {
  try {
    const tid = c.req.param('tid').toUpperCase()
    const num = parseInt(c.req.param('num'), 10)
    
    if (isNaN(num) || num < 1) {
      return c.json({ success: false, error: 'Invalid thumbnail number' }, 400)
    }
    
    const thumbPath = getCtrThumbPath(tid, num)
    
    if (!thumbPath) {
      return c.json({ success: false, error: 'Thumbnail not found' }, 404)
    }
    
    const image = readFileSync(thumbPath)
    return c.body(image, 200, {
      'Content-Type': 'image/jpeg'
    })
  } catch (error) {
    return c.json({ success: false, error: error.message }, 500)
  }
})

// Get all screenshots list
ctr.get('/:tid/screens', (c) => {
  try {
    const tid = c.req.param('tid').toUpperCase()
    const screens = getAllCtrScreens(tid)
    
    // Build URLs for each screenshot based on current domain
    const url = new URL(c.req.url)
    const baseUrl = `${url.protocol}//${url.host}/ctr/${tid}/screen`
    const screenshotUrls = screens.map(num => `${baseUrl}/${num}`)
    
    return c.json({
      count: screens.length,
      screenshots: screenshotUrls
    })
  } catch (error) {
    return c.json({ success: false, error: error.message }, 500)
  }
})

// Get all uncompiled screenshots list
ctr.get('/:tid/screen_u', (c) => {
  try {
    const tid = c.req.param('tid').toUpperCase()
    const screenU = getAllCtrScreenU(tid)
    
    // Build URLs for each screenshot based on current domain
    const url = new URL(c.req.url)
    const baseUrl = `${url.protocol}//${url.host}/ctr/${tid}/screen_u`
    
    const upperScreens = screenU.upper.map(num => ({
      number: num,
      url: `${baseUrl}/${num}/u`
    }))
    
    const lowerScreens = screenU.lower.map(num => ({
      number: num,
      url: `${baseUrl}/${num}/l`
    }))
    
    return c.json({
      count: {
        upper: screenU.upper.length,
        lower: screenU.lower.length,
        total: screenU.upper.length + screenU.lower.length
      },
      screenshots: {
        upper: upperScreens,
        lower: lowerScreens
      }
    })
  } catch (error) {
    return c.json({ success: false, error: error.message }, 500)
  }
})

// Get all thumbnails list
ctr.get('/:tid/thumbs', (c) => {
  try {
    const tid = c.req.param('tid').toUpperCase()
    const thumbs = getAllCtrThumbs(tid)
    
    // Build URLs for each thumbnail based on current domain
    const url = new URL(c.req.url)
    const baseUrl = `${url.protocol}//${url.host}/ctr/${tid}/thumb`
    const thumbnailUrls = thumbs.map(num => `${baseUrl}/${num}`)
    
    return c.json({
      count: thumbs.length,
      thumbnails: thumbnailUrls
    })
  } catch (error) {
    return c.json({ success: false, error: error.message }, 500)
  }
})

// Get all media
ctr.get('/:tid/media', (c) => {
  try {
    const tid = c.req.param('tid').toUpperCase()
    const url = new URL(c.req.url)
    const baseUrl = `${url.protocol}//${url.host}`
    
    const media = {
      metadata: `${baseUrl}/ctr/${tid}`,
      banner: null,
      icon: null,
      screenshots: {
        compiled: [],
        uncompiled: {
          upper: [],
          lower: []
        }
      },
      thumbnails: []
    }
    
    // Check banner
    if (getCtrBannerPath(tid)) {
      media.banner = `${baseUrl}/ctr/${tid}/banner`
    }
    
    // Check icon
    if (getCtrIconPath(tid)) {
      media.icon = `${baseUrl}/ctr/${tid}/icon`
    }
    
    // Get compiled screenshots
    const screens = getAllCtrScreens(tid)
    media.screenshots.compiled = screens.map(num => `${baseUrl}/ctr/${tid}/screen/${num}`)
    
    // Get uncompiled screenshots
    const screenU = getAllCtrScreenU(tid)
    media.screenshots.uncompiled.upper = screenU.upper.map(num => `${baseUrl}/ctr/${tid}/screen_u/${num}/u`)
    media.screenshots.uncompiled.lower = screenU.lower.map(num => `${baseUrl}/ctr/${tid}/screen_u/${num}/l`)
    
    // Get thumbnails
    const thumbs = getAllCtrThumbs(tid)
    media.thumbnails = thumbs.map(num => `${baseUrl}/ctr/${tid}/thumb/${num}`)
    
    return c.json(media)
  } catch (error) {
    return c.json({ success: false, error: error.message }, 500)
  }
})

// Get specific metadata field
ctr.get('/:tid/meta/:meta', async (c) => {
  try {
    const tid = c.req.param('tid').toUpperCase()
    const metaField = c.req.param('meta')
    
    const value = await getCtrMetadataField(tid, metaField)
    
    if (value === null) {
      return c.json({ success: false, error: 'Metadata field not found' }, 404)
    }
    
    return c.json(value)
  } catch (error) {
    return c.json({ success: false, error: error.message }, 500)
  }
})

// Get full title metadata with media
ctr.get('/:tid', async (c) => {
  try {
    const tid = c.req.param('tid').toUpperCase()
    const fieldsParam = c.req.query('fields') // Optional fields filter
    
    const metadata = await getCtrMetadata(tid)
    
    if (!metadata) {
      return c.json({ success: false, error: 'Title not found' }, 404)
    }
    
    // Get base URL from request
    const url = new URL(c.req.url)
    const baseUrl = `${url.protocol}//${url.host}`
    
    // Build response with media URLs
    const response = {
      ...metadata,
      media: {
        banner: null,
        icon: null,
        screenshots: {
          compiled: [],
          uncompiled: {
            upper: [],
            lower: []
          }
        },
        thumbnails: []
      }
    }
    
    // Check banner
    if (getCtrBannerPath(tid)) {
      response.media.banner = `${baseUrl}/ctr/${tid}/banner`
    }
    
    // Check icon
    if (getCtrIconPath(tid)) {
      response.media.icon = `${baseUrl}/ctr/${tid}/icon`
    }
    
    // Get compiled screenshots
    const screens = getAllCtrScreens(tid)
    response.media.screenshots.compiled = screens.map(num => `${baseUrl}/ctr/${tid}/screen/${num}`)
    
    // Get uncompiled screenshots
    const screenU = getAllCtrScreenU(tid)
    response.media.screenshots.uncompiled.upper = screenU.upper.map(num => `${baseUrl}/ctr/${tid}/screen_u/${num}/u`)
    response.media.screenshots.uncompiled.lower = screenU.lower.map(num => `${baseUrl}/ctr/${tid}/screen_u/${num}/l`)
    
    // Get thumbnails
    const thumbs = getAllCtrThumbs(tid)
    response.media.thumbnails = thumbs.map(num => `${baseUrl}/ctr/${tid}/thumb/${num}`)
    
    // Apply field filtering if requested
    if (fieldsParam) {
      const requestedFields = fieldsParam.split(',').map(f => f.trim())
      const filteredResponse = {}
      
      for (const field of requestedFields) {
        if (response.hasOwnProperty(field)) {
          filteredResponse[field] = response[field]
        }
      }
      
      return c.json(filteredResponse)
    }
    
    return c.json(response)
  } catch (error) {
    return c.json({ success: false, error: error.message }, 500)
  }
})

export default ctr

