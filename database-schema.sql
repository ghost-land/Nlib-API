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

