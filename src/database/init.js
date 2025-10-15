import Database from 'better-sqlite3'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { existsSync, mkdirSync } from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Create data directory if it doesn't exist
const dataDir = join(__dirname, '..', '..', 'data')
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true })
}

const dbPath = join(dataDir, 'nlib.db')
const db = new Database(dbPath)

// Enable foreign keys
db.pragma('foreign_keys = ON')

// Initialize database schema
function initDatabase() {
  // Create nx table with all metadata
  db.exec(`
    CREATE TABLE IF NOT EXISTS nx (
      tid TEXT PRIMARY KEY,
      name TEXT,
      publisher TEXT,
      developer TEXT,
      release_date TEXT,
      category TEXT,
      languages TEXT,
      nsu_id INTEGER,
      number_of_players INTEGER,
      rating_content TEXT,
      rights_id TEXT,
      region TEXT,
      is_demo INTEGER DEFAULT 0,
      console TEXT DEFAULT 'nx',
      type TEXT DEFAULT 'base',
      version INTEGER DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // Create index on tid
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_nx_tid ON nx(tid)
  `)

  // Create descriptions tables for each language
  const languages = ['en', 'ja', 'es', 'de', 'fr', 'nl', 'pt', 'it', 'zh', 'ko', 'ru']
  
  languages.forEach(lang => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS nx_${lang} (
        tid TEXT PRIMARY KEY,
        intro TEXT,
        description TEXT,
        FOREIGN KEY (tid) REFERENCES nx(tid)
      )
    `)
  })

  // Create sync_log table to track updates
  db.exec(`
    CREATE TABLE IF NOT EXISTS sync_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      games_count INTEGER,
      status TEXT,
      source TEXT
    )
  `)

  console.log('Database initialized successfully')
}

// Initialize database on import
initDatabase()

export default db

