import { Hono } from 'hono'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import {
  getCitraIconPath,
  getCitraBannerPath,
  getCitraScreenPath,
  getCitraScreenUPath,
  getCitraThumbPath,
  getAllCitraScreens,
  getAllCitraScreenU,
  getAllCitraThumbs
} from '../services/citraMedia.js'
import {
  getCitraMetadata,
  getCitraMetadataField,
  getCitraStats,
  getCitraCategoryTitles
} from '../services/citraData.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const citra = new Hono()

// Home page for Citra 3DS API
citra.get('/', (c) => {
  const htmlPath = join(__dirname, '..', 'views', 'citra.html')
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
citra.get('/stats', async (c) => {
  try {
    const stats = await getCitraStats()
    return c.json(stats)
  } catch (error) {
    return c.json({ success: false, error: error.message }, 500)
  }
})

// Get category titles (must be before /:tid to avoid conflicts)
citra.get('/category/:category', async (c) => {
  try {
    const category = c.req.param('category')
    const titles = await getCitraCategoryTitles(category)
    
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
citra.get('/:tid/icon', (c) => {
  try {
    const tid = c.req.param('tid').toUpperCase()
    const iconPath = getCitraIconPath(tid)
    
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
citra.get('/:tid/banner', (c) => {
  try {
    const tid = c.req.param('tid').toUpperCase()
    const bannerPath = getCitraBannerPath(tid)
    
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
citra.get('/:tid/screen/:num', (c) => {
  try {
    const tid = c.req.param('tid').toUpperCase()
    const num = parseInt(c.req.param('num'), 10)
    
    if (isNaN(num) || num < 1) {
      return c.json({ success: false, error: 'Invalid screen number' }, 400)
    }
    
    const screenPath = getCitraScreenPath(tid, num)
    
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
citra.get('/:tid/screen_u/:num/:screen', (c) => {
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
    
    const screenPath = getCitraScreenUPath(tid, num, screen)
    
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
citra.get('/:tid/thumb/:num', (c) => {
  try {
    const tid = c.req.param('tid').toUpperCase()
    const num = parseInt(c.req.param('num'), 10)
    
    if (isNaN(num) || num < 1) {
      return c.json({ success: false, error: 'Invalid thumbnail number' }, 400)
    }
    
    const thumbPath = getCitraThumbPath(tid, num)
    
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
citra.get('/:tid/screens', (c) => {
  try {
    const tid = c.req.param('tid').toUpperCase()
    const screens = getAllCitraScreens(tid)
    
    // Build URLs for each screenshot based on current domain
    const url = new URL(c.req.url)
    const baseUrl = `${url.protocol}//${url.host}/citra/${tid}/screen`
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
citra.get('/:tid/screen_u', (c) => {
  try {
    const tid = c.req.param('tid').toUpperCase()
    const screenU = getAllCitraScreenU(tid)
    
    // Build URLs for each screenshot based on current domain
    const url = new URL(c.req.url)
    const baseUrl = `${url.protocol}//${url.host}/citra/${tid}/screen_u`
    
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
citra.get('/:tid/thumbs', (c) => {
  try {
    const tid = c.req.param('tid').toUpperCase()
    const thumbs = getAllCitraThumbs(tid)
    
    // Build URLs for each thumbnail based on current domain
    const url = new URL(c.req.url)
    const baseUrl = `${url.protocol}//${url.host}/citra/${tid}/thumb`
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
citra.get('/:tid/media', (c) => {
  try {
    const tid = c.req.param('tid').toUpperCase()
    const url = new URL(c.req.url)
    const baseUrl = `${url.protocol}//${url.host}`
    
    const media = {
      metadata: `${baseUrl}/citra/${tid}`,
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
    if (getCitraBannerPath(tid)) {
      media.banner = `${baseUrl}/citra/${tid}/banner`
    }
    
    // Check icon
    if (getCitraIconPath(tid)) {
      media.icon = `${baseUrl}/citra/${tid}/icon`
    }
    
    // Get compiled screenshots
    const screens = getAllCitraScreens(tid)
    media.screenshots.compiled = screens.map(num => `${baseUrl}/citra/${tid}/screen/${num}`)
    
    // Get uncompiled screenshots
    const screenU = getAllCitraScreenU(tid)
    media.screenshots.uncompiled.upper = screenU.upper.map(num => `${baseUrl}/citra/${tid}/screen_u/${num}/u`)
    media.screenshots.uncompiled.lower = screenU.lower.map(num => `${baseUrl}/citra/${tid}/screen_u/${num}/l`)
    
    // Get thumbnails
    const thumbs = getAllCitraThumbs(tid)
    media.thumbnails = thumbs.map(num => `${baseUrl}/citra/${tid}/thumb/${num}`)
    
    return c.json(media)
  } catch (error) {
    return c.json({ success: false, error: error.message }, 500)
  }
})

// Get specific metadata field
citra.get('/:tid/meta/:meta', async (c) => {
  try {
    const tid = c.req.param('tid').toUpperCase()
    const metaField = c.req.param('meta')
    
    const value = await getCitraMetadataField(tid, metaField)
    
    if (value === null) {
      return c.json({ success: false, error: 'Metadata field not found' }, 404)
    }
    
    return c.json(value)
  } catch (error) {
    return c.json({ success: false, error: error.message }, 500)
  }
})

// Get full title metadata with media
citra.get('/:tid', async (c) => {
  try {
    const tid = c.req.param('tid').toUpperCase()
    const fieldsParam = c.req.query('fields') // Optional fields filter
    
    const metadata = await getCitraMetadata(tid)
    
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
    if (getCitraBannerPath(tid)) {
      response.media.banner = `${baseUrl}/citra/${tid}/banner`
    }
    
    // Check icon
    if (getCitraIconPath(tid)) {
      response.media.icon = `${baseUrl}/citra/${tid}/icon`
    }
    
    // Get compiled screenshots
    const screens = getAllCitraScreens(tid)
    response.media.screenshots.compiled = screens.map(num => `${baseUrl}/citra/${tid}/screen/${num}`)
    
    // Get uncompiled screenshots
    const screenU = getAllCitraScreenU(tid)
    response.media.screenshots.uncompiled.upper = screenU.upper.map(num => `${baseUrl}/citra/${tid}/screen_u/${num}/u`)
    response.media.screenshots.uncompiled.lower = screenU.lower.map(num => `${baseUrl}/citra/${tid}/screen_u/${num}/l`)
    
    // Get thumbnails
    const thumbs = getAllCitraThumbs(tid)
    response.media.thumbnails = thumbs.map(num => `${baseUrl}/citra/${tid}/thumb/${num}`)
    
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

export default citra

