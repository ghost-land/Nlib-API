import dotenv from 'dotenv'
import pg from 'pg'

// Load environment variables
dotenv.config()

const { Pool } = pg

// Log configuration (password hidden)
console.log('=== PostgreSQL Configuration ===')
console.log('Host:', process.env.DB_HOST)
console.log('Port:', process.env.DB_PORT || '5432')
console.log('Database:', process.env.DB_NAME)
console.log('User:', process.env.DB_USER)
console.log('SSL:', process.env.DB_SSL === 'true' ? 'Enabled' : 'Disabled')
if (process.env.DB_SSL === 'true') {
  console.log('SSL Reject Unauthorized:', process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false')
}
console.log('================================\n')

// Create PostgreSQL connection pool
const poolConfig = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true' ? {
    rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false'
  } : false,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000, // Increased to 10 seconds
}

console.log('Creating connection pool...')
const pool = new Pool(poolConfig)

// Test connection
pool.on('connect', (client) => {
  // Log only if debug enabled
  if (process.env.DB_DEBUG === 'true') {
    console.log('✓ New connection established to PostgreSQL pool')
  }
})

pool.on('acquire', (client) => {
  // Log disabled to avoid verbosity
  // console.log('→ Client acquired from pool')
})

pool.on('remove', (client) => {
  // Log disabled to avoid verbosity
  // console.log('← Client removed from pool')
})

pool.on('error', (err, client) => {
  console.error('✗ Unexpected PostgreSQL error:', err.message)
  if (process.env.DB_DEBUG === 'true') {
    console.error('Stack:', err.stack)
  }
})

// Helper function to prepare statements (compatibility layer)
class PreparedStatement {
  constructor(sql) {
    this.sql = sql
  }

  async get(...params) {
    const result = await pool.query(this.sql, params)
    return result.rows[0] || null
  }

  async all(...params) {
    const result = await pool.query(this.sql, params)
    return result.rows
  }

  async run(...params) {
    const result = await pool.query(this.sql, params)
    return {
      changes: result.rowCount || 0,
      lastInsertRowid: result.rows[0]?.id || null
    }
  }
}

// Database wrapper with compatibility methods
const db = {
  pool,
  
  // Prepare a statement (async compatible)
  prepare(sql) {
    return new PreparedStatement(sql)
  },
  
  // Execute raw SQL (for migrations, etc)
  async exec(sql) {
    await pool.query(sql)
  },
  
  // Transaction helper
  transaction(fn) {
    return async (...args) => {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        const result = await fn(...args)
        await client.query('COMMIT')
        return result
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      } finally {
        client.release()
      }
    }
  }
}

// Check database connection
async function checkConnection() {
  console.log('Testing PostgreSQL connection...')
  try {
    const startTime = Date.now()
    const result = await pool.query('SELECT NOW() as now, version() as version, current_database() as database')
    const duration = Date.now() - startTime
    
    console.log('✓ Database initialized successfully!')
    console.log('  - Server time:', result.rows[0].now)
    console.log('  - Database:', result.rows[0].database)
    console.log('  - PostgreSQL version:', result.rows[0].version.split(',')[0])
    console.log('  - Response time:', duration + 'ms')
    console.log('  - Pool: active connections =', pool.totalCount, '/ max =', pool.options.max)
    console.log('')
  } catch (error) {
    console.error('\n✗ Database connection error')
    console.error('  - Message:', error.message)
    console.error('  - Code:', error.code)
    
    if (error.code === 'ECONNREFUSED') {
      console.error('  → PostgreSQL server refused connection')
      console.error('  → Check that PostgreSQL is started and accessible')
    } else if (error.code === '28P01') {
      console.error('  → Authentication failed')
      console.error('  → Check username and password')
    } else if (error.code === '28000') {
      console.error('  → pg_hba.conf authentication error')
      console.error('  → Check pg_hba.conf configuration on server')
      console.error('  → Try enabling SSL: DB_SSL=true in .env')
    } else if (error.code === 'ENOTFOUND') {
      console.error('  → Host not found')
      console.error('  → Check DB_HOST in .env')
    } else if (error.code === 'ETIMEDOUT') {
      console.error('  → Connection timeout')
      console.error('  → Check firewall and port', poolConfig.port)
    }
    
    console.error('\n  Current configuration:')
    console.error('    Host:', poolConfig.host)
    console.error('    Port:', poolConfig.port)
    console.error('    Database:', poolConfig.database)
    console.error('    User:', poolConfig.user)
    console.error('    SSL:', poolConfig.ssl ? 'Enabled' : 'Disabled')
    console.error('')
    
    process.exit(1)
  }
}

// Initialize database on import
checkConnection()

export default db

