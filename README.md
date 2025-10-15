# Nlib API

A modern and performant REST API for Nintendo game library data. Access game information, media assets, screenshots, and comprehensive statistics across Nintendo platforms.

[![License: GPL-3.0](https://img.shields.io/badge/License-GPL%203.0-blue.svg)](https://opensource.org/licenses/GPL-3.0)

## Features

- 🎮 Complete Nintendo Switch game database
- 🖼️ Game icons, banners, and screenshots
- 🌍 Multi-language support (11 languages)
- 📊 Comprehensive statistics
- 🔄 Automatic daily synchronization with TitleDB
- 🚀 Fast and lightweight

## API Documentation

### Base URL

The API is accessible at your deployment URL. All endpoints support trailing slashes.

### Nintendo Switch Endpoints

#### Get Game Information

```http
GET /nx/:tid?lang=en
```

**Parameters:**
- `tid` (required) - 16-character hexadecimal Title ID
- `lang` (optional) - Language code, default: `en`
  - Available: `en`, `ja`, `es`, `de`, `fr`, `nl`, `pt`, `it`, `zh`, `ko`, `ru`
- `fields` (optional) - Comma-separated list of fields to include. Always includes `id`.
  - Example: `name,description,publisher`

**Example Requests:**
```http
# Full response
GET /nx/01007EF00011E000?lang=fr

# Only specific fields
GET /nx/01007EF00011E000?fields=name,description
GET /nx/01007EF00011E000?fields=description
GET /nx/01007EF00011E000?fields=name,publisher,releaseDate,icon

# Combine parameters
GET /nx/01007EF00011E000?lang=fr&fields=name,description,intro
```

**Example Response:**
```json
{
  "description": "Full game description...",
  "id": "01007EF00011E000",
  "name": "The Legend of Zelda™: Breath of the Wild",
  "publisher": "Nintendo",
  "releaseDate": "2017-03-03",
  "version": 196608,
  "category": ["Adventure", "Action", "RPG"],
  "developer": "Nintendo EPD",
  "intro": "Short introduction...",
  "isDemo": false,
  "languages": ["ja", "en", "es", "fr", "de", "it", "nl", "ru", "ko", "zh"],
  "nsuId": 70010000000025,
  "numberOfPlayers": 1,
  "ratingContent": ["Fantasy Violence", "Mild Suggestive Themes"],
  "region": "US",
  "rightsId": "01007EF00011E0000000000000000000",
  "console": "nx",
  "type": "base",
  "icon": "https://api.nlib.cc/nx/01007EF00011E000/icon",
  "banner": "https://api.nlib.cc/nx/01007EF00011E000/banner",
  "screens": {
    "count": 8,
    "screenshots": [
      "https://api.nlib.cc/nx/01007EF00011E000/screen/1",
      "https://api.nlib.cc/nx/01007EF00011E000/screen/2",
      "https://api.nlib.cc/nx/01007EF00011E000/screen/3"
    ]
  }
}
```

**Example Filtered Response:**
```http
GET /nx/01007EF00011E000?fields=name,description
```

```json
{
  "id": "01007EF00011E000",
  "name": "The Legend of Zelda™: Breath of the Wild",
  "description": "Full game description..."
}
```

**Notes:**
- Media URLs (`icon`, `banner`, `screens`) are only included if the corresponding media files are available
- Use the `fields` parameter to request only specific data and reduce response size
- The `id` field is always included in the response
- SQL queries are optimized to select only requested fields
- Media checks (filesystem operations) are skipped if not requested

**Performance Benefits:**

| Request | Response Size | SQL Complexity | Media Checks |
|---------|---------------|----------------|--------------|
| Full response | 2-5 KB | All fields + JOIN | 3 file checks |
| `?fields=name,publisher` | ~100 bytes | 2 fields only | None |
| `?fields=description` | ~1-3 KB | 1 field + JOIN | None |
| `?fields=name,icon` | ~200 bytes | 1 field only | Icon only |

**Example optimization:**
```http
# Before: Full response (2.5 KB, 15ms)
GET /nx/01007EF00011E000

# After: Only what you need (150 bytes, 3ms)
GET /nx/01007EF00011E000?fields=name,publisher
```

#### Get Game Icon

```http
GET /nx/:tid/icon/:width?/:height?
```

**Parameters:**
- `width` (optional) - Size in pixels (60-4096). Automatically rounded to nearest 10.
- `height` (optional) - Must equal width if provided. Icons are always square.

Returns the game icon in JPEG format. If no size is specified, returns the original image.

**Examples:**
```http
GET /nx/01007EF00011E000/icon              # Original size
GET /nx/01007EF00011E000/icon/64           # 60x60 (rounded)
GET /nx/01007EF00011E000/icon/67           # 70x70 (rounded)
GET /nx/01007EF00011E000/icon/256          # 260x260 (rounded)
GET /nx/01007EF00011E000/icon/256/256      # 260x260 (explicit)
GET /nx/01007EF00011E000/icon/512/512      # 510x510 (rounded)
GET /nx/01007EF00011E000/icon/1024         # 1020x1020 (rounded)
```

**Notes:**
- Icons are always square
- Sizes are automatically rounded to the nearest 10 pixels for cache optimization
- Minimum size: 60 pixels
- Both `/icon/256` and `/icon/256/256` produce identical results
- Response header `X-Size-Rounded` shows the actual size served (e.g., `64->60`)

#### Get Game Banner

```http
GET /nx/:tid/banner/:size?
```

**Parameters:**
- `size` (optional) - Banner size
  - Shortcuts: `240`/`240p`, `360`/`360p`, `480`/`480p`, `540`/`540p`, `720`/`720p`, `1080`/`1080p`
  - Widths: `426`, `640`, `854`, `960`, `1280`, `1920`
  - Default: 1920x1080 (1080p)
  - Supported sizes: 426x240, 640x360, 854x480, 960x540, 1280x720, 1920x1080

Returns the game banner in JPEG format.

**Examples:**
```http
GET /nx/01007EF00011E000/banner         # 1920x1080 (default)
GET /nx/01007EF00011E000/banner/1080p   # 1920x1080
GET /nx/01007EF00011E000/banner/720p    # 1280x720
GET /nx/01007EF00011E000/banner/540p    # 960x540
GET /nx/01007EF00011E000/banner/480p    # 854x480
GET /nx/01007EF00011E000/banner/360p    # 640x360
GET /nx/01007EF00011E000/banner/240p    # 426x240
GET /nx/01007EF00011E000/banner/1920    # 1920x1080
GET /nx/01007EF00011E000/banner/426     # 426x240
```

#### Get Screenshot

```http
GET /nx/:tid/screen/:index
```

**Parameters:**
- `index` (required) - Screenshot index (starts at 1)

Returns a specific screenshot in JPEG format.

#### Get All Screenshots

```http
GET /nx/:tid/screens
```

**Example Response:**
```json
{
  "count": 8,
  "screenshots": [
    "https://api.nlib.cc/nx/0100ABC001234000/screen/1",
    "https://api.nlib.cc/nx/0100ABC001234000/screen/2",
    "https://api.nlib.cc/nx/0100ABC001234000/screen/3"
  ]
}
```

Note: Screenshot URLs are dynamically generated based on the API domain.

#### Get Statistics

```http
GET /nx/stats
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "total_games": 15420,
    "last_sync": "2025-10-12T10:30:00Z",
    "by_type": { "base": 12000, "update": 2500, "dlc": 920 },
    "games_vs_demos": { "games": 14800, "demos": 620 },
    "by_region": { "US": 8500, "EU": 4200, "JP": 2720 },
    "by_console": { "nx": 15420 },
    "top_publishers": [
      { "name": "Nintendo", "games_count": 450 }
    ],
    "recent_updates": [
      { "tid": "0100ABC001234000", "name": "Example Game", "updated_at": "..." }
    ]
  }
}
```

### System Endpoints

#### Uptime Status

```http
GET /uptime
```

Returns server status and uptime information.

## Database Schema

### nx

Main table storing game information.

| Column | Type | Description |
|--------|------|-------------|
| tid | VARCHAR(16) | Title ID (Primary Key) |
| name | TEXT | Game name |
| publisher | TEXT | Publisher name |
| developer | TEXT | Developer name |
| release_date | VARCHAR(10) | Release date (YYYY-MM-DD) |
| category | TEXT | Categories (JSON array) |
| languages | TEXT | Supported languages (JSON array) |
| nsu_id | BIGINT | Nintendo eShop ID |
| number_of_players | INTEGER | Number of players |
| rating_content | TEXT | Rating content (JSON array) |
| rights_id | VARCHAR(32) | Rights ID |
| region | VARCHAR(10) | Region code |
| is_demo | INTEGER | Is demo (0/1) |
| console | VARCHAR(10) | Console identifier (default: 'nx') |
| type | VARCHAR(20) | Game type (base/update/dlc) |
| version | INTEGER | Version number |
| updated_at | TIMESTAMP | Last update timestamp |

### nx_[lang]

Language-specific tables for game descriptions (11 tables: en, ja, es, de, fr, nl, pt, it, zh, ko, ru).

| Column | Type | Description |
|--------|------|-------------|
| tid | VARCHAR(16) | Title ID (Primary Key, Foreign Key) |
| intro | TEXT | Short introduction |
| description | TEXT | Full description |

### sync_log

Tracks synchronization history.

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Auto-increment ID (Primary Key) |
| synced_at | TIMESTAMP | Sync timestamp |
| games_count | INTEGER | Number of games synced |
| status | VARCHAR(50) | Sync status |
| source | VARCHAR(100) | Sync source |

## Automatic Synchronization

The API uses a two-stage synchronization system:

### Stage 1: NX TIDs (Daily at 3:00 AM)

**Source:** `https://nx-missing.ghostland.at/data/working.txt`

- Downloads list of all Nintendo Switch Title IDs
- Indexes base games (TIDs starting with `01` and ending with `000`)
- Creates database entries with TID only

### Stage 2: TitleDB (Every 12 hours at 3:00 AM & 3:00 PM)

**Source:** `https://raw.githubusercontent.com/blawar/titledb/refs/heads/master/`

- Downloads game metadata from multiple regions
- Enriches existing TIDs with detailed information
- Supports 11 languages
- **Never overwrites existing data** - preserves data quality

### Data Priority Rules

1. Existing (non-null) data is never overwritten
2. US.en is processed first for English content
3. Multiple regions provide data redundancy

## Installation

### Requirements

- Node.js 18+
- PostgreSQL 12+

### Database Setup

1. **Create PostgreSQL database:**

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database and user
CREATE DATABASE nlib_api;
CREATE USER nlib_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE nlib_api TO nlib_user;
\q
```

2. **Create tables:**

```bash
# Execute the schema file
psql -h localhost -U nlib_user -d nlib_api -f database-schema.sql
```

### Application Setup

```bash
# Clone the repository
git clone https://github.com/ghost-land/Nlib-API.git
cd Nlib-API

# Install dependencies
npm install

# Create .env file
cp .env.example .env
# Edit .env with your database credentials

# Start the server
npm start
```

The server will start on port 3000 by default (configurable via `PORT` environment variable).

## Environment Variables

Copy `.env.example` to `.env` and configure your database credentials:

```bash
cp .env.example .env
```

Then edit `.env` with your PostgreSQL connection details.

## Development

```bash
# Run in development mode
npm start

# Enable debug logs
# Add DB_DEBUG=true to your .env file
```

## Important Notes

- All Title IDs are automatically converted to uppercase
- Endpoints can be called with or without trailing slashes
- All images are served in JPEG format
- Icons support optional resizing (60-4096 pixels, rounded to nearest 10) and are always square
- Banners support multiple sizes: 240p, 360p, 480p, 540p, 720p, 1080p
- Resized images are cached on disk for optimal performance
- Screenshot URLs are generated dynamically based on the API domain
- Database synchronization runs automatically
- API responses use standard HTTP status codes (200, 404, 500)

## License

This project is licensed under the GPL-3.0 License - see the LICENSE file for details.

## Credits

- Game data sourced from [TitleDB](https://github.com/blawar/titledb)
- Nintendo Switch Title IDs from [nx-missing](https://nx-missing.ghostland.at/)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
