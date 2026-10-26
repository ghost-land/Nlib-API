-- Nlib API - PostgreSQL Database Schema
-- Execute this script to create all necessary tables for the Nlib API

-- Create main nx table with all metadata
CREATE TABLE IF NOT EXISTS nx (
    tid VARCHAR(16) PRIMARY KEY,
    name TEXT,
    publisher TEXT,
    developer TEXT,
    release_date VARCHAR(10),
    category TEXT,
    languages TEXT,
    nsu_id BIGINT,
    number_of_players INTEGER,
    rating_content TEXT,
    rights_id VARCHAR(32),
    region VARCHAR(10),
    is_demo INTEGER DEFAULT 0,
    console VARCHAR(10) DEFAULT 'nx',
    type VARCHAR(20) DEFAULT 'base',
    version INTEGER DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index on tid for faster lookups
CREATE INDEX IF NOT EXISTS idx_nx_tid ON nx(tid);

-- Create index on updated_at for recent queries
CREATE INDEX IF NOT EXISTS idx_nx_updated_at ON nx(updated_at DESC);

-- Create index on region for filtering
CREATE INDEX IF NOT EXISTS idx_nx_region ON nx(region);

-- Create description tables for each language
CREATE TABLE IF NOT EXISTS nx_en (
    tid VARCHAR(16) PRIMARY KEY,
    intro TEXT,
    description TEXT,
    FOREIGN KEY (tid) REFERENCES nx(tid) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS nx_ja (
    tid VARCHAR(16) PRIMARY KEY,
    intro TEXT,
    description TEXT,
    FOREIGN KEY (tid) REFERENCES nx(tid) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS nx_es (
    tid VARCHAR(16) PRIMARY KEY,
    intro TEXT,
    description TEXT,
    FOREIGN KEY (tid) REFERENCES nx(tid) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS nx_de (
    tid VARCHAR(16) PRIMARY KEY,
    intro TEXT,
    description TEXT,
    FOREIGN KEY (tid) REFERENCES nx(tid) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS nx_fr (
    tid VARCHAR(16) PRIMARY KEY,
    intro TEXT,
    description TEXT,
    FOREIGN KEY (tid) REFERENCES nx(tid) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS nx_nl (
    tid VARCHAR(16) PRIMARY KEY,
    intro TEXT,
    description TEXT,
    FOREIGN KEY (tid) REFERENCES nx(tid) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS nx_pt (
    tid VARCHAR(16) PRIMARY KEY,
    intro TEXT,
    description TEXT,
    FOREIGN KEY (tid) REFERENCES nx(tid) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS nx_it (
    tid VARCHAR(16) PRIMARY KEY,
    intro TEXT,
    description TEXT,
    FOREIGN KEY (tid) REFERENCES nx(tid) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS nx_zh (
    tid VARCHAR(16) PRIMARY KEY,
    intro TEXT,
    description TEXT,
    FOREIGN KEY (tid) REFERENCES nx(tid) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS nx_ko (
    tid VARCHAR(16) PRIMARY KEY,
    intro TEXT,
    description TEXT,
    FOREIGN KEY (tid) REFERENCES nx(tid) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS nx_ru (
    tid VARCHAR(16) PRIMARY KEY,
    intro TEXT,
    description TEXT,
    FOREIGN KEY (tid) REFERENCES nx(tid) ON DELETE CASCADE
);

-- Create ctr table for 3DS game data
-- Region: uppercase ISO / market codes (JP, US, EU, FR, DE, GB, FREE, …)
-- Category may be nested (e.g. extras/hb)
-- catalog_* / market: links from 3dsdb data/title_catalog.json (cross-region + related)
CREATE TABLE IF NOT EXISTS ctr (
    tid VARCHAR(16) PRIMARY KEY,
    uid VARCHAR(32),
    name TEXT,
    formal_name TEXT,
    description TEXT,
    release_date_on_eshop VARCHAR(10),
    product_code VARCHAR(32),
    platform_name TEXT,
    region VARCHAR(50),
    genres TEXT, -- JSON array stored as TEXT
    features TEXT, -- JSON array stored as TEXT
    languages TEXT, -- JSON array stored as TEXT
    rating_system TEXT, -- JSON object stored as TEXT
    version VARCHAR(20),
    disclaimer TEXT,
    descriptors TEXT, -- JSON array stored as TEXT
    category VARCHAR(64) DEFAULT 'base',
    publisher TEXT,
    smdh TEXT, -- JSON object stored as TEXT
    catalog_id VARCHAR(64), -- e.g. game/CTR:KPF
    catalog_role VARCHAR(16), -- base | update | dlc | demo | extra
    market VARCHAR(10), -- product-code letter market
    region_conflict BOOLEAN DEFAULT FALSE,
    source_hash VARCHAR(40), -- git blob SHA of meta.json (change detection)
    source_path TEXT,
    synced_at TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ctr_tid ON ctr(tid);
CREATE INDEX IF NOT EXISTS idx_ctr_category ON ctr(category);
CREATE INDEX IF NOT EXISTS idx_ctr_updated_at ON ctr(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_ctr_region ON ctr(region);
CREATE INDEX IF NOT EXISTS idx_ctr_source_hash ON ctr(source_hash);
CREATE INDEX IF NOT EXISTS idx_ctr_synced_at ON ctr(synced_at DESC);
CREATE INDEX IF NOT EXISTS idx_ctr_publisher ON ctr(publisher);
CREATE INDEX IF NOT EXISTS idx_ctr_catalog_id ON ctr(catalog_id);
CREATE INDEX IF NOT EXISTS idx_ctr_catalog_role ON ctr(catalog_role);
CREATE INDEX IF NOT EXISTS idx_ctr_market ON ctr(market);

-- Title families from 3dsdb data/title_catalog.json
CREATE TABLE IF NOT EXISTS ctr_catalog (
    id VARCHAR(64) PRIMARY KEY,
    kind VARCHAR(32) NOT NULL,
    platform VARCHAR(8) NOT NULL,
    serial VARCHAR(16) NOT NULL,
    name TEXT,
    regions TEXT,
    markets TEXT,
    counts TEXT,
    releases TEXT,
    catalog_version INTEGER,
    source_hash VARCHAR(40),
    synced_at TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ctr_catalog_kind ON ctr_catalog(kind);
CREATE INDEX IF NOT EXISTS idx_ctr_catalog_platform ON ctr_catalog(platform);
CREATE INDEX IF NOT EXISTS idx_ctr_catalog_serial ON ctr_catalog(serial);
CREATE INDEX IF NOT EXISTS idx_ctr_catalog_updated_at ON ctr_catalog(updated_at DESC);

-- Create sync_log table to track updates
CREATE TABLE IF NOT EXISTS sync_log (
    id SERIAL PRIMARY KEY,
    synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    games_count INTEGER,
    status VARCHAR(50),
    source VARCHAR(100)
);

-- Create index on sync_log for recent queries
CREATE INDEX IF NOT EXISTS idx_sync_log_synced_at ON sync_log(synced_at DESC);

-- Display table information
SELECT 'Tables created successfully!' AS status;
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

